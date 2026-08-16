// scripts/gif.mjs — 生成 README 演示 GIF（三种场景 × 中英双语, 共 6 个）。
//   DSH_GIF_SCENE=input  → docs/demo-input.gif(.en)   语音输入
//   DSH_GIF_SCENE=speak  → docs/demo-speak.gif(.en)   回复朗读（真实对话）
//   DSH_GIF_SCENE=edit   → docs/demo-edit.gif(.en)    边听边改（打字修改）
//   DSH_GIF_LANG=zh|en（默认 zh）
// 依赖: puppeteer-core(devDep) + 系统 ffmpeg(合成 GIF)。
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DSH_URL = process.env.DSH_TEST_URL || "http://127.0.0.1:3091";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LANG = process.env.DSH_GIF_LANG === "en" ? "en" : "zh";
const SCENE = ["input", "speak", "edit"].includes(process.env.DSH_GIF_SCENE) ? process.env.DSH_GIF_SCENE : "input";
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = join(ROOT_DIR, "docs", "frames", SCENE + "-" + LANG);
const OUT_GIF = join(ROOT_DIR, "docs", "demo-" + SCENE + (LANG === "en" ? ".en" : "") + ".gif");

const T = LANG === "en"
  ? { interim: "Hello", final1: "Hello world", final2: "keep dictating", final3: "edit anytime", final4: "after deleting", prompt: "Reply with exactly one sentence: Hello world! This is the ChatVoice read-aloud demo." }
  : { interim: "你好", final1: "你好世界", final2: "继续听写", final3: "随时修改", final4: "删除之后", prompt: "请只回复一句：你好，世界！这是 ChatVoice 语音朗读演示。" };

// 场景化假识别事件: [延迟ms, resultIndex, results]
const F = (text, isFinal) => ({ 0: { transcript: text }, isFinal });
const SR_EVENTS = (() => {
  const base = [F(T.final1, true)];
  if (SCENE === "input") {
    return [
      [500, 0, [F(T.interim, false)]],
      [1200, 0, [F(T.final1, true)]],
    ];
  }
  if (SCENE === "edit") {
    const acc2 = [...base, F(T.final2, true)];
    const acc3 = [...acc2, F(T.final3, true)];
    return [
      [500, 0, [F(T.interim, false)]],
      [1200, 0, [F(T.final1, true)]],
      [1800, 1, [...base, F(T.final2, true)]],
      [3200, 2, [...acc2, F(T.final3, false)]],
      [3600, 2, [...acc2, F(T.final3, true)]],
      [4800, 3, [...acc3, F(T.final4, true)]],
    ];
  }
  return [];
})();
const SR_LINES = SR_EVENTS.map(([ms, ri, results]) =>
  "      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: " + ri + ", results: " + JSON.stringify(results) + " }); }, " + ms + ");"
).join("\n");

const STUB = `
(function () {
  const fakeSR = class {
    constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null; }
    start() {
      if (this.onstart) this.onstart();
      // continuous=true 语义: 逐句累积, 不自动结束
${SR_LINES}
    }
    stop() { if (this.onend) this.onend(); }
    abort() { if (this.onend) this.onend(); }
  };
  try { Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: fakeSR }); } catch (e) { window.SpeechRecognition = fakeSR; }
  try { Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: fakeSR }); } catch (e) { window.webkitSpeechRecognition = fakeSR; }
  const syn = {
    getVoices() { return [{ name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)", lang: "zh-CN" }]; },
    speak(u) {},
    cancel() {},
    addEventListener() {},
    onvoiceschanged: null,
  };
  try { Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true, value: syn }); } catch (e) { window.speechSynthesis = syn; }
  const FakeUtterance = class { constructor(text) { this.text = text; this.lang = ""; this.voice = null; this.rate = 1; this.pitch = 1; this.onend = null; this.onerror = null; } };
  try { Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: FakeUtterance }); } catch (e) { window.SpeechSynthesisUtterance = FakeUtterance; }
})();
`;

