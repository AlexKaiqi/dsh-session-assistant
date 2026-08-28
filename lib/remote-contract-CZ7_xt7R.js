import { z } from "zod";
//#region lib/types/remote-contract.js
const settingsSchema = z.object({
	recognitionProvider: z.enum([
		"browser",
		"openai-realtime",
		"doubao-realtime",
		"composed"
	]),
	recognitionLang: z.enum(["zh-CN", "en-US"]),
	openaiRealtimeModel: z.string(),
	openaiRealtimeVoice: z.string(),
	doubaoRealtimeModel: z.string(),
	composedAsrRoute: z.string(),
	composedTtsRoute: z.string(),
	composedLanguageSource: z.enum(["current-session", "fixed"]),
	composedLanguageProvider: z.string(),
	composedLanguageModel: z.string(),
	openaiContextMode: z.enum([
		"off",
		"draft",
		"recent"
	]),
	wakeWord: z.string()
}).strict();
const viewSchema = z.object({
	revision: z.number(),
	writable: z.boolean(),
	settings: settingsSchema
}).strict();
const contextViewSchema = z.object({
	available: z.boolean(),
	text: z.string(),
	sources: z.array(z.string())
}).strict();
const curateRequestSchema = z.object({
	sessionId: z.string(),
	cwd: z.string().optional(),
	instruction: z.string().optional(),
	extra: z.string().optional()
}).strict();
const curatorViewSchema = z.object({
	available: z.boolean(),
	ok: z.boolean(),
	proposals: z.array(z.string()),
	currentUpdated: z.boolean(),
	error: z.string().optional()
}).strict();
const transcribeRequestSchema = z.object({
	routeId: z.string().min(1).max(240),
	inputArtifactId: z.uuid()
}).strict();
const transcriptionResultSchema = z.object({ text: z.string().min(1).max(2e4) }).strict();
const synthesizeRequestSchema = z.object({
	routeId: z.string().min(1).max(240),
	text: z.string().min(1).max(1e4),
	speaker: z.string().min(1).max(128).optional()
}).strict();
const synthesisResultSchema = z.object({
	uri: z.string().regex(/^\/[a-z0-9/_-]*\/artifacts\/audio\/[0-9a-f-]{36}$/),
	mediaType: z.literal("audio/mpeg")
}).strict();
function sessionAssistantRemoteDescriptors() {
	return [
		{
			id: "dsh-session-assistant#sessionAssistantSettings/describe",
			service: "sessionAssistantSettings",
			namespace: "sessionAssistantSettings",
			method: "describe",
			invocation: { kind: "direct" },
			parameters: [],
			result: {
				mode: "strict",
				typeSymbol: "dsh-session-assistant#SessionAssistantSettingsView",
				schema: viewSchema
			},
			sourceLocation: {
				file: "src/settings-remote.ts",
				line: 35,
				column: 3
			}
		},
		{
			id: "dsh-session-assistant#sessionAssistantSettings/save",
			service: "sessionAssistantSettings",
			namespace: "sessionAssistantSettings",
			method: "save",
			invocation: { kind: "direct" },
			parameters: [{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-session-assistant#SaveSessionAssistantSettingsRequest",
					schema: z.object({
						expectedRevision: z.number(),
						settings: settingsSchema
					}).strict()
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-session-assistant#SessionAssistantSettingsView",
				schema: viewSchema
			},
			sourceLocation: {
				file: "src/settings-remote.ts",
				line: 41,
				column: 3
			}
		},
		{
			id: "dsh-session-assistant#sessionAssistantSettings/context",
			service: "sessionAssistantSettings",
			namespace: "sessionAssistantSettings",
			method: "context",
			invocation: { kind: "direct" },
			parameters: [{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-session-assistant#SessionAssistantContextRequest",
					schema: z.object({
						query: z.string().optional(),
						sessionId: z.string().optional(),
						cwd: z.string().optional(),
						maxChars: z.number().optional()
					}).strict()
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-session-assistant#SessionAssistantContextView",
				schema: contextViewSchema
			},
			sourceLocation: {
				file: "src/settings-remote.ts",
				line: 47,
				column: 3
			}
		},
		{
			id: "dsh-session-assistant#sessionAssistantSettings/curate",
			service: "sessionAssistantSettings",
			namespace: "sessionAssistantSettings",
			method: "curate",
			invocation: { kind: "direct" },
			parameters: [{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-session-assistant#CurateKnowledgeRequest",
					schema: curateRequestSchema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-session-assistant#CuratorView",
				schema: curatorViewSchema
			},
			sourceLocation: {
				file: "src/settings-remote.ts",
				line: 53,
				column: 3
			}
		},
		{
			id: "dsh-session-assistant#composedVoice/transcribe",
			service: "composedVoice",
			namespace: "composedVoice",
			method: "transcribe",
			invocation: { kind: "direct" },
			parameters: [{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-session-assistant#RemoteTranscribeRequest",
					schema: transcribeRequestSchema
				}
			}],
			cancellation: { parameter: "signal" },
			result: {
				mode: "strict",
				typeSymbol: "dsh-session-assistant#RemoteTranscriptionResult",
				schema: transcriptionResultSchema
			},
			sourceLocation: {
				file: "src/composed-voice-remote.ts",
				line: 29,
				column: 3
			}
		},
		{
			id: "dsh-session-assistant#composedVoice/synthesize",
			service: "composedVoice",
			namespace: "composedVoice",
			method: "synthesize",
			invocation: { kind: "direct" },
			parameters: [{
				name: "request",
				wire: "request",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-session-assistant#RemoteSynthesizeRequest",
					schema: synthesizeRequestSchema
				}
			}],
			cancellation: { parameter: "signal" },
			result: {
				mode: "strict",
				typeSymbol: "dsh-session-assistant#RemoteSynthesisResult",
				schema: synthesisResultSchema
			},
			sourceLocation: {
				file: "src/composed-voice-remote.ts",
				line: 40,
				column: 3
			}
		}
	];
}
//#endregion
export { sessionAssistantRemoteDescriptors as t };
