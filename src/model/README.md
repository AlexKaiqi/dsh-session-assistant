# Session Assistant model surface

| File | Export | Unique source of change |
|---|---|---|
| `prompt.ts` | `PROMPT` | The Session Assistant role, execution boundary, or spoken-discussion/draft separation policy changes. |
| `tool-surface.ts` | `SESSION_ASSISTANT_TOOLS` | A callable voice-session operation or its input contract changes. |
| `tool-surface.ts` | `SESSION_ASSISTANT_TOOL_OUTPUT` | The result contract returned after a voice-session tool operation changes. |

The browser executes these UI-local operations through the voice Agent action
registry (`voiceAgent.registerActions`): Session Assistant registers the
executors under its session owner prefix, and the runtime settles action requests
(dual output) without exposing filesystem, shell, Agent tool, or credential to
the voice model. Realtime provider credentials are resolved by
`dsh-multi-model-provider`; provider adapters never expose them to the browser
model.