mkdirSync(FRAMES, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, n) => page.screenshot({ path: join(FRAMES, "frame-" + String(n).padStart(2, "0") + ".png") });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  defaultViewport: { width: 1080, height: 720, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(STUB);
  await page.goto(DSH_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);
  try {
    const newBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "新建会话" || (b.getAttribute("aria-label") || "").includes("新建会话")));
    if (newBtn.asElement()) { await newBtn.asElement().click(); await sleep(1500); }
  } catch { /* 若无按钮则用当前视图 */ }

  const mic = await page.waitForSelector("[data-chatvoice-mic]", { timeout: 20000 });
  await mic.scrollIntoView();
  const composerHandle = () => page.evaluateHandle(() => [...document.querySelectorAll("textarea")].find((t) => !t.readOnly));
  const getValue = () => page.evaluate(() => { const ta = [...document.querySelectorAll("textarea")].find((t) => !t.readOnly); return ta ? ta.value : ""; });

  if (SCENE === "input") {
    await sleep(600); await shot(page, 1);            // 待机
    await mic.click(); await sleep(250); await shot(page, 2);   // 聆听态气泡
    await sleep(450); await shot(page, 3);            // 中间结果进气泡
    await sleep(650); await shot(page, 4);            // 确认句入框
    await sleep(700); await shot(page, 5);            // 持续聆听
    await mic.click(); await sleep(500); await shot(page, 6);   // 停止
  } else if (SCENE === "speak") {
    await sleep(600); await shot(page, 1);            // 待机
    await page.evaluate((tpl) => {
      const t = [...document.querySelectorAll("textarea")].find((x) => !x.readOnly);
      if (!t) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      if (t._valueTracker) t._valueTracker.setValue(t.value);
      setter.call(t, tpl.prompt);
      t.dispatchEvent(new Event("input", { bubbles: true }));
    }, T);
    await sleep(300);
    const sendBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "发送消息"));
    if (sendBtn.asElement()) await sendBtn.asElement().click();
    let speakBtn = null;
    try { speakBtn = await page.waitForSelector('[data-chat-flow-kind="assistant-step"] [data-chatvoice-speak]', { timeout: 180000 }); } catch { /* 兜底下面处理 */ }
    if (!speakBtn) {
      await page.evaluate((tpl) => {
        const item = document.createElement("div");
        item.setAttribute("data-chat-flow-kind", "assistant-step");
        item.setAttribute("data-chat-flow-key", "gif-demo-msg");
        item.style.cssText = "position:fixed;top:96px;left:50%;transform:translateX(-50%);width:560px;z-index:2147482000;";
        item.innerHTML = '<div data-disclosure-row="true"><span>assistant</span></div><div class="_markdown_1nba0_5"><h2>' + tpl.final1 + ' 👋</h2><p>' + tpl.prompt + '</p></div>';
        document.body.appendChild(item);
      }, T);
      speakBtn = await page.waitForSelector('[data-chat-flow-key="gif-demo-msg"] [data-chatvoice-speak]', { timeout: 15000 });
    }
    await speakBtn.scrollIntoView(); await sleep(800); await shot(page, 2);   // 回复 + 小喇叭
    await speakBtn.click(); await sleep(500); await shot(page, 3);            // 朗读中 ⏹
    await speakBtn.click(); await sleep(400); await shot(page, 4);            // 停止
  } else if (SCENE === "edit") {
    await sleep(600); await shot(page, 1);            // 待机
    await mic.click(); await sleep(250); await shot(page, 2);   // 聆听态
    await sleep(1700); await shot(page, 3);            // 你好世界继续听写 入框（聆听中）
    const taEl = await composerHandle();
    await taEl.asElement().click();
    await taEl.evaluate((t) => { try { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } catch { /* ignore */ } });
    await page.keyboard.type(LANG === "en" ? ", typed fix" : "，手动修改");
    await sleep(400); await shot(page, 4);            // 打字修改
    let v = "";
    const t3 = Date.now();
    while (Date.now() - t3 < 6000) { v = await getValue(); if (v.includes(T.final3)) break; await sleep(100); }
    await sleep(300); await shot(page, 5);            // 语音实时追加在修改之后
    await taEl.evaluate((t) => { try { t.focus(); t.select(); } catch { /* ignore */ } });
    await page.keyboard.press("Delete");
    await sleep(300); await shot(page, 6);            // 全删
    let v2 = "";
    const t4 = Date.now();
    while (Date.now() - t4 < 6000) { v2 = await getValue(); if (v2.includes(T.final4)) break; await sleep(100); }
    await sleep(300); await shot(page, 7);            // 删除后新识别实时入框
    await mic.click(); await sleep(500); await shot(page, 8);   // 停止（不复活）
  }

  console.log("frames captured for", SCENE, LANG);
} finally {
  await browser.close();
}

const cmd =
  'ffmpeg -y -framerate 1.5 -i "' + join(FRAMES, "frame-%02d.png") + '" -vf "scale=760:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" -loop 0 "' + OUT_GIF + '"';
try {
  execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: "pipe" });
  console.log("GIF written:", OUT_GIF, existsSync(OUT_GIF) ? "(exists)" : "(MISSING!)");
} catch (e) {
  console.log("ffmpeg failed:", String(e.stderr || e).slice(0, 800));
}
