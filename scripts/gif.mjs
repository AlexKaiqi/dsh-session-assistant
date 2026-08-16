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

// 每帧讲解文案（叠加在画面顶部）
const CAPS = {
  "input-zh": ["① 待机：点麦克风开始语音输入", "② 点击立即进入聆听态", "③ 中间结果实时进气泡", "④ 确认句「你好世界」实时入框", "⑤ 持续聆听，说完不自动停", "⑥ 再点一下麦克风停止"],
  "input-en": ['1. Idle: click the mic to start', '2. Listening — instant feedback', '3. Interim results in the bubble', '4. "Hello world" lands in the box live', '5. Keeps listening after you finish', '6. Click again to stop'],
  "speak-zh": ["① 发送一条消息", "② AI 回复到达 + 小喇叭按钮", "③ 点小喇叭开始朗读（红色 ⏹）", "④ 再点一下停止朗读"],
  "speak-en": ["1. Send a message", "2. Reply arrives with a speaker button", "3. Click to read aloud (red ⏹)", "4. Click again to stop"],
  "edit-zh": ["① 待机：点麦克风开始", "② 聆听态，逐句累积入框", "③ 已识别：你好世界 继续听写", "④ 识别中直接打字修改", "⑤ 语音实时追加在修改之后", "⑥ 全选删除", "⑦ 删除后新识别仍实时入框", "⑧ 停止：删掉的不回填"],
  "edit-en": ["1. Idle: click the mic", "2. Listening, sentences accumulate", "3. Recognized: hello world, keep dictating", "4. Type fixes while the mic runs", "5. Speech keeps appending live", "6. Select all and delete", "7. New recognition still lands live", "8. Stop: deleted text stays deleted"],
};

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
// 清掉上一帧的特效
const clearFx = (page) => page.evaluate(() => {
  const z = document.getElementById("gif-zoom"); if (z) z.remove();
  document.querySelectorAll("[data-gif-hl]").forEach((el) => {
    el.style.outline = "";
    el.style.boxShadow = "";
    el.removeAttribute("data-gif-hl");
  });
});
// fx: { zoom: "selector" } 红圈高亮 + 右下角 2× 放大特写; { ring: "selector" } 仅红圈
const applyFx = (page, fx) => page.evaluate((f) => {
  if (!f) return;
  const t = document.querySelector(f.zoom || f.ring);
  if (!t) return;
  t.setAttribute("data-gif-hl", "1");
  t.style.outline = "3px solid #f85149";
  t.style.outlineOffset = "4px";
  t.style.boxShadow = "0 0 0 6px rgba(248,81,73,.28)";
  if (f.zoom) {
    const clone = t.cloneNode(true);
    clone.style.position = "static";
    clone.style.top = "auto";
    clone.style.left = "auto";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.transform = "none";
    clone.style.width = "auto";
    clone.style.maxWidth = "280px";
    clone.style.whiteSpace = "normal";
    const wrap = document.createElement("div");
    wrap.id = "gif-zoom";
    wrap.style.cssText = "position:fixed;right:30px;bottom:210px;z-index:2147483002;background:rgba(13,17,23,.95);border:2px solid #f85149;border-radius:16px;padding:16px 20px;transform:scale(2.1);transform-origin:bottom right;box-shadow:0 10px 32px rgba(0,0,0,.55);";
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
  }
}, fx || null);
const shot = async (page, n, cap, fx) => {
  await clearFx(page);
  await applyFx(page, fx);
  // 每帧叠加讲解条（顶部居中, 深色药丸）
  await page.evaluate((t) => {
    let el = document.getElementById("gif-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "gif-caption";
      el.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483001;background:rgba(13,17,23,.94);color:#f0f6fc;border:1px solid rgba(127,127,127,.45);border-radius:12px;padding:11px 24px;font-size:19px;line-height:1.5;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.5);white-space:nowrap;";
      document.body.appendChild(el);
    }
    el.textContent = t || "";
  }, cap || "");
  await sleep(220);
  return page.screenshot({ path: join(FRAMES, "frame-" + String(n).padStart(2, "0") + ".png") });
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
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
    await sleep(600); await shot(page, 1, CAPS["input-" + LANG][0]);
    await mic.click(); await sleep(250); await shot(page, 2, CAPS["input-" + LANG][1], { zoom: "[data-chatvoice-mic]" });      // 放大: 麦克风按钮（红色聆听态）
    await sleep(450); await shot(page, 3, CAPS["input-" + LANG][2], { zoom: ".chatvoice-preview" });                                // 放大: 预览气泡（中间结果逐字上屏）
    await sleep(650); await shot(page, 4, CAPS["input-" + LANG][3], { ring: "textarea" });                                          // 红圈: 输入框（确认句入框）
    await sleep(700); await shot(page, 5, CAPS["input-" + LANG][4], { zoom: "[data-chatvoice-mic]" });                              // 放大: 麦克风按钮（持续聆听红点）
    await mic.click(); await sleep(500); await shot(page, 6, CAPS["input-" + LANG][5]);
  } else if (SCENE === "speak") {
    await sleep(600); await shot(page, 1, CAPS["speak-" + LANG][0]);
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
    await speakBtn.scrollIntoView(); await sleep(800); await shot(page, 2, CAPS["speak-" + LANG][1], { zoom: "[data-chatvoice-speak]" });   // 放大: 回复正文右上角的小喇叭按钮
    await speakBtn.click(); await sleep(500); await shot(page, 3, CAPS["speak-" + LANG][2], { zoom: "[data-chatvoice-speak]" });          // 放大: 同一按钮变为红色 ⏹（朗读中）
    await speakBtn.click(); await sleep(400); await shot(page, 4, CAPS["speak-" + LANG][3]);
  } else if (SCENE === "edit") {
    await sleep(600); await shot(page, 1, CAPS["edit-" + LANG][0]);
    await mic.click(); await sleep(250); await shot(page, 2, CAPS["edit-" + LANG][1], { zoom: "[data-chatvoice-mic]" });   // 放大: 麦克风按钮（聆听态）
    await sleep(1700); await shot(page, 3, CAPS["edit-" + LANG][2], { ring: "textarea" });                                          // 红圈: 输入框（逐句累积）
    const taEl = await composerHandle();
    await taEl.asElement().click();
    await taEl.evaluate((t) => { try { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } catch { /* ignore */ } });
    await page.keyboard.type(LANG === "en" ? ", typed fix" : "，手动修改");
    await sleep(400); await shot(page, 4, CAPS["edit-" + LANG][3], { ring: "textarea" });      // 红圈: 输入框（打字修改处）
    let v = "";
    const t3 = Date.now();
    while (Date.now() - t3 < 6000) { v = await getValue(); if (v.includes(T.final3)) break; await sleep(100); }
    await sleep(300); await shot(page, 5, CAPS["edit-" + LANG][4], { ring: "textarea" });      // 红圈: 输入框（语音追加在修改之后）
    await taEl.evaluate((t) => { try { t.focus(); t.select(); } catch { /* ignore */ } });
    await page.keyboard.press("Delete");
    await sleep(300); await shot(page, 6, CAPS["edit-" + LANG][5], { ring: "textarea" });      // 红圈: 输入框（全选删除后为空）
    let v2 = "";
    const t4 = Date.now();
    while (Date.now() - t4 < 6000) { v2 = await getValue(); if (v2.includes(T.final4)) break; await sleep(100); }
    await sleep(300); await shot(page, 7, CAPS["edit-" + LANG][6], { ring: "textarea" });      // 红圈: 输入框（删除后新识别实时入框）
    await mic.click(); await sleep(500); await shot(page, 8, CAPS["edit-" + LANG][7]);
  }

  console.log("frames captured for", SCENE, LANG);
} finally {
  await browser.close();
}

const cmd =
  'ffmpeg -y -framerate 1/2.2 -i "' + join(FRAMES, "frame-%02d.png") + '" -vf "scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" -loop 0 "' + OUT_GIF + '"';
try {
  execSync(cmd, { encoding: "utf8", timeout: 120000, stdio: "pipe" });
  console.log("GIF written:", OUT_GIF, existsSync(OUT_GIF) ? "(exists)" : "(MISSING!)");
} catch (e) {
  console.log("ffmpeg failed:", String(e.stderr || e).slice(0, 800));
}
