// scripts/e2e.mjs — dsh-chatvoice E2E against a live dsh web instance.
// 用法: DSH_TEST_URL=http://127.0.0.1:3091 node scripts/e2e.mjs [--real-chat]
// 覆盖: 工作区预置 / 麦克风按钮注入 / 假 SpeechRecognition 全链路(中间结果→final 入框) /
//       小喇叭注入与朗读调用链(speechSynthesis.speak) / 停止打断 /
//       设置页分组与保存(GET/POST /dsh-chatvoice/config) /
//       可选 --real-chat: 真实对话流中注入与朗读。
import puppeteer from "puppeteer-core";

const DSH_URL = process.env.DSH_TEST_URL || "http://127.0.0.1:3091";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const WORKSPACE_PATH = process.env.DSH_TEST_WORKSPACE || process.cwd();
const REAL_CHAT = process.argv.includes("--real-chat");

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 0. 预置工作区（全新 DSH_HOME 没有工作区时落地页是只读选择框而非 composer） ── */
async function ensureWorkspace() {
  const mkReq = (method, payload = {}) => ({
    type: "client-request",
    rpcId: crypto.randomUUID(),
    method,
    payload,
  });
  const post = (method, payload) =>
    fetch(DSH_URL + "/api/" + method, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mkReq(method, payload)),
    }).then((r) => r.json());
  const list = await post("workspace.list", {});
  const items = (list && list.result && list.result.ok && list.result.value && list.result.value.items) || [];
  if (!items.some((w) => w.path === WORKSPACE_PATH)) {
    const created = await post("workspace.create", { path: WORKSPACE_PATH });
    console.log("workspace seeded:", created && created.result && created.result.ok ? "ok" : JSON.stringify(created).slice(0, 200));
  }
}

// 在应用脚本加载前注入假 SpeechRecognition / speechSynthesis（headless 无音频无麦克风）
const STUB = `
(function () {
  const E2E = (window.__chatvoiceE2E = window.__chatvoiceE2E || {});
  const fakeSR = class {
    constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null; }
    start() {
      if (this.onstart) this.onstart();
      const steps = [
        () => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: "你好" }, isFinal: false }] }); },
        () => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }] }); },
        () => { if (this.onend) this.onend(); },
      ];
      let step = 0;
      const tick = () => { steps[step](); step++; if (step < steps.length) setTimeout(tick, 120); };
      setTimeout(tick, 80);
    }
    stop() { if (this.onend) this.onend(); }
    abort() { if (this.onend) this.onend(); }
  };
  E2E.SR = fakeSR;
  try { Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: fakeSR }); } catch (e) { window.SpeechRecognition = fakeSR; }
  try { Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: fakeSR }); } catch (e) { window.webkitSpeechRecognition = fakeSR; }
  const syn = {
    _u: [], _cancels: 0,
    getVoices() {
      return [
        { name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)", lang: "zh-CN" },
        { name: "Google 普通话（中国大陆）", lang: "zh-CN" },
        { name: "Microsoft David - English (United States)", lang: "en-US" },
      ];
    },
    speak(u) { this._u.push(u); E2E.lastUtterance = u; /* 不自动 onend: 由 E2E 手动触发, 以便测试停止打断 */ },
    cancel() { this._cancels++; },
    addEventListener() {},
    onvoiceschanged: null,
  };
  try { Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true, value: syn }); } catch (e) { window.speechSynthesis = syn; }
  E2E.synthesis = syn;
  const FakeUtterance = class {
    constructor(text) { this.text = text; this.lang = ""; this.voice = null; this.rate = 1; this.pitch = 1; this.onend = null; this.onerror = null; }
  };
  try { Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: FakeUtterance }); } catch (e) { window.SpeechSynthesisUtterance = FakeUtterance; }
})();
`;

