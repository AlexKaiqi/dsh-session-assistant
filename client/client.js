// dsh-chatvoice web client — 全部语音逻辑（DOM 注入 + SpeechRecognition + speechSynthesis）。
// ChatVoice: free voice input + read-aloud for the DeepSeek Harness web GUI.
//
// 模块格式沿用 dsh-free-vision 的已验证写法: window.__ModuleLoader__.load
// 工厂 + exports { name, inject, apply }; 设置页通过 ctx.slots.inject
// ('settings.section') 注册; 输入框麦克风与消息小喇叭用 MutationObserver
// 注入（选择器尽量宽松, 依赖 data- 属性而不是易变的 CSS module 哈希类名）。
//
// 配置读取: GET /dsh-chatvoice/config (host 路由, 持久化 ~/.dsh/chatvoice.json)
// 配置保存: POST /dsh-chatvoice/config —— 保存即生效, 无需重启。
window.__ModuleLoader__.load({ id: "dsh-chatvoice", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const react = require("react");

  const NS = "chatvoice";
  const CONFIG_URL = "/dsh-chatvoice/config";

  /* ══════════════════════════ 共享状态 ══════════════════════════ */

  // Live config (与设置页/宿主文件保持同步)
  const cfg = { recognitionLang: "zh-CN", autoSpeak: false, voiceName: "", rate: 1.0 };

  let voices = [];              // 异步加载的可用音色
  let currentSpeakKey = null;   // 正在朗读的消息 flow key（用于按钮高亮/停止）
  const spokenKeys = new Set(); // 已自动朗读过的消息（不重复读）
  let recognition = null;       // 活动中的 SpeechRecognition 实例
  let srStartValue = "";        // 识别开始前输入框已有内容
  let srFinals = "";            // 已确认的识别文本
  let srInterim = "";           // 实时中间结果
  const pendingAuto = new Map();// 自动朗读稳定性检测: key -> {len, since}

  /* ══════════════════════════ 样式 ══════════════════════════ */

  const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6.5c0 1.66 1.34 3 3 3z" fill="currentColor"/><path d="M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" fill="currentColor"/></svg>';

  function injectCss() {
    if (document.getElementById("chatvoice-style")) return;
    const s = document.createElement("style");
    s.id = "chatvoice-style";
    s.textContent = [
      ".chatvoice-mic-btn,.chatvoice-speak-btn{display:inline-flex;align-items:center;justify-content:center;background:transparent;border:0;padding:4px 5px;margin:0 2px;cursor:pointer;color:inherit;opacity:.75;border-radius:6px;line-height:1;vertical-align:middle;font-size:14px}",
      ".chatvoice-mic-btn:hover:not(:disabled),.chatvoice-speak-btn:hover{opacity:1;background:rgba(127,127,127,.15)}",
      ".chatvoice-mic-btn:disabled{opacity:.35;cursor:not-allowed}",
      ".chatvoice-mic-btn svg,.chatvoice-speak-btn svg{width:16px;height:16px;display:block}",
      ".chatvoice-recording{color:#f85149!important;opacity:1!important;animation:chatvoice-pulse 1.4s ease-in-out infinite}",
      ".chatvoice-speaking{color:#f85149!important;opacity:1!important;font-weight:700}",
      "@keyframes chatvoice-pulse{0%{box-shadow:0 0 0 0 rgba(248,81,73,.45)}70%{box-shadow:0 0 0 7px rgba(248,81,73,0)}100%{box-shadow:0 0 0 0 rgba(248,81,73,0)}}",
      ".chatvoice-toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:2147483000;background:rgba(22,27,34,.95);color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:10px 16px;font-size:13px;line-height:1.5;max-width:min(560px,86vw);box-shadow:0 8px 24px rgba(0,0,0,.4);transition:opacity .25s}",
      ".chatvoice-preview{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:2147483000;background:rgba(22,27,34,.96);color:#f0f6fc;border:1px solid #f85149;border-radius:10px;padding:10px 16px;font-size:13px;line-height:1.5;max-width:min(560px,86vw);box-shadow:0 8px 24px rgba(0,0,0,.4)}",
      ".chatvoice-preview::after{content:'▌';color:#f85149;animation:chatvoice-blink 1s step-end infinite}",
      "@keyframes chatvoice-blink{50%{opacity:0}}",
      ".chatvoice-field{margin:10px 0}",
      ".chatvoice-label{display:block;font-size:12px;font-weight:500;margin-bottom:3px;opacity:.8}",
      ".chatvoice-hint{font-size:11px;opacity:.55;margin-top:3px}",
      ".chatvoice-input{width:100%;box-sizing:border-box;padding:6px 8px;font-size:13px;border-radius:6px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit}",
      ".chatvoice-status{font-size:12px;opacity:.75;margin:6px 0 10px}",
      ".chatvoice-save{margin-top:12px;padding:6px 16px;font-size:13px;border-radius:6px;cursor:pointer;border:1px solid #1f6feb;background:#1f6feb;color:#fff}",
      ".chatvoice-save:disabled{opacity:.5;cursor:default}",
      ".chatvoice-saved{font-size:12px;color:#3fb950;margin-left:8px}",
      ".chatvoice-error{font-size:12px;color:#f85149;margin-top:8px}",
    ].join("
");
    document.head.appendChild(s);
  }

  /* ══════════════════════════ toast / 识别预览 ══════════════════════════ */

  let toastEl = null, toastTimer = null;
  function toast(msg, ms) {
    if (!document.body) return;
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "chatvoice-toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, ms || 4000);
  }

  let previewEl = null;
  function showPreview(text) {
    if (!document.body) return;
    if (!previewEl) { previewEl = document.createElement("div"); previewEl.className = "chatvoice-preview"; document.body.appendChild(previewEl); }
    previewEl.textContent = "🎤 " + (text || "…");
    previewEl.style.display = "block";
  }
  function hidePreview() { if (previewEl) previewEl.style.display = "none"; }

  /* ══════════════════════════ 朗读 (speechSynthesis) ══════════════════════════ */

  function refreshVoices() {
    try {
      const v = speechSynthesis.getVoices();
      if (v && v.length) voices = v;
    } catch { /* ignore */ }
  }

  function pickVoice() {
    refreshVoices();
    if (!voices.length) return null;
    if (cfg.voiceName) {
      const exact = voices.find((v) => v.name === cfg.voiceName);
      if (exact) return exact;
      const fuzzy = voices.find((v) => v.name.toLowerCase().includes(cfg.voiceName.toLowerCase()));
      if (fuzzy) return fuzzy;
    }
    return (
      voices.find((v) => /xiaoxiao.*online.*natural/i.test(v.name)) ||
      voices.find((v) => v.lang === "zh-CN") ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("zh")) ||
      voices.find((v) => /xiaoxiao/i.test(v.name)) ||
      null
    );
  }

  function clampRate(r) {
    const n = Number(r);
    if (!Number.isFinite(n)) return 1.0;
    return Math.min(2, Math.max(0.5, n));
  }

  /** 从消息 markdown 容器提取可朗读纯文本（剥离代码块/表格/公式）。 */
  function extractText(md) {
    try {
      const clone = md.cloneNode(true);
      clone.querySelectorAll("pre, code, table, svg, img, button, style, script, [class*=katex], [class*=attachment]").forEach((n) => n.remove());
      let text = (clone.innerText || clone.textContent || "").replace(/
{3,}/g, "

").trim();
      const MAX = 12000;
      if (text.length > MAX) text = text.slice(0, MAX) + "。内容过长，已截断。";
      return text;
    } catch { return ""; }
  }

  function renderSpeaking() {
    document.querySelectorAll("[data-chatvoice-speak]").forEach((btn) => {
      const on = !!btn.dataset.key && currentSpeakKey === btn.dataset.key;
      btn.classList.toggle("chatvoice-speaking", on);
      if (on) { btn.textContent = "⏹"; btn.title = "停止朗读"; btn.setAttribute("aria-label", "停止朗读"); }
      else { btn.textContent = "🔊"; btn.title = "朗读本条回复"; btn.setAttribute("aria-label", "朗读本条回复"); }
    });
  }

  /** 朗读文本；key 为消息 flow key（再次点击同一消息 = 停止）。 */
  function speak(text, key) {
    if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
      toast("当前浏览器不支持朗读（speechSynthesis）");
      return;
    }
    text = (text || "").replace(/\s+/g, " ").trim();
    if (!text) { toast("没有可朗读的文本"); return; }
    if (currentSpeakKey === key) {
      try { speechSynthesis.cancel(); } catch { /* ignore */ }
      currentSpeakKey = null;
      renderSpeaking();
      return;
    }
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    u.lang = (v && v.lang) || cfg.recognitionLang || "zh-CN";
    if (v) u.voice = v;
    u.rate = clampRate(cfg.rate);
    u.pitch = 1;
    const myKey = key;
    currentSpeakKey = key;
    renderSpeaking();
    const done = () => { if (currentSpeakKey === myKey) { currentSpeakKey = null; renderSpeaking(); } };
    u.onend = done;
    u.onerror = done;
    try { speechSynthesis.speak(u); }
    catch (e) { currentSpeakKey = null; renderSpeaking(); toast("朗读启动失败：" + ((e && e.message) || e)); }
  }

  /* ══════════════════════════ 语音输入 (SpeechRecognition) ══════════════════════════ */

  function srSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /** React 受控 textarea 用原生 value setter + input 事件（free-vision E2E 验证过的坑）。 */
  function setTextareaValue(ta, text) {
    try {
      const proto = ta.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(ta, text);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {
      try { ta.value = text; } catch { /* ignore */ }
    }
  }

  function setMicState(btn, state) {
    const on = state === "recording" || state === "starting";
    btn.classList.toggle("chatvoice-recording", on);
    btn.title = on ? "识别中…再次点击停止" : "语音输入：点击开始，再次点击停止";
    btn.setAttribute("aria-label", btn.title);
  }

  function toggleMic(ta, btn) {
    if (!srSupported()) { toast("当前浏览器不支持语音识别（请使用 Edge 或 Chrome）"); return; }
    if (!window.isSecureContext) { toast("非安全上下文无法使用麦克风：请通过 http://127.0.0.1:3080 访问 dsh web"); return; }
    // 再次点击 = 停止
    if (recognition) {
      try { recognition.stop(); } catch { /* ignore */ }
      recognition = null;
      setMicState(btn, "idle");
      hidePreview();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = cfg.recognitionLang || "zh-CN";
    rec.continuous = false;   // 单次识别，点按开始/停止，简单可靠
    rec.interimResults = true; // 实时中间结果
    rec.maxAlternatives = 1;
    srStartValue = ta && ta.value !== undefined ? ta.value : "";
    srFinals = "";
    srInterim = "";
    rec.onstart = () => setMicState(btn, "recording");
    rec.onresult = (e) => {
      let finals = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0] && r[0].transcript ? r[0].transcript : "";
        if (r.isFinal) finals += t; else interim += t;
      }
      if (finals) srFinals += finals;
      srInterim = interim;
      if (ta && ta.value !== undefined) setTextareaValue(ta, srStartValue + srFinals + srInterim);
      showPreview(srFinals + srInterim);
    };
    rec.onerror = (e) => {
      const err = e && e.error;
      if (err === "not-allowed" || err === "service-not-allowed") toast("麦克风权限被拒绝：请在浏览器地址栏允许麦克风权限后重试");
      else if (err === "network") toast("语音识别服务连不上：请改用 Edge 浏览器（识别走 Azure 更稳定）或检查网络");
      else if (err === "no-speech") toast("没有听到声音，请靠近麦克风再试一次");
      else if (err === "audio-capture") toast("未检测到麦克风设备");
      else if (err !== "aborted") toast("语音识别出错：" + (err || "unknown"));
    };
    rec.onend = () => {
      recognition = null;
      setMicState(btn, "idle");
      hidePreview();
      if (ta && ta.value !== undefined && (srFinals || srInterim)) setTextareaValue(ta, srStartValue + srFinals);
      try { ta && ta.focus(); } catch { /* ignore */ }
    };
    recognition = rec;
    try {
      rec.start();
      setMicState(btn, "starting");
    } catch (e) {
      recognition = null;
      setMicState(btn, "idle");
      hidePreview();
      toast("无法启动语音识别：" + ((e && e.message) || e));
    }
  }

  function createMicButton(ta) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chatvoice-mic-btn";
    btn.dataset.chatvoiceMic = "1";
    btn.innerHTML = MIC_SVG;
    if (!srSupported()) { btn.disabled = true; btn.title = "浏览器不支持语音识别（请使用 Edge 或 Chrome）"; }
    else if (!window.isSecureContext) { btn.disabled = true; btn.title = "非安全上下文无法使用麦克风（请用 http://127.0.0.1:3080 访问）"; }
    else btn.title = "语音输入：点击开始，再次点击停止";
    btn.setAttribute("aria-label", btn.title);
    btn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); toggleMic(ta, btn); });
    return btn;
  }

  /* ══════════════════════════ DOM 注入 ══════════════════════════ */

  /** 在输入框工具条（命令按钮所在行）插入麦克风按钮。 */
  function injectMicButtons() {
    if (!document.body) return;
    document.querySelectorAll("textarea").forEach((ta) => {
      // 找 textarea 所属的 composer card，再找 tools 行（不依赖易变的哈希类名）
      const card = ta.closest("[class*=card]");
      if (!card) return;
      const tools = card.querySelector("[class*=tools]");
      if (!tools) return;
      if (tools.querySelector("[data-chatvoice-mic]")) return;
      tools.insertBefore(createMicButton(ta), tools.firstChild);
    });
  }

  /** 在助手最终回复（带 markdown 的消息块）头部行插入小喇叭按钮。 */
  function injectSpeakers() {
    if (!document.body) return;
    document.querySelectorAll('[data-chat-flow-kind="assistant-step"]').forEach((item) => {
      if (item.querySelector("[data-chatvoice-speak]")) return;
      const mds = item.querySelectorAll("[class*=markdown]");
      if (!mds.length) return;
      const md = mds[mds.length - 1];
      const row = item.querySelector("[data-disclosure-row]") || item.querySelector("[class*=row]");
      if (!row) return;
      const key = item.getAttribute("data-chat-flow-key") || item.getAttribute("data-chat-anchor-key") || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chatvoice-speak-btn";
      btn.dataset.chatvoiceSpeak = "1";
      btn.dataset.key = key;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        speak(extractText(md), key);
      });
      row.appendChild(btn);
      renderSpeaking();
    });
  }

  /** 自动朗读：新回复文本稳定 1.5 秒后朗读一次（可随时打断）。 */
  function autoSpeakScan() {
    if (!cfg.autoSpeak) { pendingAuto.clear(); return; }
    const now = Date.now();
    document.querySelectorAll('[data-chat-flow-kind="assistant-step"]').forEach((item) => {
      const mds = item.querySelectorAll("[class*=markdown]");
      if (!mds.length) return;
      const md = mds[mds.length - 1];
      const key = item.getAttribute("data-chat-flow-key") || item.getAttribute("data-chat-anchor-key") || "";
      if (!key || spokenKeys.has(key)) return;
      const len = (md.innerText || "").length;
      const prev = pendingAuto.get(key);
      if (!prev) { pendingAuto.set(key, { len, since: now }); return; }
      if (len !== prev.len) { pendingAuto.set(key, { len, since: now }); return; }
      if (now - prev.since > 1500 && len > 0) {
        pendingAuto.delete(key);
        spokenKeys.add(key);
        speak(extractText(md), key);
      }
    });
  }

  let scanTimer = null;
  function scan() { injectMicButtons(); injectSpeakers(); }
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 350); }

  function startObserver() {
    const mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, { childList: true, subtree: true });
    // 兜底轮询：覆盖无 mutation 的稳定消息与自动朗读稳定性检测
    setInterval(() => { scan(); autoSpeakScan(); }, 1200);
  }

  /* ══════════════════════════ 配置 ══════════════════════════ */

  function loadConfig() {
    return fetch(CONFIG_URL, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => { if (body && body.value && typeof body.value === "object") Object.assign(cfg, body.value); })
      .catch(() => { /* 路由未挂载时用默认值，静默降级 */ });
  }

  /* ══════════════════════════ 设置页 Section ══════════════════════════ */

  function Section() {
    const [state, setState] = react.useState({ loading: true, value: { ...cfg }, saving: false, saved: false, error: "" });
    react.useEffect(() => {
      let alive = true;
      fetch(CONFIG_URL, { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => {
          if (!alive) return;
          const v = (body && body.value) || {};
          Object.assign(cfg, v);
          setState((s) => ({ ...s, loading: false, value: { ...cfg } }));
        })
        .catch((e) => { if (!alive) return; setState((s) => ({ ...s, loading: false, error: String((e && e.message) || e) })); });
      return () => { alive = false; };
    }, []);

    const set = (k, v) => setState((s) => ({ ...s, value: { ...s.value, [k]: v }, saved: false }));

    const save = () => {
      setState((s) => ({ ...s, saving: true, saved: false, error: "" }));
      fetch(CONFIG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: state.value }),
      })
        .then((r) => r.json())
        .then((body) => {
          if (body && body.ok) {
            Object.assign(cfg, body.value || state.value);
            setState((s) => ({ ...s, saving: false, saved: true, value: { ...cfg } }));
            toast("ChatVoice 设置已保存，立即生效");
          } else {
            setState((s) => ({ ...s, saving: false, error: (body && body.error) || "保存失败" }));
          }
        })
        .catch((e) => setState((s) => ({ ...s, saving: false, error: String((e && e.message) || e) })));
    };

    if (state.loading) return react.createElement("div", { style: { padding: "14px 0" } }, "加载中…");

    const status = (srSupported()
      ? (window.isSecureContext ? "● 语音输入可用（麦克风授权后即可说话输入）" : "○ 非安全上下文：语音输入不可用，朗读仍可用（请用 http://127.0.0.1:3080 访问）")
      : "○ 当前浏览器不支持语音识别（推荐 Edge 或 Chrome），朗读仍可用");

    return react.createElement("div", { style: { padding: "14px 0", maxWidth: 560 } }, [
      react.createElement("div", { key: "t", style: { fontSize: 16, fontWeight: 600, marginBottom: 4 } }, "ChatVoice 语音设置"),
      react.createElement("div", { key: "d", style: { fontSize: 12, opacity: 0.6, marginBottom: 10 } }, "零配置零成本：语音识别与朗读全部由浏览器原生能力提供（推荐 Edge，中文音色与识别最稳）"),
      react.createElement("div", { key: "s", className: "chatvoice-status" }, status),
      react.createElement("div", { key: "f1", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "识别语言 / Recognition language"),
        react.createElement("select", {
          key: "i", className: "chatvoice-input", value: state.value.recognitionLang,
          onChange: (e) => set("recognitionLang", e.target.value),
        }, [
          react.createElement("option", { key: "zh", value: "zh-CN" }, "中文（普通话）zh-CN"),
          react.createElement("option", { key: "en", value: "en-US" }, "English (US) en-US"),
        ]),
      ]),
      react.createElement("div", { key: "f2", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, [
          react.createElement("input", {
            key: "c", type: "checkbox", checked: !!state.value.autoSpeak, style: { marginRight: 6 },
            onChange: (e) => set("autoSpeak", e.target.checked),
          }),
          "自动朗读新回复（可点小喇叭随时停止）",
        ]),
      ]),
      react.createElement("div", { key: "f3", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "音色 / Voice name（留空自动选最佳中文音色）"),
        react.createElement("input", {
          key: "i", type: "text", className: "chatvoice-input", value: state.value.voiceName || "",
          placeholder: "如：Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)",
          onChange: (e) => set("voiceName", e.target.value),
        }),
        react.createElement("div", { key: "h", className: "chatvoice-hint" }, "Edge 内置 Xiaoxiao Online (Natural) 免费中文音色最自然；音色列表随浏览器异步加载，重启页面后可看到"),
      ]),
      react.createElement("div", { key: "f4", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "语速 / Rate（0.5 慢 ~ 2 快）"),
        react.createElement("input", {
          key: "i", type: "number", className: "chatvoice-input", min: 0.5, max: 2, step: 0.1,
          value: state.value.rate, onChange: (e) => set("rate", Number(e.target.value)),
        }),
      ]),
      state.error ? react.createElement("div", { key: "e", className: "chatvoice-error" }, state.error) : null,
      react.createElement("div", { key: "b", style: { marginTop: 12 } }, [
        react.createElement("button", { key: "s", type: "button", className: "chatvoice-save", disabled: state.saving, onClick: save }, state.saving ? "保存中…" : "保存设置"),
        state.saved ? react.createElement("span", { key: "ok", className: "chatvoice-saved" }, "✓ 已保存，立即生效") : null,
      ]),
    ]);
  }

  /* ══════════════════════════ 启动 ══════════════════════════ */

  function boot() {
    injectCss();
    refreshVoices();
    try {
      if (typeof speechSynthesis !== "undefined") {
        if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", refreshVoices);
        speechSynthesis.onvoiceschanged = refreshVoices;
      }
    } catch { /* ignore */ }
    loadConfig();
    scan();
    startObserver();
  }

  function apply(ctx) {
    // 设置页分组（沿用 free-vision 已验证的 slots 注册写法）
    ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "dsh-chatvoice",
      order: 60,
      label: () => "ChatVoice",
      locale: NS,
      inject: () => ({})
    }, () => react.createElement(Section)));

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  exports.name = "dsh-chatvoice";
  exports.inject = ["slots"];
  exports.apply = apply;
  return module.exports;
}});
