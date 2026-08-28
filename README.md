# dsh-session-assistant

[English](README.en.md) | 简体中文

[![npm version](https://img.shields.io/npm/v/dsh-session-assistant.svg)](https://www.npmjs.com/package/dsh-session-assistant)
[![CI](https://github.com/AlexKaiqi/dsh-session-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexKaiqi/dsh-session-assistant/actions/workflows/ci.yml)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-0b7285.svg)](https://github.com/topics/dsh-plugin)
[![MIT license](https://img.shields.io/npm/l/dsh-session-assistant.svg)](./LICENSE)

面向当前 Session 的语音讨论与草稿产品层：与用户讨论请求、维护主输入区草稿，并在用户明确授权后提交给主 Agent。

> 面向用户、正式助手与设置页语音导览的统一产品介绍：见 [INTRODUCTION.md](INTRODUCTION.md)。设计哲学与技术边界见 [docs/design.md](docs/design.md)。

## 安装

本版本面向 DeepSeek Harness `0.1.1-rc.2`。`dsh-multi-model-provider@^0.1.0-rc.11` 与 `dsh-realtime-voice@^0.3.1` 是必需插件；`dsh-personal-knowledge-base@^0.3.2` 是可选知识集成。它们都应直接安装到同一 profile，DSH 不会根据 peer 声明自动安装、激活或更新。

```sh
dsh plugin --profile web add dsh-multi-model-provider dsh-realtime-voice dsh-session-assistant
dsh plugin --profile web update dsh-multi-model-provider dsh-realtime-voice dsh-session-assistant
```

若同一 profile 已安装 `dsh-personal-knowledge-base`，知识投影与 `organize_notes` 会自动启用；未安装时静默降级。该可选包尚未发布到 npm，因此不要把它加入普通 registry 安装命令。

## 使用前配置

- 先在 DSH 模型设置中配置可用的 OpenAI Realtime 或豆包 Realtime Duplex 路由；route 留空时会自动选择当前协议下第一个可用路由。
- 浏览器识别依赖浏览器的 `SpeechRecognition` 能力，Chrome/Edge 兼容性最好；Realtime 模式需要麦克风权限。
- Realtime 会话和设置页语音导览可能产生 Provider 费用。普通检查与单元测试不会发起真实计费请求。
- 长期 Provider 凭据只保留在 Host；浏览器只接收经过校验的 route/profile 和短期会话数据。

## 架构与边界

- Host 通过 DSH Settings 注册 `session-assistant` 命名空间，以组合 `Config` 为 base，并声明 `applies: live`。
- 仅当命名空间没有用户覆盖时，首次启动可从 `~/.dsh/session-assistant.json`、`talk-to-text.json` 或 `chatvoice.json` 导入一次；之后不再写这些旧文件。
- 插件自有的严格 Typert Remote 只公开带 revision 防冲突的 `describe` 与 `save`。
- Client UI 精确注册到 `conversation.input.right`、`conversation.input.dock` 和 `settings.section`；麦克风与状态只属于当前 Session。
- Client 文案集中注册到宿主 locale namespace，支持 `en`、`zh`、`zh-TW`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`ar`、`hi`，并随全局语言设置实时切换。
- `dsh-realtime-voice` 对外提供“与 Agent 开始全双工语音对话”的能力；Provider 协议、媒体传输、打断和音频输入仲裁都隐藏在该边界之后。
- 每个会话以 `session-assistant:<sessionId>` 开始一场 `VoiceConversation`，并用同一 owner 前缀向 `voiceAgent.registerActions` 注册产品动作。动作的授权门仍由本插件持有；若全局 Pet Assistant 或其他语音产品正在占用麦克风，会明确返回冲突。
- Realtime route 留空表示自动选择：正式会话与语音导览都会选取所选 Provider 协议下首个可用 route，不会把空 route 传给统一语音底座。
- 待机唤醒词可在设置中修改。只有包含该唤醒词的最终识别结果会启动 Realtime；待机期间在浏览器内存保留有界 PCM，命中后将整句原始音频（包括唤醒词）作为首条用户消息提交，例如“你好助手，继续检查刚才的修改”无需再次复述命令。未命中的音频立即丢弃且不持久化。
- 若 `dsh-personal-knowledge-base` 已启用，Host Remote 在建连前读取有界 `personalKnowledge.project()`；未安装时静默降级，不改变语音权限。
- **知识整理委派**：语音模型多一个 `organize_notes` 操作——用户说“整理/保存/记住这些讨论”时，立即回传结果（模型继续说话），同时把草稿与当前会话增量交给**专职知识整理 agent**（PKB 的文本模型 maintainer，通过 `sessionAssistantSettings/curate` Remote）；整理完成后在状态条显示结果。整理 agent 只提案不确认，授权门仍在知识库。
- **主 Agent 用户感知事件**：`ask_user_question` 与 `todo_write` 先映射成稳定语义事件，再由状态条显示；子 Agent 的主动 `subagent-report` 只交给主 Agent，原始内容不会绕过主 Agent 直接面向用户。
- Session Assistant 不监听或广播任何宠物事件，也不承担全局待机、唤醒或宠物人格；这些能力由独立的 Pet Assistant 拥有。

语音模型可操作草稿、Agent 交接、提交、结束会话、知识整理，以及读取/修改自己的非敏感配置；需要 workspace、当前状态、工具、副作用或验证的请求先形成可见的待确认交接，不会直接执行或提交。需要准备复杂草稿或工具参数时，助手先在同一轮立即语音确认，再继续准备。执行器由本插件注册进运行时，产品边界不变：草稿修改只调用 `inputActions.setDraft(fullText)`，提交只调用 `inputActions.submit()`，整理只委派给知识整理 agent。每个 controller 绑定 Slot 提供的 `sessionId`；组件、Session 或连接释放后，迟到的工具调用不会再修改或提交草稿。

OpenAI／豆包路由、Profile、Realtime 音色、识别语言、上下文与唤醒词是唯一保留的语音设置。设置页“语音导览”会使用所选 Realtime 音色介绍插件，并保持麦克风开启供你继续询问能力、边界和推荐工作流。正式助手和语音导览都读取 [INTRODUCTION.md](INTRODUCTION.md) 的同一份产品介绍。Provider、模型、Realtime 音色与识别语言在下次连接时生效，唤醒词在下次长按麦克风进入待机时生效。插件不再注册浏览器/系统朗读按钮、自动朗读、朗读音色或朗读语速。

## 验证

```bash
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 包含 peer 依赖检查、类型检查、评测发布门、构建、47 项行为测试和 npm 包内容审计。真实 Provider 产品链需显式授权计费调用后运行 `pnpm test:e2e:live`；该用例把生成语音送入浏览器虚拟麦克风，经统一 `voiceAgent` 和真实 Realtime Provider，最终断言真实草稿执行器修改草稿且未越权提交。

常见问题：语音导览不可用通常表示没有可调用的 Realtime route；麦克风失败会以稳定错误码本地化显示；其他语音产品占用麦克风时会明确返回 `audio_input_busy`，不会并行采集。
