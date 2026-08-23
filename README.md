# dsh-session-assistant

面向当前 Session 的语音讨论与草稿产品层：与用户讨论请求、维护主输入区草稿，并在用户明确授权后提交给主 Agent。

> 设计哲学（为什么存在、价值、第一性原理、能力全景与边界）：见 [docs/design.md](docs/design.md)。

## 架构

- Host 通过 DSH Settings 注册 `session-assistant` 命名空间，以组合 `Config` 为 base，并声明 `applies: live`。
- 仅当命名空间没有用户覆盖时，首次启动可从 `~/.dsh/session-assistant.json`、`talk-to-text.json` 或 `chatvoice.json` 导入一次；之后不再写这些旧文件。
- 插件自有的严格 Typert Remote 只公开带 revision 防冲突的 `describe` 与 `save`。
- Client UI 精确注册到 `conversation.input.right`、`conversation.input.dock`、`conversation.chat.assistant-actions` 和 `settings.section`；麦克风与状态只属于当前 Session。
- Client 文案集中注册到宿主 locale namespace，中文显示“会话助手”，并随全局语言设置在中英文间实时切换。
- `dsh-voice-agent` 对外提供“与 Agent 开始全双工语音对话”的能力；Provider 协议、媒体传输、打断和音频输入仲裁都隐藏在该边界之后。
- 每个会话以 `session-assistant:<sessionId>` 开始一场 `VoiceConversation`，并用同一 owner 前缀向 `voiceAgent.registerActions` 注册产品动作。动作的授权门仍由本插件持有；若全局 Pet Assistant 或其他语音产品正在占用麦克风，会明确返回冲突。
- 若 `dsh-personal-knowledge-base` 已启用，Host Remote 在建连前读取有界 `personalKnowledge.project()`；未安装时静默降级，不改变语音权限。
- **知识整理委派**：语音模型多一个 `organize_notes` 操作——用户说“整理/保存/记住这些讨论”时，立即回传结果（模型继续说话），同时把草稿与当前会话增量交给**专职知识整理 agent**（PKB 的文本模型 maintainer，通过 `sessionAssistantSettings/curate` Remote）；整理完成（更新当前工作投影 + 生成长期知识提案）后在状态条显示并语音播报。整理 agent 只提案不确认，授权门仍在知识库。
- Session Assistant 不监听或广播任何宠物事件，也不承担全局待机、唤醒或宠物人格；这些能力由独立的 Pet Assistant 拥有。

语音模型只有 `update_working_draft`、`submit_to_agent`、`end_voice_session` 和 `organize_notes` 四项操作；它们的执行器由本插件注册进运行时，产品边界不变：草稿修改只调用 `inputActions.setDraft(fullText)`，提交只调用 `inputActions.submit()`，整理只委派给知识整理 agent。每个 controller 绑定 Slot 提供的 `sessionId`；组件、Session 或连接释放后，迟到的工具调用不会再修改或提交草稿。

OpenAI／豆包路由、Profile、音色、浏览器识别、上下文与朗读选项继续保留，但本插件只消费标准化会话事件。设置页的助手音色试听直接开始一场无产品动作的 `VoiceConversation`；对已完成回复的手动朗读仍通过 finalized `messageId` 从 Session 快照解析正文，不读取页面 DOM。

## 验证

```bash
npm run check
```
