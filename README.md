# dsh-session-assistant

面向当前 Session 的语音讨论与草稿产品层：与用户讨论请求、维护主输入区草稿，并在用户明确授权后提交给主 Agent。

## 架构

- Host 通过 DSH Settings 注册 `session-assistant` 命名空间，以组合 `Config` 为 base，并声明 `applies: live`。
- 仅当命名空间没有用户覆盖时，首次启动可从 `~/.dsh/session-assistant.json`、`talk-to-text.json` 或 `chatvoice.json` 导入一次；之后不再写这些旧文件。
- 插件自有的严格 Typert Remote 只公开带 revision 防冲突的 `describe` 与 `save`。
- Client UI 精确注册到 `conversation.input.right`、`conversation.input.dock`、`conversation.chat.assistant-actions` 和 `settings.section`。
- Client 文案集中注册到宿主 locale namespace，中文显示“会话助手”，并随全局语言设置在中英文间实时切换。
- `dsh-realtime-voice` 负责浏览器与 Provider 媒体传输，并提供中立的 `realtimeVoice` Client 服务。
- 若 `dsh-personal-knowledge-base` 已启用，Host Remote 在建连前读取有界 `personalKnowledge.project()`；未安装时静默降级，不改变语音权限。
- 当前 Session 的麦克风组件响应 `dsh-pet-assistant:activate`，并用 `dsh-pet-assistant:state` 向宠物投影公开 lifecycle/transcript；宠物入口与输入栏共用同一个 `VoiceController`。

语音模型只有 `update_working_draft`、`submit_to_agent` 和 `end_voice_session` 三项操作。草稿修改只调用 `inputActions.setDraft(fullText)`，提交只调用 `inputActions.submit()`。每个 controller 绑定 Slot 提供的 `sessionId`；组件、Session 或连接释放后，迟到的工具调用不会再修改或提交草稿。

OpenAI／豆包路由、Profile、音色、浏览器识别、上下文与朗读选项继续保留，但本插件只消费标准化语音事件。设置页提供两种明确分离的试听：助手音色试听通过 receive-only Realtime 会话播放当前模型/音色（不打开麦克风，可能消耗少量 Provider 额度）；回复朗读试听枚举浏览器音色，并使用尚未保存的语言、音色和语速。朗读动作通过 finalized `messageId` 从 Session 快照解析正文，不读取页面 DOM。

## 验证

```bash
npm run check
```