await ensureWorkspace();

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(STUB);
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
  await page.goto(DSH_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);

  /* ── 1. 麦克风按钮注入（composer 工具条） ── */
  const composer = await page.evaluate(() => {
    const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
    return ta ? { ok: true, value: ta.value } : { ok: false };
  });
  check("落地页出现可编辑 composer（工作区就绪）", composer.ok);
  let micBtn = null;
  try {
    micBtn = await page.waitForSelector("[data-chatvoice-mic]", { timeout: 20000 });
    check("输入框工具条出现麦克风按钮", !!micBtn);
  } catch { check("输入框工具条出现麦克风按钮", false, "未找到 [data-chatvoice-mic]"); }

  /* ── 2. 假识别全链路 ── */
  if (micBtn) {
    await micBtn.click();
    await sleep(250);
    const recording = await page.evaluate(() => !!document.querySelector(".chatvoice-recording"));
    check("点击麦克风后进入识别中状态（红色脉冲）", recording);

    let value = "";
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      value = await page.evaluate(() => {
        const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
        return ta ? ta.value : "";
      });
      if (value.includes("你好世界")) break;
      await sleep(200);
    }
    check("识别 final 文本写入输入框", value.includes("你好世界"), "composer.value=" + JSON.stringify(value));

    const previewShown = await page.evaluate(() => {
      const p = document.querySelector(".chatvoice-preview");
      return p ? p.textContent : "";
    });
    check("识别过程有中间结果预览", previewShown.includes("你好世界") || previewShown.includes("你好"), JSON.stringify(previewShown));
  } else {
    check("点击麦克风后进入识别中状态", false, "无按钮可点");
    check("识别 final 文本写入输入框", false, "无按钮可点");
  }

  /* ── 3. 小喇叭注入 + 朗读调用链（DOM 注入假消息） ── */
  await page.evaluate(() => {
    const item = document.createElement("div");
    item.setAttribute("data-chat-flow-kind", "assistant-step");
    item.setAttribute("data-chat-flow-key", "e2e-fake-msg-1");
    item.innerHTML =
      '<div data-disclosure-row="true"><span>Think</span></div>' +
      '<div class="_markdown_1nba0_5"><p>你好，这是测试朗读文本。</p><pre><code>console.log("skip me")</code></pre></div>';
    document.body.appendChild(item);
  });
  let speakBtn = null;
  try {
    speakBtn = await page.waitForSelector('[data-chat-flow-key="e2e-fake-msg-1"] [data-chatvoice-speak]', { timeout: 15000 });
    check("助手消息块出现小喇叭按钮", !!speakBtn);
  } catch { check("助手消息块出现小喇叭按钮", false, "observer 未注入"); }

  if (speakBtn) {
    await speakBtn.click();
    await sleep(400);
    const utt = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.lastUtterance) || null);
    const textOk = utt && utt.text && utt.text.includes("你好，这是测试朗读文本。") && !utt.text.includes("skip me");
    check("点击小喇叭调用 speechSynthesis.speak 且剥离代码块", textOk, utt ? JSON.stringify(utt.text).slice(0, 80) : "no utterance");
    const voiceOk = utt && utt.voice && utt.voice.name.includes("Xiaoxiao");
    check("自动选择 Xiaoxiao 中文音色", voiceOk, utt && utt.voice ? utt.voice.name : "no voice");
    // 再次点击 = 停止
    await speakBtn.click();
    await sleep(200);
    const cancels = await page.evaluate(() => window.__chatvoiceE2E.synthesis._cancels);
    const speakingCleared = await page.evaluate(() => !document.querySelector(".chatvoice-speaking"));
    check("朗读中再次点击 = 停止（speechSynthesis.cancel + 状态复位）", cancels >= 1 && speakingCleared, "cancels=" + cancels);
  }

  /* ── 3.5 自动朗读: 设置页开启 → 新消息稳定后自动朗读 → 点击打断 ── */
  try {
    await page.click('button[aria-label="打开侧边栏"]');
    await sleep(800);
    const settingsBtn1 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === "设置"));
    await settingsBtn1.asElement().click();
    await sleep(1500);
    const cvTab1 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "ChatVoice"));
    await cvTab1.asElement().click();
    await sleep(1200);
    await page.evaluate(() => {
      const cb = document.querySelector('input[type="checkbox"]');
      cb.click();
    });
    await sleep(300);
    const saveBtn1 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("保存设置")));
    await saveBtn1.asElement().click();
    await sleep(1500);
    await page.keyboard.press("Escape");
    await sleep(600);

    // 注入一条新「助手回复」，等待稳定性检测自动朗读
    await page.evaluate(() => {
      const item = document.createElement("div");
      item.setAttribute("data-chat-flow-kind", "assistant-step");
      item.setAttribute("data-chat-flow-key", "e2e-auto-msg-1");
      item.innerHTML =
        '<div data-disclosure-row="true"><span>Think</span></div>' +
        '<div class="_markdown_1nba0_5"><p>这是自动朗读测试文本。</p></div>';
      document.body.appendChild(item);
    });
    let autoUtt = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 12000) {
      autoUtt = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.lastUtterance) || null);
      if (autoUtt && autoUtt.text && autoUtt.text.includes("自动朗读测试文本")) break;
      await sleep(500);
    }
    const autoOk = autoUtt && autoUtt.text && autoUtt.text.includes("自动朗读测试文本");
    check("自动朗读开关开启后新回复自动朗读", autoOk, autoUtt ? JSON.stringify(autoUtt.text).slice(0, 60) : "no auto utterance");
    const autoSpeaking = await page.evaluate(() => {
      const b = document.querySelector('[data-chat-flow-key="e2e-auto-msg-1"] [data-chatvoice-speak]');
      return !!(b && b.classList.contains("chatvoice-speaking"));
    });
    check("自动朗读中对应小喇叭显示停止态", autoSpeaking);
    // 点击打断
    const autoBtn = await page.evaluateHandle(() => document.querySelector('[data-chat-flow-key="e2e-auto-msg-1"] [data-chatvoice-speak]'));
    if (autoBtn.asElement()) {
      await autoBtn.asElement().click();
      await sleep(300);
      const cancelsAfter = await page.evaluate(() => window.__chatvoiceE2E.synthesis._cancels);
      const cleared = await page.evaluate(() => !document.querySelector('[data-chat-flow-key="e2e-auto-msg-1"] .chatvoice-speaking'));
      check("自动朗读可随时打断", cancelsAfter >= 1 && cleared, "cancels=" + cancelsAfter);
    } else {
      check("自动朗读可随时打断", false, "无按钮");
    }
  } catch (e) {
    check("自动朗读开关开启后新回复自动朗读", false, String(e).slice(0, 160));
  }

  /* ── 4. 设置页分组 + 保存（放最后: 弹窗不遮挡前面的 DOM 交互） ── */
  try {
    // 侧边栏可能仍处于打开状态（3.5 步骤打开过）: 优先直接找设置按钮
    let settingsBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === "设置"));
    if (!settingsBtn.asElement()) {
      await page.click('button[aria-label="打开侧边栏"]');
      await sleep(800);
      settingsBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === "设置"));
    }
    await settingsBtn.asElement().click();
    await sleep(1500);
    const chatvoiceTab = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "ChatVoice"));
    const hasTab = !!chatvoiceTab.asElement();
    check("设置页出现 ChatVoice 分组", hasTab);
    if (hasTab) {
      await chatvoiceTab.asElement().click();
      await sleep(1200);
      const fields = await page.evaluate(() => {
        const sel = document.querySelector('select.chatvoice-input');
        const checkbox = document.querySelector('input[type="checkbox"]');
        const text = document.querySelector('input[type="text"].chatvoice-input');
        const num = document.querySelector('input[type="number"].chatvoice-input');
        return { sel: !!sel, checkbox: !!checkbox, text: !!text, num: !!num, selVal: sel ? sel.value : null };
      });
      check("设置表单 4 个字段齐全（语言/自动朗读/音色/语速）", fields.sel && fields.checkbox && fields.text && fields.num, JSON.stringify(fields));

      // 关掉自动朗读 + 改语速 1.5 → 保存
      await page.evaluate(() => {
        const cb = document.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) cb.click();
      });
      await sleep(200);
      await page.evaluate(() => {
        const num = document.querySelector('input[type="number"].chatvoice-input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        if (num._valueTracker) num._valueTracker.setValue(String(num.value));
        setter.call(num, "1.5");
        num.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await sleep(300);
      const saveBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("保存设置")));
      await saveBtn.asElement().click();
      await sleep(1500);
      const saved = await page.evaluate(() => document.body.innerText.includes("已保存，立即生效"));
      check("设置保存成功（页面反馈）", saved);
      const serverCfg = await page.evaluate(() => fetch("/dsh-chatvoice/config").then((r) => r.json()).catch((e) => ({ fetchErr: String(e) })));
      check("设置持久化到宿主（GET /config 返回 rate=1.5）", serverCfg && serverCfg.value && serverCfg.value.rate === 1.5, JSON.stringify(serverCfg && serverCfg.value));
      check("自动朗读已复位为关闭", serverCfg && serverCfg.value && serverCfg.value.autoSpeak === false, JSON.stringify(serverCfg && serverCfg.value));
      await page.keyboard.press("Escape");
      await sleep(600);
    }
  } catch (e) {
    check("设置页 ChatVoice 分组", false, String(e).slice(0, 160));
  }

  /* ── 5. 可选: 真实对话流 ── */
  if (REAL_CHAT) {
    try {
      const ta = await page.waitForSelector("textarea", { timeout: 10000 });
      await ta.click();
      await page.evaluate(() => {
        const t = [...document.querySelectorAll("textarea")].find((x) => !x.readOnly);
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        if (t._valueTracker) t._valueTracker.setValue(t.value);
        setter.call(t, "请只回复四个字：你好世界");
        t.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await sleep(300);
      const send = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "发送消息"));
      await send.asElement().click();
      let realBtn = null;
      try { realBtn = await page.waitForSelector('[data-chat-flow-kind="assistant-step"] [data-chatvoice-speak]', { timeout: 240000 }); } catch {}
      check("真实对话流：助手回复渲染后小喇叭注入", !!realBtn);
    } catch (e) {
      check("真实对话流：助手回复渲染后小喇叭注入", false, String(e).slice(0, 160));
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log("");
  console.log("======== E2E 结果: " + (results.length - failed.length) + "/" + results.length + " 通过 ========");
  if (failed.length) { console.log("失败项:"); failed.forEach((f) => console.log("  - " + f.name)); process.exitCode = 1; }
} finally {
  await browser.close();
}
