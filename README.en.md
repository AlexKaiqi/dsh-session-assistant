# dsh-session-assistant

[English](README.en.md) | [简体中文](README.md)

[![npm version](https://img.shields.io/npm/v/dsh-session-assistant.svg)](https://www.npmjs.com/package/dsh-session-assistant)
[![CI](https://github.com/AlexKaiqi/dsh-session-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexKaiqi/dsh-session-assistant/actions/workflows/ci.yml)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-0b7285.svg)](https://github.com/topics/dsh-plugin)
[![MIT license](https://img.shields.io/npm/l/dsh-session-assistant.svg)](./LICENSE)

A Session-scoped product layer for discussing a request by voice, maintaining the current composer draft, and explicitly submitting the final text to the primary Agent.

The canonical product introduction read by people, the operational assistant, and the Settings voice tour is [INTRODUCTION.md](INTRODUCTION.md).

## Install

This release targets DeepSeek Harness `0.1.1-rc.2`. `dsh-multi-model-provider@^0.1.0-rc.11` and `dsh-realtime-voice@^0.3.1` are required; `dsh-personal-knowledge-base@^0.3.2` is optional. Install every bundle directly in the same profile because DSH does not auto-install, activate, or update peer plugins.

```sh
dsh plugin --profile web add dsh-multi-model-provider dsh-realtime-voice dsh-session-assistant
dsh plugin --profile web update dsh-multi-model-provider dsh-realtime-voice dsh-session-assistant
```

If `dsh-personal-knowledge-base` is already installed in the same profile, bounded knowledge projection and `organize_notes` activate automatically; absence degrades silently. The optional package is not published to npm yet, so do not put it in a normal registry install command.

## Before use

- Configure an available OpenAI Realtime or Doubao Realtime Duplex route in DSH Models. An empty route auto-selects the first callable route for the chosen protocol.
- Browser recognition depends on the browser `SpeechRecognition` implementation; Chrome and Edge have the best support. Realtime modes require microphone permission.
- Realtime conversations and the Settings voice tour may incur Provider charges. Normal checks and unit tests never make billable live calls.
- Long-lived Provider credentials remain on the Host; the browser receives only validated route/profile references and short-lived session data.

## Architecture and boundaries

- Host registers the DSH Settings namespace `session-assistant` with live application and the composition `Config` as its base layer.
- The first run may import `~/.dsh/session-assistant.json`, `talk-to-text.json`, or `chatvoice.json` only when no user overrides exist. Legacy files are never written.
- A strict plugin-owned Typert Remote exposes revision-fenced settings plus an optional, bounded Personal Knowledge context projection.
- Client UI is registered in `conversation.input.right`, `conversation.input.dock`, and `settings.section`; its microphone and status remain scoped to the current Session.
- Client copy is registered in one Host locale namespace for `en`, `zh`, `zh-TW`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`, `ar`, and `hi`, and switches live with the global locale.
- `dsh-realtime-voice` exposes one product capability: start a full-duplex voice conversation with an Agent. Provider protocols, browser media, interruption, and audio-input arbitration stay behind that boundary.
- Each Session starts a `VoiceConversation` as `session-assistant:<sessionId>` and registers product actions with `voiceAgent.registerActions` under the same owner prefix. This plugin still owns every authorization gate; if the global Pet Assistant or another voice product owns the microphone, startup fails explicitly instead of capturing in parallel.
- An empty Realtime route means automatic selection: both normal conversations and the voice tour choose the first available route for the selected Provider protocol instead of passing an empty route to the unified voice runtime.
- The standby wake word is configurable. Only a finalized recognition result containing it starts Realtime. Standby retains bounded PCM in browser memory; after a match the complete original audio, including the wake phrase, becomes the first user turn, so “Hello Assistant, continue the review” does not require repetition. Unmatched audio is discarded immediately and never persisted.
- **Knowledge-curation delegation**: the voice model can call `organize_notes` — when the user asks to organize, save, or remember the discussion, the tool settles immediately (the model keeps speaking) while the draft and recent session increments are handed to the dedicated text-model curator agent (the personal-knowledge maintainer, via the `sessionAssistantSettings/curate` Remote). On completion the dock shows the outcome. The curator only proposes; confirmation stays on the knowledge-base boundary.
- **Primary-Agent awareness events**: `ask_user_question` and `todo_write` are mapped to stable semantic events and shown in the dock. Raw `subagent-report` messages remain parent-internal and cannot bypass the primary Agent to address the user directly.
- Session Assistant neither listens for nor emits pet events, and it does not own global standby, wake-word, or pet-personality behavior. Those capabilities belong to the independent Pet Assistant.

The voice model can operate the draft, Agent handoff, submission, session close, knowledge curation, and its own non-secret settings. Requests that need workspace contents, current state, tools, side effects, or verification first become a visible handoff awaiting confirmation; they are never executed or submitted implicitly. For non-trivial draft or tool preparation, the assistant speaks a brief acknowledgement first in the same turn. This plugin registers the executors with the runtime while keeping the product boundaries: draft changes use `inputActions.setDraft(fullText)`, submission uses `inputActions.submit()`, and curation is delegated to the curator agent. Each controller remains bound to the Slot `sessionId`; disposed or closed controllers reject late tool application.

OpenAI/Doubao route, profile, Realtime voice, recognition language, context, and wake word are the only voice settings retained. The Settings voice tour uses the selected Realtime voice to introduce the plugin and keeps the microphone open for questions about its capabilities, boundaries, and recommended workflows. Both the operational assistant and this tour read the same [INTRODUCTION.md](INTRODUCTION.md). Provider/model/Realtime voice/language changes apply on the next connection, and wake-word changes on the next standby entry. The plugin no longer registers browser/system read-aloud buttons, automatic read-aloud, read-aloud voice, or read-aloud speed.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs peer-dependency checking, type checking, the evaluation release gate, the build, 37 behavioral tests, and npm package-content verification. Run `pnpm test:e2e:live` only after explicitly authorizing a billable Provider call. It sends generated speech through a browser virtual microphone, the unified `voiceAgent`, and the real Realtime Provider, then asserts that the actual draft executor updates the draft without submitting it.

Troubleshooting: a disabled voice tour usually means that no callable Realtime route is configured; microphone failures are displayed through stable localized error codes; if another voice product owns audio input, startup reports `audio_input_busy` instead of capturing concurrently.
