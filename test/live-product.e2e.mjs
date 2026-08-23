import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { chromium } from "playwright";
import WebSocket, { WebSocketServer } from "ws";

const run = promisify(execFile);
const LIVE = process.env.DSH_SESSION_VOICE_E2E_LIVE === "1";
const TARGET = new URL(
  process.env.DSH_VOICE_E2E_BASE_URL || "http://127.0.0.1:3080",
);
const ROUTE_ID =
  process.env.DSH_VOICE_E2E_ROUTE_ID ||
  "doubao/realtime/zh_female_vv_jupiter_bigtts";
const PROBE =
  process.env.DSH_SESSION_VOICE_E2E_PROBE || "会话助手端到端验证八二四六";
const UTTERANCE =
  process.env.DSH_SESSION_VOICE_E2E_UTTERANCE ||
  `请把当前草稿改成：${PROBE}。不要提交。`;
const TIMEOUT = Math.max(
  20_000,
  Number(process.env.DSH_VOICE_E2E_TIMEOUT_MS) || 90_000,
);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VOICE_CLIENT = fileURLToPath(
  new URL("../../dsh-realtime-voice/client/client.js", import.meta.url),
);
const WS_PROTOCOL = "dsh-realtime-voice-v1";

function pageSource() {
  return `<!doctype html><meta charset="utf-8"><main>session voice e2e</main>
<script>window.__voiceExports=null;window.__ModuleLoader__={load(d){window.__voiceExports=d.factory(n=>{if(n!=='@deepseek-ai/cordis')throw Error(n);return{Service:class{constructor(c,n){c.reflect.provide(n,this)}}}})}}</script>
<script src="/voice-client.js"></script>
<script type="module">
import { VoiceController, selectVoiceRoute, voiceConversationOptions } from '/session/controller.js'
const state={draft:'',submitted:0,events:[],service:null,controller:null,context:null,destination:null}
async function microphone(){if(!state.context){state.context=new AudioContext();state.destination=state.context.createMediaStreamDestination()}await state.context.resume();return new MediaStream(state.destination.stream.getAudioTracks().map(t=>t.clone()))}
Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:microphone})
window.__sessionE2E={
 async start(){const ctx={reflect:{provide(){}}};state.service=new window.__voiceExports.VoiceAgentService(ctx,{root:window,basePath:'/dsh-realtime-voice'});const settings={recognitionProvider:'doubao-realtime',recognitionLang:'zh-CN',openaiRealtimeModel:'',openaiRealtimeVoice:'marin',doubaoRealtimeModel:'',openaiContextMode:'recent',autoSpeak:false,autoSpeakMode:'final',voiceName:'',rate:1,wakeWord:'你好助手'};const models=await state.service.models();const routeId=selectVoiceRoute(settings,models);if(routeId!=='${ROUTE_ID}')throw Error('auto-selected unexpected route: '+routeId);state.controller=new VoiceController({sessionId:'voice-e2e-session',inputActions:{setDraft(v){state.draft=v},submit(){state.submitted++}},getInput:()=>({draft:state.draft}),context:async()=>'',startConversation:async()=>{const h=await state.service.startConversation({...voiceConversationOptions(settings,'Product live E2E; editable draft is empty.',routeId),ownerId:'session-assistant:voice-e2e-session'});h.subscribe(e=>state.events.push(JSON.parse(JSON.stringify(e))));return h},registerActions:tools=>{const r=state.service.registerActions('session-assistant:voice-e2e-session',tools);return()=>r.dispose()}});await state.controller.start()},
 async feed(b64){const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const b=await state.context.decodeAudioData(bytes.buffer);const s=state.context.createBufferSource();s.buffer=b;s.connect(state.destination);s.start();await new Promise(r=>s.onended=r)},
 snapshot(){return{draft:state.draft,submitted:state.submitted,events:state.events,controller:state.controller&&state.controller.getSnapshot(),audioInput:state.service&&state.service.capabilities().audioInput}},
 async stop(){if(state.controller)await state.controller.dispose();const audioInput=state.service&&state.service.capabilities().audioInput;if(state.service)state.service.dispose();if(state.context&&state.context.state!=='closed')await state.context.close();return{audioInput}}
};window.__sessionE2EReady=true
</script>`;
}

async function generateAudio(directory) {
  const supplied = process.env.DSH_SESSION_VOICE_E2E_WAV;
  if (supplied) return readFile(supplied);
  assert.equal(
    process.platform,
    "darwin",
    "set DSH_SESSION_VOICE_E2E_WAV outside macOS",
  );
  const aiff = join(directory, "input.aiff");
  const wav = join(directory, "input.wav");
  await run("/usr/bin/say", [
    "-v",
    process.env.DSH_VOICE_E2E_MACOS_VOICE || "Tingting",
    "-r",
    "150",
    "-o",
    aiff,
    UTTERANCE,
  ]);
  await run("/usr/bin/afconvert", [
    aiff,
    wav,
    "-f",
    "WAVE",
    "-d",
    "LEI16@24000",
    "-c",
    "1",
  ]);
  return readFile(wav);
}

