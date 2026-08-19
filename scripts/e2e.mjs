// scripts/e2e.mjs — dsh-talk-to-text E2E against a live dsh web instance.
// 用法: DSH_TEST_URL=http://127.0.0.1:3091 node scripts/e2e.mjs [--real-chat]
// 覆盖: 工作区预置 / 麦克风按钮注入 / 假 SpeechRecognition 全链路(中间结果→final 入框) /
//       小喇叭注入与朗读调用链(speechSynthesis.speak) / 停止打断 /
//       设置页分组与保存(GET/POST /dsh-talk-to-text/config) /
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
      // continuous=true 语义: 两轮 final 累积, 绝不自动 onend —— 只有 stop()/abort() 结束
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: "你好" }, isFinal: false }] }); }, 400);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }] }); }, 700);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 2, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }, { 0: { transcript: "继续" }, isFinal: false }] }); }, 1000);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 2, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }, { 0: { transcript: "继续听写" }, isFinal: true }] }); }, 1300);
      // 第三轮: 打字接管期间到达的识别结果（不覆盖用户输入, 停止时追加）
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 3, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }, { 0: { transcript: "继续听写" }, isFinal: true }, { 0: { transcript: "第三" }, isFinal: false }] }); }, 3000);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 3, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }, { 0: { transcript: "继续听写" }, isFinal: true }, { 0: { transcript: "第三句" }, isFinal: true }] }); }, 3400);
      // 第四轮: 用户全删后的新识别（删除不复活测试）
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 4, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }, { 0: { transcript: "继续听写" }, isFinal: true }, { 0: { transcript: "第三句" }, isFinal: true }, { 0: { transcript: "第四" }, isFinal: false }] }); }, 4800);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 4, results: [{ 0: { transcript: "你好" }, isFinal: true }, { 0: { transcript: "世界" }, isFinal: true }, { 0: { transcript: "继续听写" }, isFinal: true }, { 0: { transcript: "第三句" }, isFinal: true }, { 0: { transcript: "第四句" }, isFinal: true }] }); }, 5200);
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

  /* ── 2. 连续听写全链路 ── */
  if (micBtn) {
    await micBtn.click();
    // 即时性: 点击后 300ms 内出现聆听态预览（不等第一个识别结果）
    await sleep(250);
    const quick = await page.evaluate(() => {
      const p = document.querySelector(".chatvoice-preview");
      return {
        recording: !!document.querySelector(".chatvoice-recording"),
        previewVisible: !!(p && p.style.display !== "none" && p.style.opacity !== "0"),
        listening: !!(p && p.classList.contains("chatvoice-listening")),
        text: p ? p.textContent : "",
      };
    });
    check("点击后 300ms 内出现聆听态预览（即时反馈）", quick.recording && quick.previewVisible && quick.listening && quick.text.includes("正在聆听"), JSON.stringify(quick));

    // 多句 final 累积写入输入框
    let value = "";
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      value = await page.evaluate(() => {
        const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
        return ta ? ta.value : "";
      });
      if (value.includes("你好世界继续听写")) break;
      await sleep(200);
    }
    check("多句 final 累积写入输入框（连续听写）", value.includes("你好世界继续听写"), "composer.value=" + JSON.stringify(value));

    // 持续聆听: 全部结果出来后仍未自动停止
    await sleep(600);
    const still = await page.evaluate(() => ({
      recording: !!document.querySelector(".chatvoice-recording"),
      preview: (() => { const p = document.querySelector(".chatvoice-preview"); return p ? p.textContent : ""; })(),
    }));
    check("说完多句不自动停止（持续聆听中）", still.recording, "recording=" + still.recording);
    check("预览框实时显示识别文本", still.preview.includes("你好世界继续听写"), JSON.stringify(still.preview));

    // ── 边听边改（追加不回写模型）: 真实键入后语音继续实时入框 ──
    const taEl = await page.evaluateHandle(() => [...document.querySelectorAll("textarea")].find((t) => !t.readOnly));
    await taEl.asElement().click();
    await taEl.evaluate((t) => { try { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } catch { /* ignore */ } });
    await page.keyboard.type("，手动修改");
    await sleep(400);
    const typed = await page.evaluate(() => {
      const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
      return ta ? ta.value : "";
    });
    check("真实打字后用户文字保留", typed.includes("，手动修改"), JSON.stringify(typed.slice(0, 30)));

    // 第三轮: 中间结果（3000ms）只进气泡不进输入框; 确认句（3400ms）实时追加到框尾
    let interimState = { value: "", preview: "" };
    const tInt = Date.now();
    while (Date.now() - tInt < 4000) {
      interimState = await page.evaluate(() => {
        const p = document.querySelector(".chatvoice-preview");
        const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
        return { value: ta ? ta.value : "", preview: p ? p.textContent : "" };
      });
      if (interimState.preview.includes("第三") && !interimState.preview.includes("第三句")) break;
      await sleep(100);
    }
    check("中间结果只进气泡、不覆盖输入框", interimState.preview.includes("第三") && !interimState.preview.includes("第三句") && !interimState.value.includes("第三"), JSON.stringify({ preview: interimState.preview.slice(0, 30), value: interimState.value.slice(0, 40) }));
    let afterFinal = "";
    const tF = Date.now();
    while (Date.now() - tF < 6000) {
      afterFinal = await page.evaluate(() => {
        const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
        return ta ? ta.value : "";
      });
      if (afterFinal.endsWith("，手动修改第三句")) break;
      await sleep(100);
    }
    check("打字后语音实时继续入框（不等停止）", afterFinal.endsWith("，手动修改第三句"), JSON.stringify(afterFinal.slice(0, 50)));

    // ── 全删: 停止后不得复活 ──
    await taEl.evaluate((t) => { try { t.focus(); t.select(); } catch { /* ignore */ } });
    await page.keyboard.press("Delete");
    await sleep(300);
    const cleared = await page.evaluate(() => {
      const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
      return ta ? ta.value : "";
    });
    check("全选删除后输入框为空", cleared === "", JSON.stringify(cleared));
    // 等第四轮确认句（5200ms）: 实时追加到空框
    let revived = "";
    const tDel = Date.now();
    while (Date.now() - tDel < 8000) {
      revived = await page.evaluate(() => {
        const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
        return ta ? ta.value : "";
      });
      if (revived === "第四句") break;
      await sleep(200);
    }
    check("全删后新识别仍实时入框", revived === "第四句", JSON.stringify(revived));

    // 手动停止: 已删文字不得复活
    await micBtn.click();
    await sleep(700);
    const stopped = await page.evaluate(() => {
      const p = document.querySelector(".chatvoice-preview");
      return {
        recording: !!document.querySelector(".chatvoice-recording"),
        previewHidden: !p || p.style.display === "none",
        value: (() => { const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly); return ta ? ta.value : ""; })(),
      };
    });
    check("点击停止后结束聆听、文本保留", !stopped.recording && stopped.value === "第四句", JSON.stringify({ recording: stopped.recording, value: stopped.value.slice(0, 30) }));
    check("已删文字停止后不复活", !stopped.value.includes("你好世界") && !stopped.value.includes("，手动修改"), JSON.stringify(stopped.value.slice(0, 40)));
    check("停止后预览框淡出隐藏", stopped.previewHidden, "hidden=" + stopped.previewHidden);

    // 停止后再点: 开新一轮, 在已有文本上继续累积
    await micBtn.click();
    await sleep(250);
    const restarted = await page.evaluate(() => !!document.querySelector(".chatvoice-recording"));
    check("停止后再次点击可开新一轮聆听", restarted);
    let value2 = "";
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) {
      value2 = await page.evaluate(() => {
        const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly);
        return ta ? ta.value : "";
      });
      if (value2.startsWith("第四句") && value2.includes("你好世界继续听写")) break;
      await sleep(200);
    }
    check("新一轮在已有文本上继续累积", value2.startsWith("第四句") && value2.includes("你好世界继续听写"), JSON.stringify(value2.slice(0, 40)));
    await micBtn.click(); // 收尾停掉
    await sleep(600);
  } else {
    check("点击后 300ms 内出现聆听态预览（即时反馈）", false, "无按钮可点");
    check("多句 final 累积写入输入框（连续听写）", false, "无按钮可点");
    check("说完多句不自动停止（持续聆听中）", false, "无按钮可点");
    check("点击停止后结束聆听、文本保留", false, "无按钮可点");
    check("停止后预览框淡出隐藏", false, "无按钮可点");
    check("停止后再次点击可开新一轮聆听", false, "无按钮可点");
    check("新一轮在已有文本上继续累积", false, "无按钮可点");
  }

  /* ── 3. 小喇叭注入（只挂最终结论）+ 朗读调用链（DOM 注入假消息） ── */
  await page.evaluate(() => {
    const container = document.querySelector("[data-chat-flow]") || document.body;
    const think = document.createElement("div");
    think.setAttribute("data-chat-flow-kind", "assistant-step");
    think.setAttribute("data-chat-flow-key", "e2e-think-1");
    think.innerHTML =
      '<div data-disclosure-row="true"><span>Think</span></div>' +
      '<div class="_markdown_1nba0_5"><p>这是思维链文本，不应出现小喇叭。</p></div>';
    const concl = document.createElement("div");
    concl.setAttribute("data-chat-flow-kind", "assistant-step");
    concl.setAttribute("data-chat-flow-key", "e2e-concl-1");
    concl.innerHTML =
      '<div data-disclosure-row="true"><span>Think</span></div>' +
      '<div class="_markdown_1nba0_5"><p>你好，这是测试朗读文本。</p><pre><code>console.log("skip me")</code></pre></div>';
    container.appendChild(think);
    container.appendChild(concl);
  });
  let speakBtn = null;
  try {
    speakBtn = await page.waitForSelector('[data-chat-flow-key="e2e-concl-1"] [data-chatvoice-speak]', { timeout: 15000 });
  } catch { /* 下方统一断言 */ }
  await sleep(500);
  const placement = await page.evaluate(() => {
    const think = document.querySelector('[data-chat-flow-key="e2e-think-1"]');
    const concl = document.querySelector('[data-chat-flow-key="e2e-concl-1"]');
    const thinkBtn = think && think.querySelector("[data-chatvoice-speak]");
    const conclBtn = concl && concl.querySelector("[data-chatvoice-speak]");
    return {
      thinkHasBtn: !!thinkBtn,
      conclHasBtn: !!conclBtn,
      conclBtnInMd: !!(conclBtn && conclBtn.closest("[class*=markdown]")),
      conclBtnInDisc: !!(conclBtn && conclBtn.closest("[data-disclosure-row]")),
    };
  });
  check("思维链与结论都挂小喇叭（按用户接受的现状）", placement.thinkHasBtn && placement.conclHasBtn, JSON.stringify(placement));
  check("小喇叭位于正文内、不在 Think 标题行", placement.conclBtnInMd && !placement.conclBtnInDisc, JSON.stringify(placement));

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
    const cvTab1 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Talk to Text"));
    await cvTab1.asElement().click();
    await sleep(1200);
    await page.evaluate(() => {
      const cb = document.querySelector('.chatvoice-label input[type="checkbox"]');
      cb.click();
    });
    await sleep(300);
    const saveBtn1 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("保存设置")));
    await saveBtn1.asElement().click();
    await sleep(1500);
    const autoCfg = await page.evaluate(() => fetch("/dsh-talk-to-text/config").then((r) => r.json()).catch(() => null));
    check("自动朗读开关已写入宿主配置", !!(autoCfg && autoCfg.value && autoCfg.value.autoSpeak === true), JSON.stringify(autoCfg && autoCfg.value));
    await page.keyboard.press("Escape");
    await sleep(600);

    // 记录自动朗读前的 utterance 基线（此前有预热/手动点击产生的条目）
    const autoBase = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.synthesis ? window.__chatvoiceE2E.synthesis._u.length : 0));
    // 按新 UI 结构注入: 思维链 → tool-call → 最终结论 → turn-tail（自动朗读应只读结论）
    await page.evaluate(() => {
      const container = document.querySelector("[data-chat-flow]") || document.body;
      const mk = (kind, key, mdText) => {
        const item = document.createElement("div");
        item.setAttribute("data-chat-flow-kind", kind);
        item.setAttribute("data-chat-flow-key", key);
        item.innerHTML = mdText
          ? '<div data-disclosure-row="true"><span>Think</span></div><div class="_markdown_1nba0_5"><p>' + mdText + '</p></div>'
          : '<div class="_call">tool</div>';
        container.appendChild(item);
        return item;
      };
      mk("assistant-step", "e2e-auto-think-1", "思维链文本不应被自动朗读。");
      mk("tool-call", "e2e-auto-tool-1", null);
      mk("assistant-step", "e2e-auto-msg-1", "这是自动朗读测试文本。");
      mk("turn-tail", "e2e-auto-tail-1", null);
    });
    let autoUtt = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 12000) {
      autoUtt = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.lastUtterance) || null);
      if (autoUtt && autoUtt.text && autoUtt.text.includes("自动朗读测试文本")) break;
      await sleep(500);
    }
    const autoOk = autoUtt && autoUtt.text && autoUtt.text.includes("自动朗读测试文本") && !autoUtt.text.includes("思维链文本");
    check("自动朗读开关开启后新回复自动朗读（只读最终结论）", autoOk, autoUtt ? JSON.stringify(autoUtt.text).slice(0, 60) : "no auto utterance");
    const autoUtterCount = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.synthesis && window.__chatvoiceE2E.synthesis._u ? window.__chatvoiceE2E.synthesis._u.length : 0));
    check("自动朗读只触发一次（思维链不读）", autoUtterCount === autoBase + 1, "base=" + autoBase + " now=" + autoUtterCount);
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

    /* ── 3.6 全部朗读模式 ── */
    // 清理此前的假消息, 避免旧条目在 all 模式下被补读
    await page.evaluate(() => {
      ["e2e-think-1", "e2e-concl-1", "e2e-auto-think-1", "e2e-auto-tool-1", "e2e-auto-msg-1", "e2e-auto-tail-1"].forEach((k) => {
        const el = document.querySelector('[data-chat-flow-key="' + k + '"]');
        if (el) el.remove();
      });
    });
    // 打开设置 → 切「全部朗读」
    let settingsBtn2 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === "设置"));
    if (!settingsBtn2.asElement()) {
      await page.click('button[aria-label="打开侧边栏"]');
      await sleep(800);
      settingsBtn2 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === "设置"));
    }
    await settingsBtn2.asElement().click();
    await sleep(1500);
    const cvTab2 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Talk to Text"));
    await cvTab2.asElement().click();
    await sleep(1200);
    await page.select(".chatvoice-mode", "all");
    await sleep(300);
    const saveBtn2 = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("保存设置")));
    await saveBtn2.asElement().click();
    await sleep(1500);
    const allCfg = await page.evaluate(() => fetch("/dsh-talk-to-text/config").then((r) => r.json()).catch(() => null));
    check("自动朗读范围已切换为「全部朗读」", !!(allCfg && allCfg.value && allCfg.value.autoSpeakMode === "all"), JSON.stringify(allCfg && allCfg.value));
    await page.keyboard.press("Escape");
    await sleep(600);

    const base2 = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.synthesis ? window.__chatvoiceE2E.synthesis._u.length : 0));
    await page.evaluate(() => {
      const container = document.querySelector("[data-chat-flow]") || document.body;
      const mk = (kind, key, mdText) => {
        const item = document.createElement("div");
        item.setAttribute("data-chat-flow-kind", kind);
        item.setAttribute("data-chat-flow-key", key);
        item.innerHTML = mdText
          ? '<div data-disclosure-row="true"><span>Think</span></div><div class="_markdown_1nba0_5"><p>' + mdText + '</p></div>'
          : '<div class="_call">tool</div>';
        container.appendChild(item);
        return item;
      };
      mk("assistant-step", "e2e-all-think-1", "全部朗读模式应读的思维链文本。");
      mk("tool-call", "e2e-all-tool-1", null);
      mk("assistant-step", "e2e-all-concl-1", "全部朗读模式应读的结论文本。");
      mk("turn-tail", "e2e-all-tail-1", null);
    });
    let allTexts = [];
    const t2 = Date.now();
    while (Date.now() - t2 < 15000) {
      allTexts = await page.evaluate(() => (window.__chatvoiceE2E && window.__chatvoiceE2E.synthesis ? window.__chatvoiceE2E.synthesis._u.map((u) => u.text) : []));
      if (allTexts.some((t) => t && t.includes("结论文本")) && allTexts.some((t) => t && t.includes("思维链文本"))) break;
      await sleep(500);
    }
    const allOk = allTexts.some((t) => t && t.includes("全部朗读模式应读的结论文本")) && allTexts.some((t) => t && t.includes("全部朗读模式应读的思维链文本"));
    check("全部朗读模式: 思维链与结论都被朗读", allOk, JSON.stringify(allTexts.slice(-4)));
    await page.evaluate(() => {
      ["e2e-all-think-1", "e2e-all-tool-1", "e2e-all-concl-1", "e2e-all-tail-1"].forEach((k) => {
        const el = document.querySelector('[data-chat-flow-key="' + k + '"]');
        if (el) el.remove();
      });
    });
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
    const chatvoiceTab = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Talk to Text"));
    const hasTab = !!chatvoiceTab.asElement();
    check("设置页出现 Talk to Text 分组", hasTab);
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
        const cb = document.querySelector('.chatvoice-label input[type="checkbox"]');
        if (cb && cb.checked) cb.click();
      });
      await sleep(200);
      await page.select(".chatvoice-mode", "final");
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
      const serverCfg = await page.evaluate(() => fetch("/dsh-talk-to-text/config").then((r) => r.json()).catch((e) => ({ fetchErr: String(e) })));
      check("设置持久化到宿主（GET /config 返回 rate=1.5）", serverCfg && serverCfg.value && serverCfg.value.rate === 1.5, JSON.stringify(serverCfg && serverCfg.value));
      check("自动朗读已复位为关闭", serverCfg && serverCfg.value && serverCfg.value.autoSpeak === false, JSON.stringify(serverCfg && serverCfg.value));
      check("自动朗读范围复位为只读结论", serverCfg && serverCfg.value && serverCfg.value.autoSpeakMode === "final", JSON.stringify(serverCfg && serverCfg.value));
      await page.keyboard.press("Escape");
      await sleep(600);
    }
  } catch (e) {
    check("设置页 Talk to Text 分组", false, String(e).slice(0, 160));
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
