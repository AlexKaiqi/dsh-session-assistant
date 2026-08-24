import { t as buildBoundedContext } from "./context-CjoGznST.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region lib/types/settings-values.js
const OPENAI_REALTIME_VOICES = [
	{
		id: "marin",
		name: "Marin",
		recommended: true
	},
	{
		id: "cedar",
		name: "Cedar",
		recommended: true
	},
	{
		id: "alloy",
		name: "Alloy"
	},
	{
		id: "ash",
		name: "Ash"
	},
	{
		id: "ballad",
		name: "Ballad"
	},
	{
		id: "coral",
		name: "Coral"
	},
	{
		id: "echo",
		name: "Echo"
	},
	{
		id: "sage",
		name: "Sage"
	},
	{
		id: "shimmer",
		name: "Shimmer"
	},
	{
		id: "verse",
		name: "Verse"
	}
];
const OPENAI_VOICE_IDS = new Set(OPENAI_REALTIME_VOICES.map((voice) => voice.id));
const DEFAULT_SETTINGS = {
	recognitionProvider: "doubao-realtime",
	recognitionLang: "zh-CN",
	openaiRealtimeModel: "",
	openaiRealtimeVoice: "marin",
	doubaoRealtimeModel: "",
	openaiContextMode: "recent",
	autoSpeak: false,
	autoSpeakMode: "final",
	voiceName: "",
	rate: 1,
	wakeWord: "你好助手"
};
const DECLARED_SETTINGS_FIELDS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
function normalizeSettings(input) {
	const source = input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
	const provider = source.recognitionProvider;
	const language = source.recognitionLang;
	const contextMode = source.openaiContextMode;
	const speakMode = source.autoSpeakMode;
	const rate = Number(source.rate);
	const route = (field) => typeof source[field] === "string" && /^[A-Za-z0-9._:/-]{0,180}$/.test(source[field]) ? source[field] : "";
	return {
		recognitionProvider: provider === "browser" || provider === "openai-realtime" || provider === "doubao-realtime" ? provider : DEFAULT_SETTINGS.recognitionProvider,
		recognitionLang: language === "en-US" || language === "zh-CN" ? language : DEFAULT_SETTINGS.recognitionLang,
		openaiRealtimeModel: route("openaiRealtimeModel"),
		openaiRealtimeVoice: typeof source.openaiRealtimeVoice === "string" && OPENAI_VOICE_IDS.has(source.openaiRealtimeVoice) ? source.openaiRealtimeVoice : DEFAULT_SETTINGS.openaiRealtimeVoice,
		doubaoRealtimeModel: route("doubaoRealtimeModel"),
		openaiContextMode: contextMode === "off" || contextMode === "draft" || contextMode === "recent" ? contextMode : DEFAULT_SETTINGS.openaiContextMode,
		autoSpeak: typeof source.autoSpeak === "boolean" ? source.autoSpeak : DEFAULT_SETTINGS.autoSpeak,
		autoSpeakMode: speakMode === "all" || speakMode === "final" ? speakMode : DEFAULT_SETTINGS.autoSpeakMode,
		voiceName: typeof source.voiceName === "string" ? source.voiceName : "",
		rate: Number.isFinite(rate) ? Math.min(2, Math.max(.5, rate)) : DEFAULT_SETTINGS.rate,
		wakeWord: typeof source.wakeWord === "string" && source.wakeWord.length <= 24 ? source.wakeWord : DEFAULT_SETTINGS.wakeWord
	};
}
//#endregion
//#region lib/types/settings.js
const SETTINGS_NAMESPACE = settingsNamespace("session-assistant");
const Config = z.object({
	recognitionProvider: z.union([
		"browser",
		"openai-realtime",
		"doubao-realtime"
	]).description("语音后端").default(DEFAULT_SETTINGS.recognitionProvider),
	recognitionLang: z.union(["zh-CN", "en-US"]).description("语音识别语言").default(DEFAULT_SETTINGS.recognitionLang),
	openaiRealtimeModel: z.string().description("OpenAI Realtime 路由；留空自动选择").default(""),
	openaiRealtimeVoice: z.union(OPENAI_REALTIME_VOICES.map((voice) => voice.id)).description("OpenAI Realtime 输出音色").default("marin"),
	doubaoRealtimeModel: z.string().description("豆包 Realtime Duplex 路由；留空自动选择").default(""),
	openaiContextMode: z.union([
		"off",
		"draft",
		"recent"
	]).description("语音会话上下文范围").default("recent"),
	autoSpeak: z.boolean().description("自动朗读主 Agent 的新回复").default(false),
	autoSpeakMode: z.union(["final", "all"]).description("主 Agent 回复朗读范围").default("final"),
	voiceName: z.string().description("朗读音色；留空自动选择").default(""),
	rate: z.number().min(.5).max(2).description("朗读语速").default(1),
	wakeWord: z.string().max(24).description("待机唤醒词；留空禁用待机唤醒").default("你好助手")
});
function registerSessionAssistantSettings(ctx, base) {
	return ctx.settings.register(SETTINGS_NAMESPACE, Config, {
		base: {
			...DEFAULT_SETTINGS,
			...normalizeSettings(base)
		},
		applies: "live"
	});
}
//#endregion
//#region lib/types/migration.js
const CONFIG_PATH = `${homedir()}/.dsh/session-assistant.json`;
const LEGACY_CONFIG_PATHS = Object.freeze([`${homedir()}/.dsh/talk-to-text.json`, `${homedir()}/.dsh/chatvoice.json`]);
function readLegacySettings(candidates = [CONFIG_PATH, ...LEGACY_CONFIG_PATHS], read = readFileSync) {
	for (const path of candidates) try {
		const parsed = JSON.parse(read(path, "utf8"));
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) return normalizeSettings(parsed);
	} catch {}
}
async function migrateLegacySettings(settings, candidates, read) {
	const descriptor = settings.describe().find((item) => item.ns === SETTINGS_NAMESPACE);
	if (descriptor === void 0) throw new Error("session-assistant settings namespace is unavailable");
	const user = descriptor.user;
	if (user !== null && typeof user === "object" && !Array.isArray(user) && Object.keys(user).length > 0) return false;
	const migrated = readLegacySettings(candidates, read);
	if (migrated === void 0) return false;
	await settings.replace(SETTINGS_NAMESPACE, migrated, descriptor.revision);
	return true;
}
//#endregion
//#region lib/types/model/prompt.js
const PROMPT = [
	"You are Session Assistant, the voice frontend for the current Session and its primary Agent. You may discuss, clarify, answer stable general questions, maintain an editable draft, prepare an Agent handoff, submit an authorized request, delegate knowledge organization, and end this voice connection.",
	"You cannot execute tasks, use primary-Agent tools, inspect workspace contents, edit files, browse, run commands, verify current or external state, or claim work was completed. The projected operational context tells you which Session, workspace, and primary Agent are current; it does not grant direct access to them.",
	"Hold a natural full-duplex conversation. Reply briefly in audio and allow interruption.",
	"Classify each user turn before acting. Handle it locally when it only needs conversation, clarification, rewriting, summarization, planning, or stable general knowledge. It requires the primary Agent when it needs workspace or file contents, current project state, shell or Git, web or current external information, configured tools, side effects, verification, or any claim that work was completed. If the intent is ambiguous, ask one targeted clarification question.",
	"For primary-Agent work, do not attempt the task yourself. Call prepare_agent_handoff with a polished, self-contained request and a short reason, then briefly explain that the primary Agent needs to handle it and ask whether to submit now.",
	"After you have just proposed a handoff, an explicit affirmative reply such as yes, okay, go ahead, 可以, 好, or 提交 authorizes submit_to_agent. A direct explicit instruction to submit, send, proceed, or execute also authorizes it. Task-like content by itself is not submission permission.",
	"Keep spoken discussion and the editable draft separate. Discussion must not enter the draft unless the user dictates it, requests an edit, or accepts it.",
	"For dictation, edits, accepted conclusions, or finalization, call update_working_draft with the complete new draft. Do not call it for pure discussion.",
	"When asked to organize or finalize, make the draft polished and self-contained and set status to ready.",
	"When the user asks to organize, save, or remember the discussion as knowledge, call organize_notes with the user's intent instead of summarizing into the draft yourself: the curator agent (a separate text model) consolidates the draft and session into the knowledge base and completion is announced separately.",
	"Only after explicit authorization as defined above, call submit_to_agent with the exact complete request. Never merely say it was submitted.",
	"Never call submit_to_agent with an empty draft. If the user asks to submit or send while the draft is empty, briefly ask what content to send instead of going silent.",
	"If finalization and submission are requested together, submit the polished text directly without a second confirmation.",
	"Call end_voice_session only after an explicit request to end without submitting, never for a pause or interruption.",
	"Preserve technical identifiers, commands, paths, formatting, and the intended language."
].join("\n\n");
const SESSION_ASSISTANT_TOOLS = [
	{
		type: "function",
		name: "update_working_draft",
		strict: true,
		description: "Apply an intentional change to the editable working draft. Do not call this for discussion that leaves the draft unchanged.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: {
				draft: {
					type: "string",
					description: "The complete new working draft."
				},
				summary: {
					type: "string",
					description: "A short change description; not the spoken reply."
				},
				status: {
					type: "string",
					enum: ["drafting", "ready"]
				}
			},
			required: [
				"draft",
				"summary",
				"status"
			]
		}
	},
	{
		type: "function",
		name: "prepare_agent_handoff",
		strict: true,
		description: "Prepare a complete request for work that requires the primary Agent, show the pending handoff in the current composer, and wait for explicit user confirmation. This never submits or executes the request.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: {
				draft: {
					type: "string",
					description: "The complete self-contained request proposed for the primary Agent."
				},
				reason: {
					type: "string",
					description: "A short explanation of why primary-Agent capabilities are required."
				}
			},
			required: ["draft", "reason"]
		}
	},
	{
		type: "function",
		name: "submit_to_agent",
		strict: true,
		description: "Atomically place the exact final request in the main composer and submit it to the primary Agent. Use only after a direct explicit submit instruction or an explicit affirmative reply to the assistant's immediately preceding handoff proposal.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: { draft: {
				type: "string",
				description: "The complete exact final text for the primary Agent."
			} },
			required: ["draft"]
		}
	},
	{
		type: "function",
		name: "end_voice_session",
		strict: true,
		description: "End this voice connection without submitting. Use only after an explicit request to end or close it.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: {}
		}
	},
	{
		type: "function",
		name: "organize_notes",
		strict: true,
		description: "Ask the dedicated knowledge-curator agent (a separate text model) to consolidate the current draft, the voice discussion, and recent session activity into the personal knowledge base: it updates the current-work projection and proposes durable knowledge. The call returns immediately; completion is announced separately. Use it when the user asks to organize, save, remember, or turn the discussion into knowledge.",
		parameters: {
			type: "object",
			additionalProperties: false,
			properties: { instruction: {
				type: "string",
				description: "Optional user intent for the curator, for example \"organize the accepted decisions into durable knowledge\". Not a draft replacement."
			} },
			required: []
		}
	}
];
const SESSION_ASSISTANT_TOOL_OUTPUT = {
	update_working_draft: { required: [
		"draft",
		"summary",
		"status"
	] },
	prepare_agent_handoff: { required: ["draft", "reason"] },
	submit_to_agent: { required: ["draft"] },
	end_voice_session: { required: [] },
	organize_notes: {}
};
//#endregion
//#region lib/types/settings-remote.js
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
let SessionAssistantSettingsRemote = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _describe_decorators;
	let _save_decorators;
	let _context_decorators;
	let _curate_decorators;
	return class SessionAssistantSettingsRemote extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_describe_decorators = [Remote("describe")];
			_save_decorators = [Remote("save")];
			_context_decorators = [Remote("context")];
			_curate_decorators = [Remote("curate")];
			__esDecorate(this, null, _describe_decorators, {
				kind: "method",
				name: "describe",
				static: false,
				private: false,
				access: {
					has: (obj) => "describe" in obj,
					get: (obj) => obj.describe
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _save_decorators, {
				kind: "method",
				name: "save",
				static: false,
				private: false,
				access: {
					has: (obj) => "save" in obj,
					get: (obj) => obj.save
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _context_decorators, {
				kind: "method",
				name: "context",
				static: false,
				private: false,
				access: {
					has: (obj) => "context" in obj,
					get: (obj) => obj.context
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _curate_decorators, {
				kind: "method",
				name: "curate",
				static: false,
				private: false,
				access: {
					has: (obj) => "curate" in obj,
					get: (obj) => obj.curate
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		scope = __runInitializers(this, _instanceExtraInitializers);
		constructor(ctx, scope) {
			super(ctx, "sessionAssistantSettings");
			this.scope = scope;
		}
		async describe() {
			return this.view();
		}
		async save(request) {
			await this.ctx.settings.replace(SETTINGS_NAMESPACE, normalizeSettings(request.settings), request.expectedRevision);
			return this.view();
		}
		async context(request) {
			const knowledge = this.ctx.get("personalKnowledge");
			if (knowledge === void 0) return {
				available: false,
				text: "",
				sources: []
			};
			const projection = await knowledge.project({
				query: String(request.query || "").slice(0, 2400),
				sessionId: String(request.sessionId || "").slice(0, 160),
				cwd: String(request.cwd || "").slice(0, 2e3),
				maxChars: Math.max(1e3, Math.min(12e3, Number(request.maxChars) || 6e3))
			});
			return {
				available: true,
				text: typeof projection.text === "string" ? projection.text.slice(0, 12e3) : "",
				sources: Array.isArray(projection.sources) ? projection.sources.map(String).slice(0, 40) : []
			};
		}
		/**
		* Delegate knowledge curation to the dedicated text-model curator agent
		* (personal-knowledge maintainer). Honest absence when the knowledge base
		* is not installed; failures are returned as ok:false so the voice product
		* can relay the reason instead of leaving the user waiting.
		*/
		async curate(request) {
			const curator = this.ctx.get("personalKnowledgeMaintainer");
			if (curator === void 0) return {
				available: false,
				ok: false,
				proposals: [],
				currentUpdated: false
			};
			try {
				const result = await curator.curate(String(request.sessionId || "").slice(0, 160), {
					cwd: String(request.cwd || "").slice(0, 2e3),
					instruction: String(request.instruction || "").slice(0, 2e3),
					extra: String(request.extra || "").slice(0, 12e3)
				});
				return {
					available: true,
					ok: result?.skipped !== true,
					proposals: Array.isArray(result?.proposals) ? result.proposals.map(String).slice(0, 20) : [],
					currentUpdated: result?.current !== void 0 && result?.current !== null,
					...result?.skipped ? { error: `Knowledge curation skipped: ${String(result.reason || "unknown")}` } : {}
				};
			} catch (error) {
				return {
					available: true,
					ok: false,
					proposals: [],
					currentUpdated: false,
					error: error instanceof Error ? error.message : String(error)
				};
			}
		}
		view() {
			const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find((item) => item.ns === SETTINGS_NAMESPACE);
			if (descriptor === void 0) throw new Error("session-assistant settings namespace is unavailable");
			return {
				revision: descriptor.revision,
				writable: this.ctx.settings.writable,
				settings: structuredClone(this.scope.get())
			};
		}
	};
})();
//#endregion
//#region lib/types/help.js
const VERSION = "0.4.1";
const HELP = `Session Assistant voice commands

Discussion and drafting:
  discuss — speak naturally without changing the draft.
  draft — dictate or request an edit.
  finalize — say “整理成最终稿” to polish and mark it ready.

Primary Agent handoff:
  submit — say “提交给 Agent” only when the final request should be sent and executed.

Connection:
  end — say “结束语音” to close without submitting.

The voice model cannot execute work itself and cannot access Agent tools or credentials.`;
//#endregion
//#region lib/types/index.js
const name = "dsh-session-assistant";
const inject = ["settings", "realtimeModelRuntime"];
function realtimeEditorInstructions(context = "") {
	return [PROMPT, context ? `Current projected session context and editable draft:\n${context}` : "The editable draft is initially empty."].join("\n\n");
}
function openAIProfileId(voice) {
	return `session-assistant-openai-${OPENAI_REALTIME_VOICES.some((candidate) => candidate.id === voice) ? voice : "marin"}`;
}
function sessionProfile({ id = "session-assistant", openaiVoice } = {}) {
	return {
		id,
		instructions: realtimeEditorInstructions,
		tools: SESSION_ASSISTANT_TOOLS,
		voice: openaiVoice ? { openai: openaiVoice } : {}
	};
}
function previewProfile({ id = "session-assistant-preview", openaiVoice } = {}) {
	return {
		id,
		instructions: realtimeEditorInstructions,
		tools: [],
		voice: openaiVoice ? { openai: openaiVoice } : {}
	};
}
function sessionProfiles() {
	return [
		sessionProfile(),
		previewProfile(),
		...OPENAI_REALTIME_VOICES.flatMap((voice) => [sessionProfile({
			id: openAIProfileId(voice.id),
			openaiVoice: voice.id
		}), previewProfile({
			id: `session-assistant-preview-openai-${voice.id}`,
			openaiVoice: voice.id
		})])
	];
}
function apply(ctx, config = {}) {
	const scope = registerSessionAssistantSettings(ctx, config);
	new SessionAssistantSettingsRemote(ctx, scope);
	ctx.effect(async () => {
		try {
			await migrateLegacySettings(ctx.settings);
		} catch (error) {
			ctx.logger.warn("session-assistant settings migration failed: %s", error instanceof Error ? error.message : String(error));
		}
		return () => {};
	}, "dsh-session-assistant: legacy settings migration");
	const disposers = sessionProfiles().map((profile) => ctx.realtimeModelRuntime.registerProfile(profile));
	ctx.effect(() => () => {
		for (const dispose of disposers.reverse()) dispose();
	}, "dsh-session-assistant: realtime profiles");
}
//#endregion
export { CONFIG_PATH, Config, DECLARED_SETTINGS_FIELDS, DEFAULT_SETTINGS, HELP, LEGACY_CONFIG_PATHS, OPENAI_REALTIME_VOICES, PROMPT, SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT, SETTINGS_NAMESPACE, SessionAssistantSettingsRemote, VERSION, apply, buildBoundedContext, inject, migrateLegacySettings, name, normalizeSettings, openAIProfileId, previewProfile, readLegacySettings, realtimeEditorInstructions, registerSessionAssistantSettings, sessionProfile, sessionProfiles };
