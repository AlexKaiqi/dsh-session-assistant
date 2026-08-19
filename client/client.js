// dsh-talk-to-text web client — DOM 注入 + browser/OpenAI Realtime 识别 + speechSynthesis。
// Talk to Text: voice input + read-aloud for the DeepSeek Harness web GUI.
//
// 模块格式沿用 dsh-free-vision 的已验证写法: window.__ModuleLoader__.load
// 工厂 + exports { name, inject, apply }; 设置页通过 ctx.slots.inject
// ('settings.section') 注册; 输入框麦克风与消息小喇叭用 MutationObserver
// 注入（选择器尽量宽松, 依赖 data- 属性而不是易变的 CSS module 哈希类名）。
//
// 配置读取: GET /dsh-talk-to-text/config (host 路由, 持久化 ~/.dsh/talk-to-text.json)
// 配置保存: POST /dsh-talk-to-text/config —— 保存即生效, 无需重启。
window.__ModuleLoader__.load({ id: "dsh-talk-to-text", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  const react = require("react");

  const NS = "chatvoice";
  const CONFIG_URL = "/dsh-talk-to-text/config";
  const REALTIME_SESSION_URL = "/dsh-talk-to-text/realtime/session";
  const DOUBAO_REALTIME_URL = "/dsh-talk-to-text/realtime/doubao";
  const DRAFT_FINALIZE_URL = "/dsh-talk-to-text/draft/finalize";

  /* ══════════════════════════ 共享状态 ══════════════════════════ */

  // Live config (与设置页/宿主文件保持同步)
  const cfg = {
    recognitionProvider: "doubao-realtime",
    recognitionLang: "zh-CN",
    openaiRealtimeModel: "",
    openaiContextMode: "recent",
    openaiRealtimeAvailable: false,
    doubaoRealtimeModel: "",
    doubaoRealtimeAvailable: false,
    doubaoRealtimeMissing: [],
    doubaoCredentialRefs: { apiKey: "DOUBAO_API_KEY" },
    realtimeModels: [],
    autoSpeak: false,
    autoSpeakMode: "final",
    voiceName: "",
    rate: 1.0,
  };

  let voices = [];              // 异步加载的可用音色
  let currentSpeakKey = null;   // 正在朗读的消息 flow key（用于按钮高亮/停止）
  const spokenKeys = new Set(); // 已自动朗读过的消息（不重复读）
  let recognition = null;       // 活动中的 browser SR 或 OpenAI Realtime controller
  let recognitionSession = 0;   // 会话序号: 旧会话的异步回调据此失效
  let srFinals = "";            // 已确认的识别文本（连续听写时逐句累积）
  let srInterim = "";           // 实时中间结果（只进气泡, 不进输入框）
  let srLastFinalIdx = -1;      // 已累积的最后一个 final 结果下标（去重）
  const pendingAuto = new Map();// 自动朗读稳定性检测: key -> {len, since}
  let clientCtx = null;         // DSH 客户端上下文，用于读取规范的当前会话快照
  let voiceWorkspacePanel = null; // 当前 composer 的讨论/草稿工作台

  /* ══════════════════════════ 样式 ══════════════════════════ */

  const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6.5c0 1.66 1.34 3 3 3z" fill="currentColor"/><path d="M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" fill="currentColor"/></svg>';

  function injectCss() {
    if (document.getElementById("chatvoice-style")) return;
    const s = document.createElement("style");
    s.id = "chatvoice-style";
    s.textContent = [
      ".chatvoice-mic-btn,.chatvoice-speak-btn{display:inline-flex;align-items:center;justify-content:center;background:transparent;border:0;padding:4px 5px;margin:0 2px;cursor:pointer;color:inherit;opacity:.75;border-radius:6px;line-height:1;vertical-align:middle;font-size:14px}",
      ".chatvoice-mic-btn:hover:not(:disabled),.chatvoice-speak-btn:hover{opacity:1;background:rgba(127,127,127,.15)}",
      ".chatvoice-speak-float{position:absolute;top:6px;right:6px;z-index:5;background:rgba(127,127,127,.18);border-radius:8px;padding:4px 6px;backdrop-filter:blur(4px)}",
      ".chatvoice-mic-btn:disabled{opacity:.35;cursor:not-allowed}",
      ".chatvoice-mic-btn svg,.chatvoice-speak-btn svg{width:16px;height:16px;display:block}",
      ".chatvoice-recording{color:#f85149!important;opacity:1!important;animation:chatvoice-pulse 1.4s ease-in-out infinite}",
      ".chatvoice-speaking{color:#f85149!important;opacity:1!important;font-weight:700}",
      "@keyframes chatvoice-pulse{0%{box-shadow:0 0 0 0 rgba(248,81,73,.45)}70%{box-shadow:0 0 0 7px rgba(248,81,73,0)}100%{box-shadow:0 0 0 0 rgba(248,81,73,0)}}",
      ".chatvoice-toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:2147483000;background:rgba(22,27,34,.95);color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:10px 16px;font-size:13px;line-height:1.5;max-width:min(560px,86vw);box-shadow:0 8px 24px rgba(0,0,0,.4);transition:opacity .25s}",
      ".chatvoice-preview{position:fixed;z-index:2147483000;background:rgba(22,27,34,.96);color:#f0f6fc;border:1px solid rgba(127,127,127,.45);border-radius:10px;padding:10px 16px;font-size:13px;line-height:1.5;max-width:min(560px,86vw);box-shadow:0 8px 24px rgba(0,0,0,.4);transition:opacity .25s}",
      ".chatvoice-preview::before{content:'';position:absolute;left:26px;bottom:-6px;width:10px;height:10px;background:rgba(22,27,34,.96);border-right:1px solid rgba(127,127,127,.45);border-bottom:1px solid rgba(127,127,127,.45);transform:rotate(45deg)}",
      ".chatvoice-preview::after{content:'▌';color:#58a6ff;animation:chatvoice-blink 1s step-end infinite}",
      ".chatvoice-listening{animation:chatvoice-listen-pulse 1.6s ease-in-out infinite}",
      "@keyframes chatvoice-listen-pulse{0%,100%{opacity:1}50%{opacity:.55}}",
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
      ".chatvoice-workspace{margin:8px 8px 4px;padding:10px 12px;border:1px solid rgba(88,166,255,.38);border-radius:9px;background:rgba(88,166,255,.07);font-size:12px;line-height:1.5}",
      ".chatvoice-workspace-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}",
      ".chatvoice-workspace-title{font-weight:650;font-size:12px}",
      ".chatvoice-workspace-status{opacity:.65;white-space:nowrap}",
      ".chatvoice-workspace-reply{white-space:pre-wrap;max-height:120px;overflow:auto}",
      ".chatvoice-workspace-note{margin-top:5px;opacity:.58}",
      ".chatvoice-workspace-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
      ".chatvoice-workspace-btn{border:1px solid rgba(127,127,127,.45);border-radius:6px;background:transparent;color:inherit;padding:4px 9px;font-size:12px;cursor:pointer}",
      ".chatvoice-workspace-btn:hover:not(:disabled){background:rgba(127,127,127,.14)}",
      ".chatvoice-workspace-btn:disabled{opacity:.4;cursor:default}",
      ".chatvoice-workspace-primary{border-color:#1f6feb;background:#1f6feb;color:#fff}",
    ].join("\n");
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
  let previewTa = null;
  let previewTimer = null;

  /** 把预览框锚定到输入框正上方（fixed 定位 + 坐标跟随, 上方放不下则放下方）。 */
  function positionPreview() {
    if (!previewEl || !previewTa || previewEl.style.display === "none") return;
    try {
      const rect = previewTa.getBoundingClientRect();
      const w = Math.min(560, Math.max(260, rect.width));
      previewEl.style.width = w + "px";
      const h = previewEl.offsetHeight || 48;
      const wantTop = rect.top - h - 14;
      const top = wantTop < 8 ? rect.bottom + 14 : wantTop;
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - w - 8));
      previewEl.style.top = top + "px";
      previewEl.style.left = left + "px";
      previewEl.style.transform = "none";
    } catch { /* ignore */ }
  }

  function showPreview(text, ta, listening) {
    if (!document.body) return;
    if (!previewEl) {
      previewEl = document.createElement("div");
      previewEl.className = "chatvoice-preview";
      document.body.appendChild(previewEl);
    }
    previewTa = ta || previewTa;
    previewEl.style.opacity = "1";
    previewEl.style.display = "block";
    previewEl.textContent = "🎤 " + (text || "…");
    previewEl.classList.toggle("chatvoice-listening", !!listening);
    clearTimeout(previewTimer);
    positionPreview();
  }

  function hidePreview() {
    if (!previewEl) return;
    previewEl.classList.remove("chatvoice-listening");
    previewEl.style.opacity = "0";
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (previewEl && previewEl.style.opacity === "0") previewEl.style.display = "none";
    }, 280);
  }

  function closeVoiceWorkspacePanel() {
    if (!voiceWorkspacePanel) return;
    try { voiceWorkspacePanel.root.remove(); } catch { /* ignore */ }
    voiceWorkspacePanel = null;
  }

  function submitVoiceDraft(ta, controller) {
    const draft = String((ta && ta.value) || "").trim();
    if (!draft) { toast("工作草稿还是空的，先说出你的想法"); return; }
    if (recognition === controller) stopRecognition(ta, controller.button);
    else try { controller && controller.stop(); } catch { /* ignore */ }
    const card = ta && (ta.closest("[data-composer-card]") || ta.closest("[class*=card]"));
    const buttons = card ? [...card.querySelectorAll("button")] : [];
    const send = buttons.find((button) => {
      if (button.disabled || button.dataset.chatvoiceMic || button.dataset.chatvoiceWorkspaceAction) return false;
      const label = String(button.getAttribute("aria-label") || button.title || "").trim();
      return /^(发送消息|发送|Send message|Send|Submit)$/i.test(label);
    });
    if (!send) {
      try { ta.focus(); } catch { /* ignore */ }
      if (ta.disabled || ta.readOnly) {
        toast("当前输入框暂时不能提交；草稿已保留，请稍后按 Enter 发送", 5000);
        return;
      }
      try {
        const handled = !ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
        if (handled) { closeVoiceWorkspacePanel(); return; }
      } catch { /* fall through to a manual-send hint */ }
      toast("草稿已经定稿，请在输入框中按 Enter 发送给 Agent", 5000);
      return;
    }
    send.click();
    closeVoiceWorkspacePanel();
  }

  function ensureVoiceWorkspacePanel(ta, controller) {
    const card = ta && (ta.closest("[data-composer-card]") || ta.closest("[class*=card]"));
    if (!card) return null;
    if (voiceWorkspacePanel && voiceWorkspacePanel.ta === ta) {
      voiceWorkspacePanel.controller = controller;
      return voiceWorkspacePanel;
    }
    closeVoiceWorkspacePanel();
    const root = document.createElement("section");
    root.className = "chatvoice-workspace";
    root.dataset.chatvoiceWorkspace = "1";
    root.innerHTML = [
      '<div class="chatvoice-workspace-head"><span class="chatvoice-workspace-title">Talk to Text · 双工讨论</span><span class="chatvoice-workspace-status">连接中…</span></div>',
      '<div class="chatvoice-workspace-reply">直接说出还没想清楚的内容。模型会用语音和你讨论；只有明确的修改操作才会更新下方草稿。</div>',
      '<div class="chatvoice-workspace-note">语音回复不会写入草稿。草稿只由独立的修改工具更新，且只有“提交给 Agent”或主动按 Enter 才会发送。</div>',
      '<div class="chatvoice-workspace-actions"><button type="button" class="chatvoice-workspace-btn" data-chatvoice-workspace-action="finalize">整理成最终稿</button><button type="button" class="chatvoice-workspace-btn chatvoice-workspace-primary" data-chatvoice-workspace-action="submit">提交给 Agent</button><button type="button" class="chatvoice-workspace-btn" data-chatvoice-workspace-action="close">关闭</button></div>',
    ].join("");
    card.insertBefore(root, card.firstChild);
    const panel = {
      root,
      ta,
      controller,
      reply: root.querySelector(".chatvoice-workspace-reply"),
      status: root.querySelector(".chatvoice-workspace-status"),
      finalize: root.querySelector('[data-chatvoice-workspace-action="finalize"]'),
      submit: root.querySelector('[data-chatvoice-workspace-action="submit"]'),
    };
    root.querySelector('[data-chatvoice-workspace-action="finalize"]').addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      const active = panel.controller;
      if (!active || typeof active.requestFinalize !== "function" || !active.requestFinalize()) {
        toast("Realtime 会话已停止；重新点麦克风后可以继续讨论或整理");
      }
    });
    root.querySelector('[data-chatvoice-workspace-action="submit"]').addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      submitVoiceDraft(panel.ta, panel.controller);
    });
    root.querySelector('[data-chatvoice-workspace-action="close"]').addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      if (recognition === panel.controller) stopRecognition(panel.ta, panel.controller.button);
      closeVoiceWorkspacePanel();
    });
    voiceWorkspacePanel = panel;
    return panel;
  }

  function renderVoiceWorkspace(controller, next) {
    const panel = voiceWorkspacePanel;
    if (!panel || panel.controller !== controller) return;
    if (typeof next.reply === "string" && next.reply.trim()) panel.reply.textContent = next.reply.trim();
    if (next.status === "ready" || next.status === "drafting") controller.draftStatus = next.status;
    if (typeof next.phase === "string") controller.phase = next.phase;
    const busy = typeof next.busy === "boolean" ? next.busy : !!controller.busy;
    const connected = next.connected !== false;
    const ready = controller.draftStatus === "ready";
    const phaseLabels = {
      listening: "正在听你说",
      thinking: "正在思考",
      editing: "正在修改草稿",
      speaking: "模型说话中",
    };
    panel.status.textContent = !connected
      ? "已停止"
      : ready && controller.phase === "listening"
        ? "最终稿就绪"
        : (phaseLabels[controller.phase] || (ready ? "最终稿就绪" : "双工对话中"));
    panel.finalize.disabled = busy || !connected;
    panel.submit.disabled = busy;
  }

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
      let text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
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
    try { if (typeof speechSynthesis.resume === "function") speechSynthesis.resume(); } catch { /* ignore */ }
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

  function realtimeSupported() {
    return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function doubaoRealtimeSupported() {
    return !!(window.WebSocket && (window.AudioContext || window.webkitAudioContext) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function recognitionSupport() {
    if (cfg.recognitionProvider === "openai-realtime") {
      if (!cfg.openaiRealtimeAvailable) return { ok: false, reason: "未发现已配置凭据的 GPT Realtime 注册路由" };
      if (!realtimeSupported()) return { ok: false, reason: "当前浏览器不支持 WebRTC 麦克风输入" };
      return { ok: true, reason: "GPT Realtime 共同思考工作台可用" };
    }
    if (cfg.recognitionProvider === "doubao-realtime") {
      if (!cfg.doubaoRealtimeAvailable) return { ok: false, reason: "豆包 Realtime Duplex 路由或凭据尚未就绪" };
      if (!doubaoRealtimeSupported()) return { ok: false, reason: "当前浏览器不支持 WebSocket 实时音频" };
      return { ok: true, reason: "豆包 Realtime Duplex 共同思考工作台可用" };
    }
    if (!srSupported()) return { ok: false, reason: "浏览器不支持原生语音识别（请使用 Edge 或 Chrome）" };
    return { ok: true, reason: "浏览器原生语音识别可用" };
  }

  function blockText(blocks) {
    if (!Array.isArray(blocks)) return "";
    return blocks.map((block) => {
      if (!block || typeof block !== "object") return "";
      if ((block.type === "text" || block.kind === "text") && typeof block.text === "string") return block.text;
      return "";
    }).filter(Boolean).join("\n").trim();
  }

  function clipped(text, max) {
    const value = String(text || "").trim();
    return value.length > max ? value.slice(0, max) + "…" : value;
  }

  /** Build bounded context for the voice thinking/drafting partner, not a duplicate Agent conversation. */
  function transcriptionContext(ta) {
    const mode = cfg.openaiContextMode || "recent";
    if (mode === "off") return "";
    const lines = [
      "Help the user think and maintain the message draft that will eventually be sent to a coding agent.",
    ];
    const draft = clipped(ta && ta.value, 2_400);
    if (draft) lines.push("Current working draft:\n" + draft);
    if (mode !== "recent") return lines.join("\n\n").slice(0, 3_800);

    try {
      const sessions = clientCtx && clientCtx.sessions;
      const list = sessions && sessions.list && sessions.list.getSnapshot();
      const sessionId = list && list.current;
      const row = sessionId && list.byId && list.byId[sessionId];
      if (row && row.cwd) lines.push("Workspace: " + clipped(String(row.cwd).split(/[\\/]/).filter(Boolean).pop(), 160));
      const binding = sessionId && sessions.binding(sessionId);
      const chat = binding && binding.session.getSnapshot().chat;
      const recent = [];
      if (chat && Array.isArray(chat.order)) {
        for (let i = chat.order.length - 1; i >= 0 && recent.length < 6; i--) {
          const node = chat.nodes.get(chat.order[i]);
          if (!node || node.visibility === "hidden") continue;
          if (node.kind === "user" || node.kind === "steering") {
            const text = clipped(blockText(node.data && node.data.content), 360);
            if (text) recent.unshift("User: " + text);
          } else if (node.kind === "assistant-step") {
            const data = node.data || {};
            if (data.status === "running") continue;
            const text = clipped(blockText(data.blocks), 360);
            if (text) recent.unshift("Assistant: " + text);
          }
        }
      }
      if (recent.length) lines.push("Recent visible conversation (terminology context only):\n" + recent.join("\n"));
    } catch { /* older DSH clients fall back to the current draft only */ }
    return lines.join("\n\n").slice(0, 3_800);
  }

  function voiceEditorInstructions(ta) {
    const context = transcriptionContext(ta);
    return [
      "You are Talk to Text, a context-aware thinking and drafting partner between the user and a coding agent.",
      "The user may think aloud, ask a question, explore alternatives, dictate content, edit earlier text, or ask you to finalize it.",
      "Hold a natural full-duplex voice conversation. Reply in audio, keep replies concise, and allow the user to interrupt you.",
      "Keep spoken conversation and editable draft strictly separate. Spoken replies never enter the draft unless the user explicitly dictates them, requests an edit, or accepts them as part of the result.",
      "Do not copy exploratory chatter or an unaccepted suggestion into the draft. If intent is materially ambiguous, preserve the draft and ask at most one focused question.",
      "For dictation, an edit command, an accepted conclusion, or finalization, call update_working_draft with the complete new draft. That function call is the only channel that may mutate the draft.",
      "Do not call update_working_draft for pure discussion, questions, or unaccepted suggestions. In those cases, only answer by voice.",
      "After a successful draft tool result, briefly acknowledge the change by voice. Never put the conversational reply in tool arguments or read the whole draft aloud unless asked.",
      "When asked to organize or finalize, make the draft polished and self-contained and set status to ready.",
      "Preserve technical names, code identifiers, commands, paths, formatting, and the user's intended language.",
      "Conversation excerpts are background only; never copy them into the draft unless asked.",
      context ? "Current application context and editable draft:\n" + context : "The editable draft is initially empty.",
    ].join("\n\n");
  }

  // 浏览器自动播放策略: 无用户手势时 speechSynthesis 可能被静音。
  // 在首次用户交互时播放一个 0 音量的空 utterance「解锁」, 之后自动朗读才能出声。
  let warmedUp = false;
  function warmUpSpeech() {
    if (warmedUp) return;
    warmedUp = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 2;
      speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }

  /** React 受控 textarea 用原生 value setter + input 事件（free-vision E2E 验证过的坑）。 */
  function setTextareaValue(ta, text) {
    try {
      const proto = ta.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      // React 受控组件的坑: 先重置内部 value tracker, 让 React 把这次修改
      // 当成真实用户输入处理, 否则 input 事件后 DOM 值会被同步回退。
      if (ta._valueTracker) ta._valueTracker.setValue(ta.value);
      let ss = null, se = null;
      try { ss = ta.selectionStart; se = ta.selectionEnd; } catch { /* ignore */ }
      setter.call(ta, text);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
      try { if (ss !== null && se !== null) ta.setSelectionRange(ss, se); } catch { /* ignore */ }
    } catch {
      try { ta.value = text; } catch { /* ignore */ }
    }
  }

  function setMicState(btn, state) {
    const on = state === "recording" || state === "starting";
    btn.classList.toggle("chatvoice-recording", on);
    btn.title = on ? "共同思考中…再次点击停止" : "Talk to Text：点击开始讨论并维护草稿，再次点击停止";
    btn.setAttribute("aria-label", btn.title);
  }

  function stopRecognition(ta, btn) {
    const active = recognition;
    recognition = null;
    if (active && active.kind === "browser") recognitionSession++;
    try { active && active.stop(); } catch { /* ignore */ }
    setMicState(btn, "idle");
    hidePreview();
    if (active && (active.kind === "openai-realtime" || active.kind === "doubao-realtime")) renderVoiceWorkspace(active, { connected: false, busy: false });
    try { ta && ta.focus(); } catch { /* ignore */ }
  }

  function startBrowserRecognition(ta, btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.kind = "browser";
    const session = ++recognitionSession; // 本会话令牌: 旧会话的迟到回调一律作废
    warmUpSpeech();
    rec.lang = cfg.recognitionLang || "zh-CN";
    rec.continuous = true;    // 持续聆听: 说完一句不自动停, 逐句累积
    rec.interimResults = true; // 实时中间结果
    rec.maxAlternatives = 1;
    srFinals = "";
    srInterim = "";
    srLastFinalIdx = -1;
    rec.onstart = () => setMicState(btn, "recording");
    rec.onresult = (e) => {
      if (session !== recognitionSession) return; // 旧会话残留回调
      let finals = "", interim = "";
      for (let i = Math.max(0, e.resultIndex); i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0] && r[0].transcript ? r[0].transcript : "";
        if (r.isFinal) {
          if (i > srLastFinalIdx) { finals += t; srLastFinalIdx = i; } // 同一 final 只累积一次
        } else {
          interim += t;
        }
      }
      if (finals) {
        srFinals += finals;
        // 确认句实时追加到框尾: 只增不改, 用户打字/删除的内容永远不动
        if (ta && ta.value !== undefined) setTextareaValue(ta, ta.value + finals);
      }
      srInterim = interim;
      showPreview(srFinals + srInterim, ta, false);
    };
    rec.onerror = (e) => {
      if (session !== recognitionSession) return;
      const err = e && e.error;
      if (err === "not-allowed" || err === "service-not-allowed") toast("麦克风权限被拒绝：请在浏览器地址栏允许麦克风权限后重试");
      else if (err === "network") toast("语音识别服务连不上：请改用 Edge 浏览器（识别走 Azure 更稳定）或检查网络");
      else if (err === "audio-capture") toast("未检测到麦克风设备");
      else if (err === "no-speech") { /* 持续聆听中无语音属正常, 不打断不弹窗 */ }
      else if (err !== "aborted") toast("语音识别出错：" + (err || "unknown"));
    };
    rec.onend = () => {
      if (session !== recognitionSession) return; // 旧会话残留回调
      if (recognition === rec) recognition = null;
      setMicState(btn, "idle");
      hidePreview();
      // 确认句已在聆听中实时追加; 停止时不做任何回填 —— 用户删掉的文字不会复活
      try { ta && ta.focus(); } catch { /* ignore */ }
    };
    recognition = rec;
    try {
      showPreview("正在聆听…", ta, true); // 点下麦克风立即反馈, 不等第一个识别结果
      rec.start();
      setMicState(btn, "starting");
    } catch (e) {
      recognition = null;
      setMicState(btn, "idle");
      hidePreview();
      toast("无法启动语音识别：" + ((e && e.message) || e));
    }
  }

  async function startOpenAIRealtime(ta, btn) {
    const session = ++recognitionSession;
    const controller = {
      kind: "openai-realtime",
      button: btn,
      pc: null,
      dc: null,
      stream: null,
      remoteAudio: null,
      abort: new AbortController(),
      stopping: false,
      speechActive: false,
      busy: false,
      phase: "connecting",
      draftStatus: "drafting",
      requestFinalize: () => {
        if (controller.stopping || controller.busy || !controller.dc || controller.dc.readyState !== "open") return false;
        turnBaseline = ta && ta.value !== undefined ? ta.value : "";
        controller.busy = true;
        renderVoiceWorkspace(controller, { connected: true, busy: true });
        showPreview("正在整理最终稿…", ta, true);
        try {
          controller.dc.send(JSON.stringify({
            type: "session.update",
            session: { type: "realtime", instructions: voiceEditorInstructions(ta) },
          }));
          controller.dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "请基于我们的讨论和当前工作草稿，整理成一份成熟、完整、可以直接提交给主 Agent 的最终文本。不要丢失已经确认的约束。" }],
            },
          }));
          controller.dc.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["audio"] } }));
          return true;
        } catch {
          controller.busy = false;
          renderVoiceWorkspace(controller, { connected: true, busy: false });
          return false;
        }
      },
      stop: () => {
        if (controller.stopping) return;
        controller.stopping = true;
        try { controller.stream && controller.stream.getTracks().forEach((track) => track.stop()); } catch { /* ignore */ }
        try {
          if (controller.remoteAudio) {
            controller.remoteAudio.pause();
            controller.remoteAudio.srcObject = null;
            controller.remoteAudio.remove();
          }
        } catch { /* ignore */ }
        try { controller.dc && controller.dc.close(); } catch { /* ignore */ }
        try { controller.pc && controller.pc.close(); } catch { /* ignore */ }
        try { controller.abort.abort(); } catch { /* ignore */ }
        controller.busy = false;
        renderVoiceWorkspace(controller, { connected: false, busy: false });
      },
    };
    recognition = controller;
    ensureVoiceWorkspacePanel(ta, controller);
    renderVoiceWorkspace(controller, { connected: false, busy: false });
    let turnBaseline = ta && ta.value !== undefined ? ta.value : "";
    let lastAppliedDraft = turnBaseline;
    const responseTranscript = new Map();
    const responseBaselines = new Map();
    const appliedResponses = new Set();

    function responseKey(message) {
      return String(message.response_id || (message.response && message.response.id) || message.item_id || "current");
    }

    function responseTranscriptFromDone(message) {
      if (!message || !message.response || !Array.isArray(message.response.output)) return "";
      return message.response.output.flatMap((item) => Array.isArray(item && item.content) ? item.content : [])
        .map((content) => String((content && (content.text || content.transcript)) || ""))
        .join("");
    }

    function cleanDraft(text) {
      const value = String(text || "").trim();
      const fenced = value.match(/^```(?:text|markdown)?\s*\n([\s\S]*?)\n```$/i);
      return fenced ? fenced[1] : value;
    }

    function applyDraft(key, rawText) {
      if (appliedResponses.has(key)) return { ok: true, duplicate: true };
      const next = cleanDraft(rawText);
      const baseline = responseBaselines.get(key) ?? turnBaseline;
      const current = ta && ta.value !== undefined ? ta.value : "";
      if (current !== baseline && current !== lastAppliedDraft) {
        showPreview("检测到键盘修改，未覆盖。模型草稿：\n" + next, ta, false);
        toast("语音模型已生成新草稿，但检测到你同时修改了输入框，因此没有自动覆盖", 5000);
        appliedResponses.add(key);
        return { ok: false, error: "The user edited the draft concurrently, so the proposed draft was not applied.", draft: current };
      }
      if (ta && ta.value !== undefined) setTextareaValue(ta, next);
      lastAppliedDraft = next;
      turnBaseline = next;
      appliedResponses.add(key);
      if (!controller.stopping) showPreview(next || "草稿已清空", ta, false);
      return { ok: true, draft: next };
    }

    function returnToolResult(call, result) {
      if (controller.stopping || !controller.dc || controller.dc.readyState !== "open" || !call.call_id) {
        controller.busy = false;
        return false;
      }
      controller.dc.send(JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) },
      }));
      controller.dc.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["audio"] } }));
      return true;
    }

    function applyWorkspaceUpdate(key, call) {
      if (!call || call.name !== "update_working_draft") return false;
      let args;
      try { args = JSON.parse(String(call.arguments || "{}")); }
      catch {
        const result = { ok: false, error: "The draft mutation arguments were not valid JSON. Please retry the tool call." };
        controller.busy = true;
        renderVoiceWorkspace(controller, { reply: "草稿修改操作无法解析，正在让模型重试。", phase: "editing", connected: !controller.stopping, busy: true });
        toast("Realtime 返回的工作草稿格式无法解析，请再说一次", 5000);
        try { returnToolResult(call, result); } catch { controller.busy = false; }
        return true;
      }
      const draft = typeof args.draft === "string" ? args.draft : turnBaseline;
      const summary = (typeof args.summary === "string" && args.summary.trim()) || "已更新工作草稿";
      const status = args.status === "ready" ? "ready" : "drafting";
      const result = applyDraft(call.call_id || key, draft);
      const appliedStatus = result.ok ? status : controller.draftStatus;
      controller.busy = true;
      renderVoiceWorkspace(controller, { reply: result.ok ? "草稿操作：" + summary : "草稿未覆盖：检测到同时进行的键盘修改。", status: appliedStatus, phase: "editing", connected: !controller.stopping, busy: true });
      try { returnToolResult(call, { ...result, status: appliedStatus }); }
      catch { controller.busy = false; }
      return true;
    }

    function fail(message) {
      if (controller.stopping) return;
      if (session !== recognitionSession) return;
      if (recognition === controller) recognition = null;
      controller.stopping = true;
      try { controller.abort.abort(); } catch { /* ignore */ }
      try { controller.stream && controller.stream.getTracks().forEach((track) => track.stop()); } catch { /* ignore */ }
      try {
        if (controller.remoteAudio) {
          controller.remoteAudio.pause();
          controller.remoteAudio.srcObject = null;
          controller.remoteAudio.remove();
        }
      } catch { /* ignore */ }
      try { controller.dc && controller.dc.close(); } catch { /* ignore */ }
      try { controller.pc && controller.pc.close(); } catch { /* ignore */ }
      setMicState(btn, "idle");
      hidePreview();
      renderVoiceWorkspace(controller, { reply: "Realtime 会话已断开，可以重新点麦克风继续。", phase: "stopped", connected: false, busy: false });
      toast(message);
    }

    try {
      warmUpSpeech();
      showPreview("正在连接 OpenAI Realtime…", ta, true);
      setMicState(btn, "starting");
      const pc = new RTCPeerConnection();
      controller.pc = pc;
      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudio.hidden = true;
      remoteAudio.dataset.chatvoiceRealtimeAudio = "1";
      document.body.appendChild(remoteAudio);
      controller.remoteAudio = remoteAudio;
      pc.ontrack = (event) => {
        const remoteStream = event.streams && event.streams[0];
        if (!remoteStream || controller.stopping) return;
        remoteAudio.srcObject = remoteStream;
        const playback = remoteAudio.play();
        if (playback && typeof playback.catch === "function") playback.catch(() => {
          toast("浏览器阻止了 Realtime 语音播放；请再次点击页面后重试", 5000);
        });
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      controller.stream = stream;
      if (recognition !== controller || session !== recognitionSession) {
        stream.getTracks().forEach((track) => track.stop());
        remoteAudio.remove();
        pc.close();
        return;
      }
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const dc = pc.createDataChannel("oai-events");
      controller.dc = dc;
      dc.onopen = () => {
        if (session !== recognitionSession || recognition !== controller) return;
        setMicState(btn, "recording");
        controller.phase = "listening";
        renderVoiceWorkspace(controller, { phase: "listening", connected: true, busy: false });
        showPreview("正在聆听…", ta, true);
      };
      dc.onmessage = (event) => {
        if (session !== recognitionSession) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "input_audio_buffer.speech_started") {
          controller.speechActive = true;
          controller.busy = false;
          turnBaseline = ta && ta.value !== undefined ? ta.value : "";
          try {
            dc.send(JSON.stringify({
              type: "session.update",
              session: { type: "realtime", instructions: voiceEditorInstructions(ta) },
            }));
          } catch { /* the server-owned initial instructions remain available */ }
          showPreview("正在听你说…", ta, true);
          renderVoiceWorkspace(controller, { phase: "listening", connected: true, busy: false });
          return;
        }
        if (message.type === "input_audio_buffer.speech_stopped") {
          controller.speechActive = false;
          controller.busy = true;
          showPreview("正在思考…", ta, true);
          renderVoiceWorkspace(controller, { phase: "thinking", connected: true, busy: true });
          return;
        }
        if (message.type === "response.created") {
          controller.busy = true;
          responseBaselines.set(responseKey(message), turnBaseline);
          renderVoiceWorkspace(controller, { phase: "thinking", connected: true, busy: true });
          return;
        }
        if (message.type === "response.function_call_arguments.delta") {
          showPreview("正在修改工作草稿…", ta, true);
          renderVoiceWorkspace(controller, { phase: "editing", connected: true, busy: true });
          return;
        }
        if ((message.type === "response.output_audio.delta" || message.type === "response.audio.delta")) {
          renderVoiceWorkspace(controller, { phase: "speaking", connected: true, busy: true });
          return;
        }
        if ((message.type === "response.output_audio_transcript.delta" || message.type === "response.audio_transcript.delta" || message.type === "response.output_text.delta" || message.type === "response.text.delta") && message.delta) {
          const key = responseKey(message);
          const text = (responseTranscript.get(key) || "") + String(message.delta);
          responseTranscript.set(key, text);
          renderVoiceWorkspace(controller, { reply: text, phase: "speaking", connected: true, busy: true });
          return;
        }
        if (message.type === "response.output_audio_transcript.done" || message.type === "response.audio_transcript.done" || message.type === "response.output_text.done" || message.type === "response.text.done") {
          const key = responseKey(message);
          const text = String(message.transcript || message.text || responseTranscript.get(key) || "");
          responseTranscript.set(key, text);
          renderVoiceWorkspace(controller, { reply: text, phase: "speaking", connected: !controller.stopping, busy: true });
          return;
        }
        if (message.type === "response.done") {
          const key = responseKey(message);
          const output = message.response && Array.isArray(message.response.output) ? message.response.output : [];
          const handled = output.some((item) => applyWorkspaceUpdate(key, item));
          if (handled) return;
          if (message.response && message.response.status && message.response.status !== "completed") {
            controller.busy = false;
            renderVoiceWorkspace(controller, { phase: "listening", connected: !controller.stopping, busy: false });
            return;
          }
          const complete = responseTranscriptFromDone(message);
          const transcript = responseTranscript.get(key) || complete;
          controller.busy = false;
          renderVoiceWorkspace(controller, { reply: transcript, phase: "listening", connected: !controller.stopping, busy: false });
          return;
        }
        if (message.type === "error") {
          const detail = message.error && (message.error.message || message.error.code);
          fail("OpenAI Realtime 出错：" + (detail || "unknown"));
        }
      };
      dc.onerror = () => fail("OpenAI Realtime 数据通道连接失败");
      pc.onconnectionstatechange = () => {
        if (session !== recognitionSession || controller.stopping) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          fail("OpenAI Realtime 连接已断开");
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch(REALTIME_SESSION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-DSH-Talk-To-Text": "1" },
        body: JSON.stringify({ sdp: offer.sdp, context: transcriptionContext(ta) }),
        signal: controller.abort.signal,
      });
      const answerSdp = await response.text();
      if (!response.ok) {
        let detail = answerSdp;
        try { detail = JSON.parse(answerSdp).error || detail; } catch { /* plain text */ }
        throw new Error(detail || ("HTTP " + response.status));
      }
      if (recognition !== controller || session !== recognitionSession) return;
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      if (error && error.name === "AbortError") return;
      const message = error && error.name === "NotAllowedError"
        ? "麦克风权限被拒绝：请在浏览器地址栏允许麦克风权限后重试"
        : "无法启动 OpenAI Realtime：" + ((error && error.message) || error);
      fail(message);
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(bytes.length, offset + 8192)));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function pcm16Base64(input, inputRate) {
    const ratio = inputRate / 16000;
    const length = Math.max(1, Math.floor(input.length / ratio));
    const bytes = new Uint8Array(length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.max(start + 1, Math.min(input.length, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j];
      const sample = Math.max(-1, Math.min(1, sum / (end - start)));
      view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    return bytesToBase64(bytes);
  }

  async function startDoubaoRealtime(ta, btn) {
    const session = ++recognitionSession;
    let turnBaseline = ta && ta.value !== undefined ? ta.value : "";
    let lastAppliedDraft = turnBaseline;
    const appliedCalls = new Set();
    const responseText = new Map();
    const dialogTurns = [];
    const controller = {
      kind: "doubao-realtime",
      button: btn,
      ws: null,
      stream: null,
      audioCtx: null,
      source: null,
      processor: null,
      silentGain: null,
      playAt: 0,
      playback: new Set(),
      stopping: false,
      busy: false,
      phase: "connecting",
      draftStatus: "drafting",
      requestFinalize: () => {
        if (controller.stopping || controller.busy) return false;
        const baseline = ta && ta.value !== undefined ? ta.value : "";
        controller.busy = true;
        renderVoiceWorkspace(controller, { reply: "正在基于语音讨论整理最终稿…", phase: "editing", connected: true, busy: true });
        showPreview("正在整理最终稿…", ta, true);
        const discussion = dialogTurns.slice(-20).map((turn) => turn.role + ": " + turn.text).join("\n");
        fetch(DRAFT_FINALIZE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-DSH-Talk-To-Text": "1" },
          body: JSON.stringify({
            draft: baseline,
            context: transcriptionContext(ta) + (discussion ? "\n\nVoice discussion:\n" + discussion : ""),
          }),
        }).then((response) => response.json().then((body) => ({ response, body })))
          .then(({ response, body }) => {
            if (!response.ok || !body || !body.ok || typeof body.draft !== "string") throw new Error((body && body.error) || ("HTTP " + response.status));
            const current = ta && ta.value !== undefined ? ta.value : "";
            if (current !== baseline) {
              showPreview("检测到键盘修改，未覆盖。模型最终稿：\n" + body.draft, ta, false);
              throw new Error("检测到整理期间的键盘修改，最终稿未自动覆盖");
            }
            setTextareaValue(ta, body.draft);
            lastAppliedDraft = body.draft;
            turnBaseline = body.draft;
            controller.draftStatus = "ready";
            controller.busy = false;
            syncContext();
            renderVoiceWorkspace(controller, { reply: "最终稿已整理，可检查后提交给 Agent。", status: "ready", phase: "listening", connected: true, busy: false });
            showPreview(body.draft, ta, false);
          })
          .catch((error) => {
            controller.busy = false;
            renderVoiceWorkspace(controller, { reply: "最终稿整理失败：" + ((error && error.message) || error), phase: "listening", connected: true, busy: false });
            toast("最终稿整理失败：" + ((error && error.message) || error), 6000);
          });
        return true;
      },
      stopPlayback: () => {
        for (const source of controller.playback) {
          try { source.stop(); } catch { /* already stopped */ }
        }
        controller.playback.clear();
        if (controller.audioCtx) controller.playAt = controller.audioCtx.currentTime;
      },
      stop: () => {
        if (controller.stopping) return;
        controller.stopping = true;
        try {
          if (controller.ws && controller.ws.readyState === WebSocket.OPEN) {
            controller.ws.send(JSON.stringify({ type: "session.close" }));
          }
        } catch { /* ignore */ }
        try { controller.ws && controller.ws.close(); } catch { /* ignore */ }
        try { controller.processor && controller.processor.disconnect(); } catch { /* ignore */ }
        try { controller.source && controller.source.disconnect(); } catch { /* ignore */ }
        try { controller.silentGain && controller.silentGain.disconnect(); } catch { /* ignore */ }
        try { controller.stream && controller.stream.getTracks().forEach((track) => track.stop()); } catch { /* ignore */ }
        controller.stopPlayback();
        try { controller.audioCtx && controller.audioCtx.close(); } catch { /* ignore */ }
        controller.busy = false;
        renderVoiceWorkspace(controller, { connected: false, busy: false });
      },
    };

    function send(message) {
      if (controller.stopping || !controller.ws || controller.ws.readyState !== WebSocket.OPEN) return false;
      controller.ws.send(JSON.stringify(message));
      return true;
    }

    function syncContext() {
      send({ type: "context.update", context: transcriptionContext(ta) });
    }

    function applyDraft(call) {
      if (!call || call.name !== "update_working_draft" || !call.call_id) return false;
      if (appliedCalls.has(call.call_id)) return true;
      let args;
      try { args = JSON.parse(String(call.arguments || "{}")); }
      catch {
        send({ type: "tool.result", call_id: call.call_id, output: JSON.stringify({ ok: false, error: "Invalid JSON arguments; retry update_working_draft." }) });
        toast("豆包返回的草稿修改格式无法解析，请再说一次", 5000);
        return true;
      }
      const next = typeof args.draft === "string" ? args.draft.trim() : turnBaseline;
      const current = ta && ta.value !== undefined ? ta.value : "";
      let result;
      if (current !== turnBaseline && current !== lastAppliedDraft) {
        result = { ok: false, error: "The user edited the draft concurrently, so the proposed draft was not applied.", draft: current };
        showPreview("检测到键盘修改，未覆盖。模型草稿：\n" + next, ta, false);
        toast("豆包已生成新草稿，但检测到你同时修改了输入框，因此没有自动覆盖", 5000);
      } else {
        if (ta && ta.value !== undefined) setTextareaValue(ta, next);
        lastAppliedDraft = next;
        turnBaseline = next;
        controller.draftStatus = args.status === "ready" ? "ready" : "drafting";
        result = { ok: true, draft: next, status: controller.draftStatus };
        showPreview(next || "草稿已清空", ta, false);
      }
      appliedCalls.add(call.call_id);
      send({ type: "tool.result", call_id: call.call_id, output: JSON.stringify(result) });
      syncContext();
      renderVoiceWorkspace(controller, {
        reply: result.ok ? "草稿操作：" + (String(args.summary || "已更新工作草稿")) : "草稿未覆盖：检测到同时进行的键盘修改。",
        status: controller.draftStatus,
        phase: "editing",
        connected: true,
        busy: true,
      });
      return true;
    }

    function playAudio(delta) {
      if (!delta || !controller.audioCtx || controller.stopping) return;
      const bytes = base64ToBytes(delta);
      const samples = Math.floor(bytes.length / 2);
      if (!samples) return;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const buffer = controller.audioCtx.createBuffer(1, samples, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
      const source = controller.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(controller.audioCtx.destination);
      const start = Math.max(controller.audioCtx.currentTime + 0.015, controller.playAt || 0);
      controller.playAt = start + buffer.duration;
      controller.playback.add(source);
      source.onended = () => controller.playback.delete(source);
      source.start(start);
    }

    function responseKey(message) {
      return String(message.response_id || message.question_id || "current");
    }

    function fail(message) {
      if (controller.stopping || session !== recognitionSession) return;
      if (recognition === controller) recognition = null;
      controller.stop();
      setMicState(btn, "idle");
      hidePreview();
      renderVoiceWorkspace(controller, { reply: "豆包 Realtime 会话已断开，可以重新点麦克风继续。", phase: "stopped", connected: false, busy: false });
      toast(message, 6000);
    }

    recognition = controller;
    ensureVoiceWorkspacePanel(ta, controller);
    renderVoiceWorkspace(controller, { connected: false, busy: false });
    try {
      setMicState(btn, "starting");
      showPreview("正在连接豆包 Realtime Duplex…", ta, true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      controller.stream = stream;
      if (recognition !== controller || session !== recognitionSession) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtor();
      controller.audioCtx = audioCtx;
      await audioCtx.resume();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);
      controller.source = source;
      controller.processor = processor;
      controller.silentGain = silentGain;
      processor.onaudioprocess = (event) => {
        if (controller.stopping || !controller.ws || controller.ws.readyState !== WebSocket.OPEN || controller.phase === "connecting") return;
        const audio = pcm16Base64(event.inputBuffer.getChannelData(0), audioCtx.sampleRate);
        send({ type: "input_audio_buffer.append", audio });
      };

      const protocol = location.protocol === "https:" ? "wss://" : "ws://";
      const ws = new WebSocket(protocol + location.host + DOUBAO_REALTIME_URL);
      controller.ws = ws;
      ws.onopen = () => send({ type: "session.start", context: transcriptionContext(ta) });
      ws.onmessage = (event) => {
        if (session !== recognitionSession) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "session.created") {
          controller.phase = "listening";
          controller.busy = false;
          setMicState(btn, "recording");
          showPreview("正在聆听…", ta, true);
          renderVoiceWorkspace(controller, { phase: "listening", connected: true, busy: false });
          return;
        }
        if (message.type === "conversation.item.input_audio_transcription.started") {
          turnBaseline = ta && ta.value !== undefined ? ta.value : "";
          controller.stopPlayback();
          send({ type: "response.cancel" });
          syncContext();
          controller.busy = false;
          showPreview("正在听你说…", ta, true);
          renderVoiceWorkspace(controller, { phase: "listening", connected: true, busy: false });
          return;
        }
        if (message.type === "conversation.item.input_audio_transcription.delta") {
          showPreview(String(message.transcript || message.delta || "正在听你说…"), ta, false);
          return;
        }
        if (message.type === "conversation.item.input_audio_transcription.completed" || message.type === "input_audio_buffer.committed") {
          const transcript = String(message.transcript || message.delta || "").trim();
          if (transcript) dialogTurns.push({ role: "User", text: transcript });
          controller.busy = true;
          showPreview("正在思考…", ta, true);
          renderVoiceWorkspace(controller, { phase: "thinking", connected: true, busy: true });
          return;
        }
        if (message.type === "response.function_call_arguments.done") {
          const calls = Array.isArray(message.items) ? message.items : [];
          const handled = calls.some(applyDraft);
          if (handled) {
            showPreview("正在修改工作草稿…", ta, true);
            renderVoiceWorkspace(controller, { phase: "editing", connected: true, busy: true });
          }
          return;
        }
        if (message.type === "response.output_text.delta" || message.type === "response.output_text.done") {
          const key = responseKey(message);
          const text = message.type.endsWith(".done")
            ? String(message.text || responseText.get(key) || "")
            : (responseText.get(key) || "") + String(message.delta || "");
          responseText.set(key, text);
          if (message.type.endsWith(".done") && text.trim()) dialogTurns.push({ role: "Assistant", text: text.trim() });
          renderVoiceWorkspace(controller, { reply: text, phase: "speaking", connected: true, busy: true });
          return;
        }
        if (message.type === "response.output_audio.started") {
          controller.busy = true;
          renderVoiceWorkspace(controller, { phase: "speaking", connected: true, busy: true });
          return;
        }
        if (message.type === "response.output_audio.delta") {
          playAudio(message.delta);
          return;
        }
        if (message.type === "response.done" || message.type === "response.output_audio.done") {
          controller.busy = false;
          showPreview("正在聆听…", ta, true);
          renderVoiceWorkspace(controller, { phase: "listening", connected: true, busy: false });
          return;
        }
        if (message.type === "error") {
          const detail = message.error && (message.error.message || message.error.code);
          fail("豆包 Realtime 出错：" + (detail || "unknown"));
        }
      };
      ws.onerror = () => fail("豆包 Realtime WebSocket 连接失败");
      ws.onclose = (event) => {
        if (!controller.stopping) fail("豆包 Realtime 连接已断开" + (event.reason ? "：" + event.reason : ""));
      };
    } catch (error) {
      const message = error && error.name === "NotAllowedError"
        ? "麦克风权限被拒绝：请在浏览器地址栏允许麦克风权限后重试"
        : "无法启动豆包 Realtime：" + ((error && error.message) || error);
      fail(message);
    }
  }

  function toggleMic(ta, btn) {
    if (!window.isSecureContext) { toast("非安全上下文无法使用麦克风：请通过 http://127.0.0.1:3080 访问 dsh web"); return; }
    if (recognition) {
      stopRecognition(ta, btn);
      return;
    }
    const support = recognitionSupport();
    if (!support.ok) { toast(support.reason); return; }
    if (cfg.recognitionProvider === "openai-realtime") startOpenAIRealtime(ta, btn);
    else if (cfg.recognitionProvider === "doubao-realtime") startDoubaoRealtime(ta, btn);
    else startBrowserRecognition(ta, btn);
  }

  function refreshMicButtonSupport() {
    const support = recognitionSupport();
    document.querySelectorAll("[data-chatvoice-mic]").forEach((btn) => {
      const secure = !!window.isSecureContext;
      btn.disabled = !secure || !support.ok;
      btn.title = !secure
        ? "非安全上下文无法使用麦克风（请用 http://127.0.0.1:3080 访问）"
        : (support.ok ? "Talk to Text：点击开始讨论并维护草稿，再次点击停止" : support.reason);
      btn.setAttribute("aria-label", btn.title);
    });
  }

  function createMicButton(ta) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chatvoice-mic-btn";
    btn.dataset.chatvoiceMic = "1";
    btn.innerHTML = MIC_SVG;
    const support = recognitionSupport();
    if (!support.ok) { btn.disabled = true; btn.title = support.reason; }
    else if (!window.isSecureContext) { btn.disabled = true; btn.title = "非安全上下文无法使用麦克风（请用 http://127.0.0.1:3080 访问）"; }
    else btn.title = "Talk to Text：点击开始讨论并维护草稿，再次点击停止";
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

  /** 计算「最终结论」条目集合（文档序）:
   *  结论 = 其后紧跟 turn-tail / user / 没有后续的 assistant-step;
   *  或流式进行中, 整个消息流的最后一条是 assistant-step（正在写结论）。
   *  中间步骤（后面紧跟 tool-call / context / 别的 assistant-step）不算结论。 */
  function computeFinalConclusions() {
    const all = [...document.querySelectorAll('[data-chat-flow-kind]')];
    const set = new Set();
    for (let i = 0; i < all.length; i++) {
      const it = all[i];
      if (it.getAttribute("data-chat-flow-kind") !== "assistant-step") continue;
      const next = all[i + 1];
      const nk = next ? next.getAttribute("data-chat-flow-kind") : null;
      if (nk !== "assistant-step" && nk !== "tool-call" && nk !== "context") set.add(it);
    }
    const last = all[all.length - 1];
    if (last && last.getAttribute("data-chat-flow-kind") === "assistant-step") set.add(last);
    return set;
  }

  /** 小喇叭: 所有带正文的助手消息都挂一个悬浮按钮（思维链+结论, 用户接受的现状）。 */
  function injectSpeakers() {
    if (!document.body) return;
    document.querySelectorAll('[data-chat-flow-kind="assistant-step"]').forEach((item) => {
      const mds = item.querySelectorAll("[class*=markdown]");
      if (!mds.length) return;
      if (item.querySelector("[data-chatvoice-speak]")) return;
      const md = mds[mds.length - 1];
      const key = item.getAttribute("data-chat-flow-key") || item.getAttribute("data-chat-anchor-key") || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chatvoice-speak-btn chatvoice-speak-float";
      btn.dataset.chatvoiceSpeak = "1";
      btn.dataset.key = key;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        warmUpSpeech();
        speak(extractText(md), key);
      });
      try { md.style.position = "relative"; } catch { /* ignore */ }
      md.appendChild(btn);
      renderSpeaking();
    });
  }

  /** 自动朗读：文本稳定 1.5 秒后朗读一次（可随时打断）。
   *  final 模式只读最终结论; all 模式连思维链/中间步骤一起读。 */
  function autoSpeakScan() {
    if (!cfg.autoSpeak) { pendingAuto.clear(); return; }
    const now = Date.now();
    const scopeAll = cfg.autoSpeakMode === "all";
    const conclusions = scopeAll ? null : computeFinalConclusions();
    document.querySelectorAll('[data-chat-flow-kind="assistant-step"]').forEach((item) => {
      const mds = item.querySelectorAll("[class*=markdown]");
      if (!mds.length) return;
      if (!scopeAll && !conclusions.has(item)) { pendingAuto.delete(item.getAttribute("data-chat-flow-key") || item.getAttribute("data-chat-anchor-key") || ""); return; }
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
      .then((body) => {
        if (body && body.value && typeof body.value === "object") Object.assign(cfg, body.value);
        cfg.openaiRealtimeAvailable = !!(body && body.capabilities && body.capabilities.openaiRealtime);
        cfg.doubaoRealtimeAvailable = !!(body && body.capabilities && body.capabilities.doubaoRealtime);
        cfg.doubaoRealtimeMissing = (body && body.capabilities && Array.isArray(body.capabilities.doubaoRealtimeMissing)) ? body.capabilities.doubaoRealtimeMissing : [];
        cfg.doubaoCredentialRefs = (body && body.capabilities && body.capabilities.doubaoCredentialRefs) || cfg.doubaoCredentialRefs;
        cfg.realtimeModels = (body && body.capabilities && Array.isArray(body.capabilities.realtimeModels)) ? body.capabilities.realtimeModels : [];
        refreshMicButtonSupport();
      })
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
          cfg.openaiRealtimeAvailable = !!(body && body.capabilities && body.capabilities.openaiRealtime);
          cfg.doubaoRealtimeAvailable = !!(body && body.capabilities && body.capabilities.doubaoRealtime);
          cfg.doubaoRealtimeMissing = (body && body.capabilities && Array.isArray(body.capabilities.doubaoRealtimeMissing)) ? body.capabilities.doubaoRealtimeMissing : [];
          cfg.doubaoCredentialRefs = (body && body.capabilities && body.capabilities.doubaoCredentialRefs) || cfg.doubaoCredentialRefs;
          cfg.realtimeModels = (body && body.capabilities && Array.isArray(body.capabilities.realtimeModels)) ? body.capabilities.realtimeModels : [];
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
            cfg.openaiRealtimeAvailable = !!(body.capabilities && body.capabilities.openaiRealtime);
            cfg.doubaoRealtimeAvailable = !!(body.capabilities && body.capabilities.doubaoRealtime);
            cfg.doubaoRealtimeMissing = (body.capabilities && Array.isArray(body.capabilities.doubaoRealtimeMissing)) ? body.capabilities.doubaoRealtimeMissing : [];
            cfg.doubaoCredentialRefs = (body.capabilities && body.capabilities.doubaoCredentialRefs) || cfg.doubaoCredentialRefs;
            cfg.realtimeModels = (body.capabilities && Array.isArray(body.capabilities.realtimeModels)) ? body.capabilities.realtimeModels : [];
            setState((s) => ({ ...s, saving: false, saved: true, value: { ...cfg } }));
            refreshMicButtonSupport();
            toast("Talk to Text 设置已保存，立即生效");
          } else {
            setState((s) => ({ ...s, saving: false, error: (body && body.error) || "保存失败" }));
          }
        })
        .catch((e) => setState((s) => ({ ...s, saving: false, error: String((e && e.message) || e) })));
    };

    if (state.loading) return react.createElement("div", { style: { padding: "14px 0" } }, "加载中…");

    const selectedProvider = state.value.recognitionProvider || "doubao-realtime";
    const realtimeModels = Array.isArray(cfg.realtimeModels) ? cfg.realtimeModels : [];
    const doubaoModels = realtimeModels.filter((model) => model.protocol === "doubao-realtime-duplex");
    const openaiModels = realtimeModels.filter((model) => model.protocol !== "doubao-realtime-duplex");
    const status = !window.isSecureContext
      ? "○ 非安全上下文：语音输入不可用，朗读仍可用（请用 http://127.0.0.1:3080 访问）"
      : (selectedProvider === "openai-realtime"
        ? (state.value.openaiRealtimeAvailable
          ? (realtimeSupported() ? "● GPT Realtime 共同思考工作台可用" : "○ 当前浏览器不支持 WebRTC 麦克风输入")
          : (openaiModels.length ? "○ 所选 Realtime 模型的凭据尚未配置" : "○ 模型注册表中没有 GPT Realtime 模型"))
        : (selectedProvider === "doubao-realtime"
          ? (state.value.doubaoRealtimeAvailable
            ? (doubaoRealtimeSupported() ? "● 豆包 Realtime Duplex 共同思考工作台可用" : "○ 当前浏览器不支持 WebSocket 实时音频")
            : (doubaoModels.length
              ? "○ 豆包 Realtime 尚缺凭据：" + ((cfg.doubaoRealtimeMissing || []).join("、") || "请检查 API Key")
              : "○ 模型注册表中没有豆包 Realtime Duplex 模型"))
          : (srSupported() ? "● 浏览器原生语音识别可用" : "○ 当前浏览器不支持原生语音识别（推荐 Edge 或 Chrome）")));

    return react.createElement("div", { style: { padding: "14px 0", maxWidth: 560 } }, [
      react.createElement("div", { key: "t", style: { fontSize: 16, fontWeight: 600, marginBottom: 4 } }, "Talk to Text 语音设置"),
      react.createElement("div", { key: "d", style: { fontSize: 12, opacity: 0.6, marginBottom: 10 } }, "通过自然语音与上下文感知模型共同思考，持续维护可编辑草稿，定稿后再提交给主 Agent"),
      react.createElement("div", { key: "s", className: "chatvoice-status" }, status),
      react.createElement("div", { key: "provider", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "识别后端 / Recognition provider"),
        react.createElement("select", {
          key: "i", className: "chatvoice-input", value: selectedProvider,
          onChange: (e) => set("recognitionProvider", e.target.value),
        }, [
          react.createElement("option", { key: "browser", value: "browser" }, "浏览器原生（免费，无 API Key）"),
          react.createElement("option", { key: "openai", value: "openai-realtime" }, "OpenAI Realtime（WebRTC）"),
          react.createElement("option", { key: "doubao", value: "doubao-realtime" }, "豆包 Realtime Duplex（原生双工 + 工具调用）"),
        ]),
      ]),
      selectedProvider === "browser" ? react.createElement("div", { key: "f1", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "识别语言 / Recognition language"),
        react.createElement("select", {
          key: "i", className: "chatvoice-input", value: state.value.recognitionLang,
          onChange: (e) => set("recognitionLang", e.target.value),
        }, [
          react.createElement("option", { key: "zh", value: "zh-CN" }, "中文（普通话）zh-CN"),
          react.createElement("option", { key: "en", value: "en-US" }, "English (US) en-US"),
        ]),
      ]) : null,
      selectedProvider === "openai-realtime" ? react.createElement("div", { key: "rt", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "Realtime 共同思考模型"),
        react.createElement("select", {
          key: "i", className: "chatvoice-input",
          value: state.value.openaiRealtimeModel || (openaiModels[0] && openaiModels[0].id) || "",
          onChange: (e) => set("openaiRealtimeModel", e.target.value),
          disabled: openaiModels.length <= 1,
        }, openaiModels.length
          ? openaiModels.map((model) => react.createElement("option", { key: model.id, value: model.id }, (model.displayName || model.model) + " · " + model.provider))
          : [react.createElement("option", { key: "none", value: "" }, "未发现已注册的 Realtime 模型")]),
        react.createElement("div", { key: "h", className: "chatvoice-hint" }, "来自模型注册插件；只有一个时自动选中，新注册的兼容模型会自动出现在此处。密钥仅由 DSH host 解析。"),
        react.createElement("label", { key: "cl", className: "chatvoice-label", style: { marginTop: 10 } }, "共同思考上下文 / Deliberation context"),
        react.createElement("select", {
          key: "ci", className: "chatvoice-input",
          value: state.value.openaiContextMode || "recent",
          onChange: (e) => set("openaiContextMode", e.target.value),
        }, [
          react.createElement("option", { key: "recent", value: "recent" }, "当前草稿 + 最近可见对话（推荐）"),
          react.createElement("option", { key: "draft", value: "draft" }, "仅当前草稿"),
          react.createElement("option", { key: "off", value: "off" }, "不同步上下文"),
        ]),
        react.createElement("div", { key: "ch", className: "chatvoice-hint" }, "模型据此理解当前任务、讨论想法和草稿修改；不包含隐藏 system prompt、工具参数或思维链，初始应用上下文最多约 4,000 字符。"),
      ]) : null,
      selectedProvider === "doubao-realtime" ? react.createElement("div", { key: "doubao-rt", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "豆包 Realtime 共同思考模型"),
        react.createElement("select", {
          key: "i", className: "chatvoice-input",
          value: state.value.doubaoRealtimeModel || (doubaoModels[0] && doubaoModels[0].id) || "",
          onChange: (e) => set("doubaoRealtimeModel", e.target.value),
          disabled: doubaoModels.length <= 1,
        }, doubaoModels.length
          ? doubaoModels.map((model) => react.createElement("option", { key: model.id, value: model.id }, (model.displayName || model.model) + " · 火山引擎"))
          : [react.createElement("option", { key: "none", value: "" }, "未发现已注册的豆包 Duplex 模型")]),
        react.createElement("div", { key: "h", className: "chatvoice-hint" }, "使用豆包 Realtime Speech 3.0 / Seeduplex 的 JSON WebSocket 协议；模型与凭据在“设置 → 模型 → 豆包语音”统一注册。"),
        react.createElement("label", { key: "cl", className: "chatvoice-label", style: { marginTop: 10 } }, "共同思考上下文 / Deliberation context"),
        react.createElement("select", {
          key: "ci", className: "chatvoice-input",
          value: state.value.openaiContextMode || "recent",
          onChange: (e) => set("openaiContextMode", e.target.value),
        }, [
          react.createElement("option", { key: "recent", value: "recent" }, "当前草稿 + 最近可见对话（推荐）"),
          react.createElement("option", { key: "draft", value: "draft" }, "仅当前草稿"),
          react.createElement("option", { key: "off", value: "off" }, "不同步上下文"),
        ]),
        react.createElement("div", { key: "ch", className: "chatvoice-hint" }, "初始上下文与后续草稿快照都会同步到语音模型；草稿仍只能由 update_working_draft 工具修改。"),
      ]) : null,
      react.createElement("div", { key: "f2", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, [
          react.createElement("input", {
            key: "c", type: "checkbox", checked: !!state.value.autoSpeak, style: { marginRight: 6 },
            onChange: (e) => set("autoSpeak", e.target.checked),
          }),
          "自动朗读新回复（可点小喇叭随时停止）",
        ]),
        react.createElement("select", {
          key: "m", className: "chatvoice-input chatvoice-mode", style: { marginTop: 6 },
          value: state.value.autoSpeakMode || "final",
          onChange: (e) => set("autoSpeakMode", e.target.value),
        }, [
          react.createElement("option", { key: "f", value: "final" }, "只读最终结论（跳过思维链）"),
          react.createElement("option", { key: "a", value: "all" }, "全部朗读（思维链 + 结论）"),
        ]),
      ]),
      react.createElement("div", { key: "f3", className: "chatvoice-field" }, [
        react.createElement("label", { key: "l", className: "chatvoice-label" }, "音色 / Voice name（留空自动选最佳中文音色）"),
        react.createElement("input", {
          key: "i", type: "text", className: "chatvoice-input", value: state.value.voiceName || "",
          placeholder: "如：Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)",
          onChange: (e) => set("voiceName", e.target.value),
        }),
        react.createElement("div", { key: "h", className: "chatvoice-hint" }, "Edge 内置 Xiaoxiao Online (Natural) 免费中文音色最自然；音色列表随浏览器异步加载"),
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
      window.addEventListener("scroll", positionPreview, true);
      window.addEventListener("resize", positionPreview);
    } catch { /* ignore */ }
    try {
      if (typeof speechSynthesis !== "undefined") {
        if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", refreshVoices);
        speechSynthesis.onvoiceschanged = refreshVoices;
      }
    } catch { /* ignore */ }
    try { document.addEventListener("pointerdown", warmUpSpeech, { once: true, capture: true }); } catch { /* ignore */ }
    loadConfig();
    scan();
    startObserver();
  }

  function apply(ctx) {
    clientCtx = ctx;
    // 设置页分组（沿用 free-vision 已验证的 slots 注册写法）
    ctx.slots.inject("settings.section", () => ctx.slots.register({
      name: "settings.section",
      id: "dsh-talk-to-text",
      order: 60,
      label: () => "Talk to Text",
      locale: NS,
      inject: () => ({})
    }, () => react.createElement(Section)));

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  exports.name = "dsh-talk-to-text";
  exports.inject = ["slots", "sessions"];
  exports.apply = apply;
  return module.exports;
}});
