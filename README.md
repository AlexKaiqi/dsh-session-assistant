# dsh-session-assistant

面向当前 Session 的语音讨论与草稿产品层：与用户讨论请求、维护主输入区草稿，并在用户明确授权后提交给主 Agent。

> 设计哲学（为什么存在、价值、第一性原理、能力全景与边界）：见 [docs/design.md](docs/design.md)。

## 架构

本版本面向 DeepSeek Harness `0.1.1-rc.2`。`dsh-multi-model-provider@^0.1.0-rc.11` 与 `dsh-realtime-voice@^0.3.1` 是必需插件；`dsh-personal-knowledge-base@^0.3.2` 是可选知识集成。它们都应直接安装到同一 profile，DSH 不会根据 peer 声明自动安装、激活或更新。

```sh
dsh plugin --profile web add dsh-multi-model-provider dsh-realtime-voice dsh-session-assistant
# 可选：dsh plugin --profile web add dsh-personal-knowledge-base
dsh plugin --profile web update dsh-multi-model-provider dsh-realtime-voice dsh-session-assistant dsh-personal-knowledge-base
```

- Host 通过 DSH Settings 注册 `session-assistant` 命名空间，以组合 `Config` 为 base，并声明 `applies: live`。
- 仅当命名空间没有用户覆盖时，首次启动可从 `~/.dsh/session-assistant.json`、`talk-to-text.json` 或 `chatvoice.json` 导入一次；之后不再写这些旧文件。
- 插件自有的严格 Typert Remote 只公开带 revision 防冲突的 `describe` 与 `save`。
- Client UI 精确注册到 `conversation.input.right`、`conversation.input.dock`、`conversation.chat.assistant-actions` 和 `settings.section`；麦克风与状态只属于当前 Session。
- Client 文案集中注册到宿主 locale namespace，支持 `en`、`zh`、`zh-TW`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`ar`、`hi`，并随全局语言设置实时切换。
- `dsh-realtime-voice` 对外提供“与 Agent 开始全双工语音对话”的能力；Provider 协议、媒体传输、打断和音频输入仲裁都隐藏在该边界之后。
- 每个会话以 `session-assistant:<sessionId>` 开始一场 `VoiceConversation`，并用同一 owner 前缀向 `voiceAgent.registerActions` 注册产品动作。动作的授权门仍由本插件持有；若全局 Pet Assistant 或其他语音产品正在占用麦克风，会明确返回冲突。
- Realtime route 留空表示自动选择：正式会话与试听都会选取所选 Provider 协议下首个可用 route，不会把空 route 传给统一语音底座。
- 待机唤醒词可在设置中修改。只有包含该唤醒词的最终识别结果会启动 Realtime；待机期间在浏览器内存保留有界 PCM，命中后将整句原始音频（包括唤醒词）作为首条用户消息提交，例如“你好助手，继续检查刚才的修改”无需再次复述命令。未命中的音频立即丢弃且不持久化。
- 若 `dsh-personal-knowledge-base` 已启用，Host Remote 在建连前读取有界 `personalKnowledge.project()`；未安装时静默降级，不改变语音权限。
- **知识整理委派**：语音模型多一个 `organize_notes` 操作——用户说“整理/保存/记住这些讨论”时，立即回传结果（模型继续说话），同时把草稿与当前会话增量交给**专职知识整理 agent**（PKB 的文本模型 maintainer，通过 `sessionAssistantSettings/curate` Remote）；整理完成（更新当前工作投影 + 生成长期知识提案）后在状态条显示并语音播报。整理 agent 只提案不确认，授权门仍在知识库。
- Session Assistant 不监听或广播任何宠物事件，也不承担全局待机、唤醒或宠物人格；这些能力由独立的 Pet Assistant 拥有。

语音模型只有 `update_working_draft`、`submit_to_agent`、`end_voice_session` 和 `organize_notes` 四项操作；它们的执行器由本插件注册进运行时，产品边界不变：草稿修改只调用 `inputActions.setDraft(fullText)`，提交只调用 `inputActions.submit()`，整理只委派给知识整理 agent。每个 controller 绑定 Slot 提供的 `sessionId`；组件、Session 或连接释放后，迟到的工具调用不会再修改或提交草稿。

OpenAI／豆包路由、Profile、音色、浏览器识别、上下文与朗读选项继续保留，但本插件只消费标准化会话事件。设置页的助手音色试听直接开始一场无产品动作的 `VoiceConversation`；对已完成回复的手动朗读仍通过 finalized `messageId` 从 Session 快照解析正文，不读取页面 DOM。

## 验证

```bash
npm run check
```

真实 Provider 产品链需显式授权计费调用后运行 `npm run test:e2e:live`。该用例把生成语音送入浏览器虚拟麦克风，经统一 `voiceAgent` 和真实 Realtime Provider，最终断言 Session Assistant 的真实草稿执行器修改草稿且未越权提交。
