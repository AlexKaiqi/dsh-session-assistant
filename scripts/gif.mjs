// scripts/gif.mjs — 生成 README 演示 GIF（docs/demo.gif）。
// 用假 SpeechRecognition 驱动真实 UI: 麦克风识别→文本入框→小喇叭朗读的闭环。
// 依赖: puppeteer-core(devDep) + 系统 ffmpeg(合成 GIF)。
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DSH_URL = process.env.DSH_TEST_URL || "http://127.0.0.1:3091";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = join(ROOT_DIR, "docs", "frames");
const OUT_GIF = join(ROOT_DIR, "docs", "demo.gif");

const STUB = `
(function () {
  const E2E = (window.__chatvoiceE2E = window.__chatvoiceE2E || {});
  const fakeSR = class {
    constructor() { this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onstart = null; this.onresult = null; this.onerror = null; this.onend = null; }
    start() {
      if (this.onstart) this.onstart();
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: "你好" }, isFinal: false }] }); }, 500);
      setTimeout(() => { if (this.onresult) this.onresult({ resultIndex: 0, results: [{ 0: { transcript: "你好世界" }, isFinal: true }] }); }, 1200);
      setTimeout(() => { if (this.onend) this.onend(); }, 1800);
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
  await page.evaluateOnNewDocument(STUB);
  await page.goto(DSH_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);

  // 新建干净会话（避免上一次运行的历史消息干扰画面）
  try {
    const newBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "新建会话" || (b.getAttribute("aria-label") || "").includes("在“simple”中新建会话")));
    if (newBtn.asElement()) { await newBtn.asElement().click(); await sleep(1500); }
  } catch { /* 若无按钮则用当前视图 */ }

  const mic = await page.waitForSelector("[data-chatvoice-mic]", { timeout: 20000 });
  await mic.scrollIntoView();
  await sleep(600);
  await page.screenshot({ path: join(FRAMES, "frame-01.png") });

  // 开始识别 → 录制中（红色脉冲）+ 中间结果预览
  await mic.click();
  await sleep(700);
  await page.screenshot({ path: join(FRAMES, "frame-02.png") });

  // 识别结束 → 文本入框
  await sleep(1700);
  await page.screenshot({ path: join(FRAMES, "frame-03.png") });

  // 注入一条助手回复到对话容器（真实会话中由流式渲染自动出现）
  await page.evaluate(() => {
    const container = document.querySelector("[data-chat-flow]") || document.body;
    const item = document.createElement("div");
    item.setAttribute("data-chat-flow-kind", "assistant-step");
    item.setAttribute("data-chat-flow-key", "gif-demo-msg");
    item.innerHTML =
      '<div data-disclosure-row="true"><span>assistant</span></div>' +
      '<div class="_markdown_1nba0_5"><h2>你好，世界 👋</h2><p>这是 ChatVoice 的朗读演示：点击消息旁的小喇叭，AI 回复就会被读出来。</p></div>';
    container.appendChild(item);
  });
  const speakBtn = await page.waitForSelector('[data-chat-flow-key="gif-demo-msg"] [data-chatvoice-speak]', { timeout: 15000 });
  await speakBtn.scrollIntoView();
  await sleep(600);
  await page.screenshot({ path: join(FRAMES, "frame-04.png") });

  // 朗读中（停止态）
  await speakBtn.click();
  await sleep(500);
  await page.screenshot({ path: join(FRAMES, "frame-05.png") });

  // 停止
  await speakBtn.click();
  await sleep(400);
  await page.screenshot({ path: join(FRAMES, "frame-06.png") });

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
