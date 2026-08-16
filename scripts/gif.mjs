// scripts/gif.mjs — 生成 README 演示 GIF（docs/demo.gif）。
// 用假 SpeechRecognition 驱动真实 UI: 聆听态→中间结果→连续听写入框→小喇叭朗读。
// 依赖: puppeteer-core(devDep) + 系统 ffmpeg(合成 GIF)。
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DSH_URL = process.env.DSH_TEST_URL || "http://127.0.0.1:3091";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LANG = process.env.DSH_GIF_LANG === "en" ? "en" : "zh"; // zh: docs/demo.gif; en: docs/demo.en.gif
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = join(ROOT_DIR, "docs", "frames");
const OUT_GIF = join(ROOT_DIR, "docs", LANG === "en" ? "demo.en.gif" : "demo.gif");
const T = LANG === "en"
  ? { interim: "Hello", final1: "Hello world", final2: "keep dictating", prompt: "Reply with exactly one sentence: Hello world! This is the ChatVoice read-aloud demo.", heading: "Hello world 👋", body: "This is the ChatVoice read-aloud demo: click the speaker next to the reply and the AI answer is read out loud." }
  : { interim: "你好", final1: "你好世界", final2: "继续听写", prompt: "请只回复一句：你好，世界！这是 ChatVoice 语音朗读演示。", heading: "你好，世界 👋", body: "这是 ChatVoice 的朗读演示：点击消息旁的小喇叭，AI 回复就会被读出来。" };

const STUB = `
(function () {
  const T = window.__GIF_T || {};
  const E2E = (window.__chatvoiceE2E = window.__chatvoiceE2E || {});
  const fakeSR = class {
    constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null; }
    start() {
      if (this.onstart) this.onstart();
      // continuous=true 语义: 逐句累积, 不自动结束
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: T.interim }, isFinal: false }] }); }, 500);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: T.final1 }, isFinal: true }] }); }, 1200);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 1, results: [{ 0: { transcript: T.final1 }, isFinal: true }, { 0: { transcript: T.final2 }, isFinal: true }] }); }, 1800);
    }
    stop() { if (this.onend) this.onend(); }
    abort() { if (this.onend) this.onend(); }
  };
  try { Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: fakeSR }); } catch (e) { window.SpeechRecognition = fakeSR; }
  try { Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: fakeSR }); } catch (e) { window.webkitSpeechRecognition = fakeSR; }
  const syn = {
    getVoices() { return [{ name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)", lang: "zh-CN" }]; },
    speak(u) { E2E.lastUtterance = u; },
    cancel() {},
    addEventListener() {},
    onvoiceschanged: null,
  };
  try { Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true, value: syn }); } catch (e) { window.speechSynthesis = syn; }
  E2E.synthesis = syn;
  const FakeUtterance = class { constructor(text) { this.text = text; this.lang = ""; this.voice = null; this.rate = 1; this.pitch = 1; this.onend = null; this.onerror = null; } };
  try { Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: FakeUtterance }); } catch (e) { window.SpeechSynthesisUtterance = FakeUtterance; }
})();
`;

mkdirSync(FRAMES, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  defaultViewport: { width: 1080, height: 720, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument('window.__GIF_T = ' + JSON.stringify(T) + ';' + STUB);
  await page.goto(DSH_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);

  // 新建干净会话
  try {
    const newBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "新建会话" || (b.getAttribute("aria-label") || "").includes("新建会话")));
    if (newBtn.asElement()) { await newBtn.asElement().click(); await sleep(1500); }
  } catch { /* 若无按钮则用当前视图 */ }

  const mic = await page.waitForSelector("[data-chatvoice-mic]", { timeout: 20000 });
  await mic.scrollIntoView();
  await sleep(600);
  await page.screenshot({ path: join(FRAMES, "frame-01.png") });

  // 点击 → 立即聆听态预览（呼吸动画, 锚定输入框上方）
  await mic.click();
  await sleep(250);
  await page.screenshot({ path: join(FRAMES, "frame-02.png") });

  // 中间结果逐字上屏
  await sleep(450);
  await page.screenshot({ path: join(FRAMES, "frame-03.png") });

  // 第一句 final 入框
  await sleep(750);
  await page.screenshot({ path: join(FRAMES, "frame-04.png") });

  // 第二句继续累积（连续听写不自动停）
  await sleep(750);
  await page.screenshot({ path: join(FRAMES, "frame-05.png") });

  // 手动停止
  await mic.click();
  await sleep(500);
  await page.screenshot({ path: join(FRAMES, "frame-06.png") });

  // 真实对话: 发一条消息, 等真实 AI 回复 —— 回复上的小喇叭才是真实场景
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
  if (sendBtn.asElement()) { await sendBtn.asElement().click(); console.log("message sent"); }
  let speakBtn = null;
  try {
    speakBtn = await page.waitForSelector('[data-chat-flow-kind="assistant-step"] [data-chatvoice-speak]', { timeout: 180000 });
    console.log("real reply + speaker found");
  } catch { console.log("real reply timeout — fallback fake message"); }
  if (!speakBtn) {
    // 兜底: 固定定位的假消息（保证 GIF 有可拍画面）
    await page.evaluate((t) => {
      const item = document.createElement("div");
      item.setAttribute("data-chat-flow-kind", "assistant-step");
      item.setAttribute("data-chat-flow-key", "gif-demo-msg");
      item.style.cssText = "position:fixed;top:96px;left:50%;transform:translateX(-50%);width:560px;z-index:2147482000;";
      item.innerHTML =
        '<div data-disclosure-row="true"><span>assistant</span></div>' +
        '<div class="_markdown_1nba0_5"><h2>' + t.heading + '</h2><p>' + t.body + '</p></div>';
      document.body.appendChild(item);
    }, T);
    speakBtn = await page.waitForSelector('[data-chat-flow-key="gif-demo-msg"] [data-chatvoice-speak]', { timeout: 15000 });
  }
  await speakBtn.scrollIntoView();
  await sleep(800);
  await page.screenshot({ path: join(FRAMES, "frame-07.png") });

  // 朗读中（停止态）
  await speakBtn.click();
  await sleep(500);
  await page.screenshot({ path: join(FRAMES, "frame-08.png") });

  // 停止
  await speakBtn.click();
  await sleep(400);
  await page.screenshot({ path: join(FRAMES, "frame-09.png") });

  console.log("frames captured");
} finally {
  await browser.close();
}

// ffmpeg 合成 GIF
const cmd =
  'ffmpeg -y -framerate 1.5 -i "' + join(FRAMES, "frame-%02d.png") + '" -vf "scale=760:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" -loop 0 "' + OUT_GIF + '"';
try {
  execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: "pipe" });
  console.log("GIF written:", OUT_GIF, existsSync(OUT_GIF) ? "(exists)" : "(MISSING!)");
} catch (e) {
  console.log("ffmpeg failed:", String(e.stderr || e).slice(0, 800));
}
