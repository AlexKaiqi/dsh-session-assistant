import { i as DECLARED_SETTINGS_FIELDS, r as countAssistantSteps, s as normalizeSettings, t as awarenessEventsInSession } from "./context-B4Q4UnEG.js";
//#region lib/types/client/controller.js
const SETTINGS_APPLICATION = {
	realtimeConnection: "recognitionProvider, recognitionLang, openaiRealtimeModel, openaiRealtimeVoice, and doubaoRealtimeModel apply when the next voice connection starts",
	standby: "wakeWord applies when standby is entered again; long-press the microphone button to enter standby",
	context: "openaiContextMode applies when context is next projected into the voice session"
};
/** Safe configuration projection for the voice model; contains no credentials. */
function assistantSettingsContext(settings) {
	return `[Session Assistant configuration — non-secret]\n${JSON.stringify(settings)}\nApplication rules: ${Object.values(SETTINGS_APPLICATION).join("; ")}.`;
}
function parseArguments(value) {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) return value;
	if (typeof value !== "string") return void 0;
	try {
		const parsed = JSON.parse(value);
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
function errorCodeOf(error) {
	if (error !== null && typeof error === "object" && "code" in error) {
		const code = error.code;
		if (typeof code === "string" && code !== "") return code;
	}
}
/** Diagnostic tracing for the tool/submit flow; harmless no-op when the console is unavailable. */
function saLog(detail, extra) {
	try {
		const sink = typeof console !== "undefined" ? console : void 0;
		if (sink && typeof sink.log === "function") sink.log("[sa-controller]", detail, extra === void 0 ? "" : extra);
	} catch {}
}
function significantPlanChange(previous, next) {
	if (!previous) return true;
	if (previous.phase !== next.phase || previous.completed !== next.completed || previous.total !== next.total) return true;
	return previous.active.join("\n") !== next.active.join("\n");
}
var VoiceController = class {
	deps;
	handle;
	unsubscribe;
	baseline = "";
	lastApplied = "";
	disposed = false;
	generation = 0;
	/** Finished assistant-step count when the voice session opened (or when a submission landed). */
	stepBaseline;
	/** Accumulated finalized voice-discussion transcript of the current session, kept for curation. */
	discussion = "";
	/** Discussion snapshot at the last successful curation; only the delta after it is re-curated. */
	lastCuratedDiscussion = "";
	seenAwarenessEvents = /* @__PURE__ */ new Set();
	lastPlan;
	disposeTools;
	state = {
		status: "idle",
		phase: "idle",
		transcript: "",
		draftStatus: "drafting"
	};
	listeners = /* @__PURE__ */ new Set();
	constructor(deps) {
		this.deps = deps;
		this.disposeTools = deps.registerActions({
			update_working_draft: { execute: (args, control) => this.executeTool("update_working_draft", args, control) },
			prepare_agent_handoff: { execute: (args, control) => this.executeTool("prepare_agent_handoff", args, control) },
			submit_to_agent: { execute: (args, control) => this.executeTool("submit_to_agent", args, control) },
			end_voice_session: { execute: (args, control) => this.executeTool("end_voice_session", args, control) },
			organize_notes: { execute: (args, control) => this.executeTool("organize_notes", args, control) },
			get_assistant_settings: { execute: (args, control) => this.executeTool("get_assistant_settings", args, control) },
			update_assistant_settings: { execute: (args, control) => this.executeTool("update_assistant_settings", args, control) }
		});
	}
	get sessionId() {
		return this.deps.sessionId;
	}
	getSnapshot() {
		return this.state;
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	async start(initialUserText = "", initialAudio) {
		if (this.disposed || this.handle !== void 0 || this.state.status === "opening") return;
		this.deps.standby?.exit();
		const generation = ++this.generation;
		this.discussion = "";
		this.lastPlan = void 0;
		this.baseline = this.deps.getInput().draft;
		this.lastApplied = this.baseline;
		this.publish({
			status: "opening",
			phase: "connecting",
			transcript: "",
			error: void 0,
			errorCode: void 0,
			handoff: void 0,
			submitNotice: void 0,
			question: void 0,
			agentReply: void 0,
			planNotice: void 0
		});
		try {
			const handle = await this.deps.startConversation(initialUserText.trim().slice(0, 2e4), initialAudio);
			if (this.disposed || generation !== this.generation) {
				await handle.end();
				return;
			}
			this.handle = handle;
			this.unsubscribe = handle.subscribe((event) => {
				this.consume(event).catch((error) => {
					if (!this.disposed) this.publish({
						status: "error",
						error: error instanceof Error ? error.message : String(error)
					});
				});
			});
			this.publish({ status: "active" });
			this.stepBaseline = void 0;
		} catch (error) {
			if (!this.disposed && generation === this.generation) this.publish({
				status: "error",
				error: error instanceof Error ? error.message : String(error),
				errorCode: errorCodeOf(error)
			});
		}
	}
	async stop() {
		if (this.disposed && this.handle === void 0) return;
		++this.generation;
		this.unsubscribe?.();
		this.unsubscribe = void 0;
		const handle = this.handle;
		this.handle = void 0;
		this.deps.standby?.exit();
		if (handle !== void 0) await handle.end();
		if (!this.disposed) this.publish({
			status: "idle",
			phase: "idle",
			transcript: "",
			error: void 0,
			errorCode: void 0,
			handoff: void 0,
			submitNotice: void 0,
			question: void 0,
			agentReply: void 0,
			planNotice: void 0
		});
	}
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.disposeTools();
		await this.stop();
		this.publish({
			status: "closed",
			phase: "closed"
		});
		this.listeners.clear();
	}
	async interrupt() {
		if (!this.disposed) await this.handle?.interrupt();
	}
	/** Enter wake-word standby: only the configured wake word (or the mic button) reactivates the assistant. */
	async enterStandby() {
		if (this.disposed || this.handle !== void 0 || this.state.status === "opening") return false;
		if (!this.deps.standby || !this.deps.standby.enter()) return false;
		this.publish({
			status: "standby",
			phase: "idle",
			transcript: "",
			error: void 0,
			errorCode: void 0,
			question: void 0,
			agentReply: void 0,
			planNotice: void 0
		});
		saLog("standby entered");
		return true;
	}
	/** Leave standby without starting a voice session. */
	async exitStandby() {
		this.deps.standby?.exit();
		if (this.state.status === "standby") this.publish({
			status: "idle",
			phase: "idle"
		});
	}
	/** Standby consumes the exclusive audio-input lease; any active voice session must be closed first. */
	get canEnterStandby() {
		return !this.disposed && this.handle === void 0 && this.state.status !== "opening";
	}
	/**
	* Observe the current-session snapshot (called by the UI on every session change):
	* projects tool calls and delegated-Agent messages into semantic awareness
	* events. Internal child reports remain silent; the primary Agent decides
	* whether their content becomes user-facing. Blocking questions and
	* significant plan milestones are sent to the configured UI/voice sink.
	*/
	observeSession(snapshot) {
		if (this.disposed) return;
		for (const event of awarenessEventsInSession(snapshot)) {
			if (this.seenAwarenessEvents.has(event.id)) continue;
			this.seenAwarenessEvents.add(event.id);
			if (event.type === "agent_report") {
				saLog(`subagent report received${event.senderSessionId ? ` from ${event.senderSessionId}` : ""}`);
				continue;
			}
			if (event.type === "user_input_required") {
				this.publish({ question: {
					callId: event.callId,
					text: event.text
				} });
				saLog(`primary-agent question ${event.callId}: ${event.text.slice(0, 120)}`);
				this.notifyAwareness(event);
				continue;
			}
			const significant = significantPlanChange(this.lastPlan, event);
			this.lastPlan = event;
			if (!significant) continue;
			this.publish({ planNotice: event });
			saLog(`primary-agent plan ${event.callId}: ${event.completed}/${event.total} completed`);
			this.notifyAwareness(event);
		}
		const stepCount = countAssistantSteps(snapshot);
		if (this.stepBaseline === void 0) this.stepBaseline = stepCount;
		if (this.state.submitNotice && !this.state.agentReply && stepCount > this.stepBaseline) {
			this.publish({ agentReply: true });
			saLog("primary agent replied after submission");
		}
	}
	notifyAwareness(event) {
		if (this.state.status !== "active" || !this.deps.notifyAwareness) return;
		if (event.voicePolicy === "interrupt" && this.state.phase === "speaking") this.handle?.interrupt();
		try {
			this.deps.notifyAwareness(event);
		} catch {}
	}
	async consume(event) {
		if (this.disposed) return;
		if (event.type === "status") this.publish({ status: event.connected === false || event.status === "closed" ? "idle" : "active" });
		else if (event.type === "phase") this.publish({ phase: event.phase });
		else if (event.type === "transcript") {
			this.publish({ transcript: event.text });
			const role = event.role ?? event.source ?? "input";
			const dictation = typeof this.deps.dictation === "function" ? this.deps.dictation() : this.deps.dictation;
			if (event.final) {
				this.appendDiscussion(role, event.text);
				if (dictation && role === "input") this.appendDictation(event.text);
			}
		} else if (event.type === "interrupted") this.publish({ phase: "listening" });
		else if (event.type === "error") this.publish({
			status: "error",
			error: event.message,
			errorCode: event.code
		});
		else if (event.type === "closed") {
			++this.generation;
			this.unsubscribe?.();
			this.unsubscribe = void 0;
			this.handle = void 0;
			this.publish({
				status: "idle",
				phase: "idle"
			});
		}
	}
	appendDiscussion(role, text) {
		const addition = text.trim();
		if (!addition) return;
		const next = `${this.discussion}${this.discussion ? "\n" : ""}${role === "output" ? "ASSISTANT" : "USER"}: ${addition}`;
		this.discussion = next.slice(-24e3);
	}
	appendDictation(text) {
		const addition = text.trim();
		if (!addition) return;
		const current = this.deps.getInput().draft;
		const draft = `${current}${current === "" || /\s$/.test(current) ? "" : " "}${addition}`;
		this.deps.inputActions.setDraft(draft);
		this.baseline = draft;
		this.lastApplied = draft;
		this.publish({
			draftStatus: "drafting",
			phase: "listening"
		});
	}
	/**
	* Execute one registered action through the runtime action-control handoff.
	* The runtime settles the result (control.resolve) and keeps the model
	* speaking; this method keeps the product boundaries: draft mutation only
	* through inputActions, submission only after explicit authorization, and
	* best-effort context refresh that never blocks the tool flow.
	*/
	async executeTool(name, args, control) {
		if (this.disposed || this.handle === void 0) return;
		const parsed = parseArguments(args);
		if (parsed === void 0) {
			control.resolve({
				ok: false,
				error: "Invalid tool arguments."
			});
			return;
		}
		if (name === "end_voice_session") {
			control.resolve({ ok: true }, { continueResponse: false });
			await this.stop();
			return;
		}
		if (name === "organize_notes") {
			await this.organizeNotes(parsed, control);
			return;
		}
		if (name === "get_assistant_settings" || name === "update_assistant_settings") {
			await this.configureAssistant(name, parsed, control);
			return;
		}
		const draft = typeof parsed.draft === "string" ? parsed.draft : void 0;
		const validUpdate = name !== "update_working_draft" || typeof parsed.summary === "string" && (parsed.status === "drafting" || parsed.status === "ready");
		const validHandoff = name !== "prepare_agent_handoff" || typeof parsed.reason === "string" && parsed.reason.trim() !== "" && parsed.reason.length <= 1e3;
		const emptySubmit = name === "submit_to_agent" && (draft === void 0 || draft.trim() === "");
		const emptyHandoff = name === "prepare_agent_handoff" && (draft === void 0 || draft.trim() === "");
		if (draft === void 0 || draft.length > 24e3 || emptySubmit || emptyHandoff || !validUpdate || !validHandoff) {
			this.publish({
				status: "error",
				errorCode: emptySubmit ? "empty_submit" : "invalid_action"
			});
			control.resolve({
				ok: false,
				error: emptySubmit ? "There is no draft content to submit. Ask the user to dictate what to send first." : name === "prepare_agent_handoff" ? "A non-empty draft and a short handoff reason are required." : "Invalid draft tool arguments."
			});
			return;
		}
		const current = this.deps.getInput().draft;
		if (current !== this.baseline && current !== this.lastApplied) {
			this.baseline = current;
			this.lastApplied = current;
			control.resolve({
				ok: false,
				error: "The user edited the draft concurrently.",
				draft: current
			});
			return;
		}
		this.deps.inputActions.setDraft(draft);
		this.baseline = draft;
		this.lastApplied = draft;
		const draftStatus = name === "submit_to_agent" || name === "prepare_agent_handoff" || parsed.status === "ready" ? "ready" : "drafting";
		const handoff = name === "prepare_agent_handoff" ? { reason: String(parsed.reason).trim().slice(0, 1e3) } : name === "submit_to_agent" || draftStatus === "drafting" ? void 0 : this.state.handoff;
		this.publish({
			draftStatus,
			handoff,
			phase: "editing"
		});
		saLog(`tool:${name} draftLen:${draft.length} status:${draftStatus}`);
		if (!control.resolve(name === "prepare_agent_handoff" ? {
			ok: true,
			draft,
			status: "awaiting_confirmation",
			reason: handoff?.reason
		} : {
			ok: true,
			draft,
			status: draftStatus
		})) {
			this.publish({
				status: "error",
				error: "The voice session closed before the tool result could be delivered."
			});
			return;
		}
		if (name === "submit_to_agent" && !this.disposed) {
			saLog("submit() -> primary Agent");
			this.deps.inputActions.submit();
			this.publish({
				handoff: void 0,
				submitNotice: true
			});
			if (this.deps.getSession) this.stepBaseline = countAssistantSteps(this.deps.getSession());
		}
		try {
			await this.handle?.updateContext(await this.deps.context(draft));
		} catch {}
	}
	async configureAssistant(name, parsed, control) {
		const current = this.deps.getSettings?.();
		if (!current) {
			control.resolve({
				ok: false,
				error: "Session Assistant settings are unavailable."
			});
			return;
		}
		if (name === "get_assistant_settings") {
			control.resolve({
				ok: true,
				settings: current,
				application: SETTINGS_APPLICATION
			});
			return;
		}
		if (!this.deps.updateSettings) {
			control.resolve({
				ok: false,
				error: "Session Assistant settings are read-only."
			});
			return;
		}
		const patch = {};
		for (const field of DECLARED_SETTINGS_FIELDS) if (Object.prototype.hasOwnProperty.call(parsed, field)) patch[field] = parsed[field];
		const fields = Object.keys(patch);
		if (fields.length === 0) {
			control.resolve({
				ok: false,
				error: "No Session Assistant setting was provided."
			});
			return;
		}
		const normalized = normalizeSettings({
			...current,
			...patch
		});
		const invalid = fields.find((field) => normalized[field] !== patch[field]);
		if (invalid) {
			control.resolve({
				ok: false,
				error: `Invalid value for ${invalid}.`
			});
			return;
		}
		try {
			const settings = await this.deps.updateSettings(patch);
			const reconnectRequired = fields.some((field) => field === "recognitionProvider" || field === "recognitionLang" || field === "openaiRealtimeModel" || field === "openaiRealtimeVoice" || field === "doubaoRealtimeModel");
			const standbyRestartRequired = fields.includes("wakeWord");
			control.resolve({
				ok: true,
				changed: fields,
				settings,
				reconnectRequired,
				standbyRestartRequired,
				application: SETTINGS_APPLICATION
			});
			try {
				await this.handle?.updateContext((await this.deps.context()).slice(0, 12e3));
			} catch {}
		} catch (error) {
			control.resolve({
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	/**
	* Delegate knowledge curation to the dedicated text-model curator agent.
	* The tool result is settled immediately (the model keeps speaking and the
	* user is told curation started); the async curation outcome is published
	* to the dock when it lands (no synthetic TTS).
	*/
	async organizeNotes(parsed, control) {
		if (!this.deps.curate) {
			control.resolve({
				ok: false,
				error: "Knowledge curation is unavailable (the knowledge base is not installed)."
			});
			return;
		}
		const instruction = typeof parsed.instruction === "string" ? parsed.instruction.trim().slice(0, 2e3) : "";
		const draft = this.deps.getInput().draft;
		const cwd = String(this.deps.getSessionMetadata?.().cwd || "");
		const current = this.discussion;
		const discussion = ((this.lastCuratedDiscussion && current.startsWith(this.lastCuratedDiscussion) ? current.slice(this.lastCuratedDiscussion.length) : current) || current).slice(-12e3);
		const extra = [discussion, draft.trim()].filter(Boolean).join("\n\n").slice(0, 12e3);
		if (!control.resolve({
			ok: true,
			note: "Knowledge curation started; completion will be shown in the status bar."
		})) return;
		this.publish({
			phase: "curating",
			curatorNotice: void 0
		});
		saLog(`organize_notes instruction:${instruction.slice(0, 120)} discussionDelta:${discussion.length}`);
		let result;
		try {
			result = await this.deps.curate({
				sessionId: this.deps.sessionId,
				cwd,
				instruction,
				extra
			});
		} catch (error) {
			result = {
				available: true,
				ok: false,
				proposals: [],
				currentUpdated: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
		if (this.disposed) return;
		if (!result.available) {
			this.publish({
				phase: "listening",
				curatorNotice: {
					ok: false,
					proposals: 0,
					error: "knowledge-base-missing"
				}
			});
			return;
		}
		if (!result.ok) {
			this.publish({
				phase: "listening",
				curatorNotice: {
					ok: false,
					proposals: 0,
					error: result.error || "curate-failed"
				}
			});
			return;
		}
		this.lastCuratedDiscussion = current.slice(-24e3);
		this.publish({
			phase: "listening",
			curatorNotice: {
				ok: true,
				proposals: result.proposals.length
			}
		});
		saLog(`organize_notes done proposals:${result.proposals.length} currentUpdated:${result.currentUpdated}`);
		try {
			if (this.handle) {
				const next = `${await this.deps.context()}\n\n[Curator notice]\n${result.proposals.length > 0 ? `Knowledge curation completed: current-work projection updated, ${result.proposals.length} durable-knowledge proposal(s) created and awaiting confirmation.` : "Knowledge curation completed: current-work projection updated, no new durable-knowledge proposals."}`;
				await this.handle.updateContext(next.slice(0, 12e3));
			}
		} catch {}
	}
	publish(patch) {
		this.state = {
			...this.state,
			...patch
		};
		for (const listener of this.listeners) listener();
	}
};
const WAKE_SEPARATORS = /[\s,，。.!！?？:：;；'"“”‘’_—–…-]+/g;
/** Match a configurable wake phrase without rewriting the recognized utterance. */
function matchesWakePhrase(value, wakePhrase) {
	const heard = value.toLocaleLowerCase().replace(WAKE_SEPARATORS, "");
	const phrase = wakePhrase.toLocaleLowerCase().replace(WAKE_SEPARATORS, "");
	return phrase.length > 0 && heard.includes(phrase);
}
/** Resolve the configured route, or the first callable route for the selected Realtime protocol. */
function selectVoiceRoute(settings, models) {
	if (settings.recognitionProvider === "browser") return "";
	const configured = settings.recognitionProvider === "openai-realtime" ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel;
	if (configured) return configured;
	const protocol = settings.recognitionProvider === "openai-realtime" ? "openai-webrtc" : "doubao-realtime-duplex";
	return models.find((model) => model.protocol === protocol && model.available !== false)?.id ?? "";
}
function voiceConversationOptions(settings, context, routeId = "") {
	const browser = settings.recognitionProvider === "browser";
	const openai = settings.recognitionProvider === "openai-realtime";
	return {
		routeId: browser ? "" : routeId || (openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel),
		profileId: openai ? `session-assistant-openai-${settings.openaiRealtimeVoice}` : "session-assistant",
		context,
		language: settings.recognitionLang
	};
}
/** Open an interactive audition using the selected Realtime model and voice. */
function voiceAgentPreviewOptions(settings, routeId = "") {
	const openai = settings.recognitionProvider === "openai-realtime";
	const previewText = settings.recognitionLang === "zh-CN" ? "请先简短地和我打个招呼，然后等我继续和你对话。" : "Greet me briefly, then wait for me to continue the conversation.";
	return {
		routeId: routeId || (openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel),
		profileId: openai ? `session-assistant-preview-openai-${settings.openaiRealtimeVoice}` : "session-assistant-preview",
		outputOnly: false,
		previewText
	};
}
//#endregion
export { VoiceController, assistantSettingsContext, matchesWakePhrase, saLog, selectVoiceRoute, voiceAgentPreviewOptions, voiceConversationOptions };