async function waitFor(check, message) {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function harness(stats) {
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(TARGET.hostname) &&
      TARGET.pathname === "/",
    "live E2E target must be a loopback origin",
  );
  const controller = await readFile(join(ROOT, "lib/controller.js"), "utf8");
  const chunkMatch = controller.match(/from "\.\/(context-[^"]+\.js)"/);
  assert.ok(chunkMatch, "built controller context chunk was not found");
  const assets = new Map([
    [
      "/voice-client.js",
      { body: await readFile(VOICE_CLIENT), type: "text/javascript" },
    ],
    ["/session/controller.js", { body: controller, type: "text/javascript" }],
    [
      `/session/${chunkMatch[1]}`,
      {
        body: await readFile(join(ROOT, "lib", chunkMatch[1])),
        type: "text/javascript",
      },
    ],
  ]);
  const downstreamServer = new WebSocketServer({ noServer: true });
  const sockets = new Set();
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://e2e.invalid").pathname;
    if (path === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageSource());
      return;
    }
    if (assets.has(path)) {
      const asset = assets.get(path);
      res.writeHead(200, { "content-type": asset.type });
      res.end(asset.body);
      return;
    }
    if (!path.startsWith("/dsh-realtime-voice/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const upstream = new URL(req.url, TARGET);
    const outgoing = httpRequest(
      upstream,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: TARGET.host,
          origin: TARGET.origin,
          "sec-fetch-site": "same-origin",
        },
      },
      (incoming) => {
        res.writeHead(incoming.statusCode || 502, incoming.headers);
        incoming.pipe(res);
      },
    );
    outgoing.on("error", (error) => {
      res.writeHead(502);
      res.end(error.message);
    });
    req.pipe(outgoing);
  });
  server.on("upgrade", (req, socket, head) => {
    if (
      new URL(req.url, "http://e2e.invalid").pathname !==
      "/dsh-realtime-voice/doubao"
    ) {
      socket.destroy();
      return;
    }
    downstreamServer.handleUpgrade(req, socket, head, (downstream) => {
      stats.providerSockets++;
      sockets.add(downstream);
      const url = new URL("/dsh-realtime-voice/doubao", TARGET);
      url.protocol = "ws:";
      const upstream = new WebSocket(url, WS_PROTOCOL, {
        headers: { origin: TARGET.origin, "sec-fetch-site": "same-origin" },
      });
      sockets.add(upstream);
      const pending = [];
      downstream.on("message", (d, b) =>
        upstream.readyState === WebSocket.OPEN
          ? upstream.send(d, { binary: b })
          : pending.push([d, b]),
      );
      upstream.on("open", () =>
        pending.splice(0).forEach(([d, b]) => upstream.send(d, { binary: b })),
      );
      upstream.on("message", (d, b) => {
        if (!b) {
          try {
            const e = JSON.parse(String(d));
            if (e.type === "response.output_audio.delta") {
              stats.outputFrames++;
              stats.outputBytes += Buffer.from(e.delta || "", "base64").length;
            }
          } catch {}
        }
        if (downstream.readyState === WebSocket.OPEN)
          downstream.send(d, { binary: b });
      });
      const close = (p) => {
        if (p.readyState < 2) p.close();
      };
      downstream.on("close", () => close(upstream));
      upstream.on("close", () => close(downstream));
      upstream.on("error", (e) => stats.errors.push(e.message));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      sockets.forEach((s) => s.terminate());
      downstreamServer.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test(
  "real speech reaches the Session Assistant product action through the unified voice runtime",
  {
    skip: LIVE
      ? false
      : "set DSH_SESSION_VOICE_E2E_LIVE=1 to authorize a billable live call",
    timeout: TIMEOUT + 30_000,
  },
  async (t) => {
    const models = await fetch(
      new URL("/dsh-realtime-voice/models", TARGET),
    ).then((r) => r.json());
    const route = models.models?.find((model) => model.id === ROUTE_ID);
    assert.equal(route?.available, true, `route ${ROUTE_ID} is unavailable`);
    const temporary = await mkdtemp(join(tmpdir(), "dsh-session-voice-e2e-"));
    const wav = await generateAudio(temporary);
    const stats = {
      providerSockets: 0,
      outputFrames: 0,
      outputBytes: 0,
      errors: [],
    };
    const server = await harness(stats);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto(server.url);
      await page.waitForFunction(() => window.__sessionE2EReady);
      await page.evaluate(() => window.__sessionE2E.start());
      await page.waitForFunction(
        () =>
          window.__sessionE2E
            .snapshot()
            .events.some((e) => e.type === "status" && e.connected),
        null,
        { timeout: TIMEOUT },
      );
      await page.evaluate(
        (b64) => window.__sessionE2E.feed(b64),
        wav.toString("base64"),
      );
      await page.waitForFunction(
        () => window.__sessionE2E.snapshot().draft.length > 0,
        null,
        { timeout: TIMEOUT },
      );
      await waitFor(
        () => stats.outputFrames > 0,
        "provider returned no output audio",
      );
      const before = await page.evaluate(() => window.__sessionE2E.snapshot());
      const stopped = await page.evaluate(() => window.__sessionE2E.stop());
      t.diagnostic(`utterance=${UTTERANCE}`);
      t.diagnostic(`draft=${before.draft}`);
      t.diagnostic(
        `outputFrames=${stats.outputFrames} outputBytes=${stats.outputBytes}`,
      );
      assert.equal(
        before.submitted,
        0,
        "a draft-only utterance must not submit",
      );
      assert.match(before.draft, /会话助手端到端验证|八二四六|8246/);
      assert.equal(stats.providerSockets, 1);
      assert.ok(
        stats.outputFrames > 0 && stats.outputBytes > 1000,
        "provider output audio did not cross the runtime",
      );
      assert.equal(stopped.audioInput.busy, false);
      assert.deepEqual(stats.errors, []);
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
      await server.close().catch(() => {});
      await rm(temporary, { recursive: true, force: true });
    }
  },
);
