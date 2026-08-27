# Changelog

## Unreleased

暂无未发布变更。

## 0.4.7 (2026-08-27)

- 修复 Realtime 模型目录在 Client 启动阶段为空或保存了过期/错协议路由时，语音启动误报 “The selected voice route does not support a duplex Agent conversation”：每次建连前刷新目录、校验已选路由，并显式传递所选 Provider 的双工协议；目录短暂不可用时由 Host 按协议自动选择可用路由

## 0.4.6 (2026-08-26)

- 修复 Session Assistant 读取 DSH rc.2 `ChatNodeStore` 时错误调用不存在的 `entries()`，导致 `conversation.input.dock` 崩溃；现在同时兼容宿主的 `get()`/`values()` 契约与测试使用的标准 `Map`

## 0.4.5 (2026-08-24)

- **音色试听不卡顿、不截尾**：豆包试听提示音改为快速提交，输出端增加短抖动缓冲；完成状态由 Realtime 本地播放队列与 Provider 空闲共同决定，不再从 `audio.started` 起固定 10 秒强制关闭
- **统一用户感知事件桥**：会话快照中的工具调用与 Agent 消息先映射为 `user_input_required`、`plan_updated`、`agent_report`，状态条只消费语义事件，不再依赖具体工具名
- **删除第二套系统朗读**：移除消息朗读按钮、自动朗读、朗读范围、系统音色、朗读语速、Agent 状态合成播报及其持久化字段；产品只保留 Realtime 助手语音
- **委派汇报边界**：`subagent-report` 可被事件层识别但保持内部静默，必须先由主 Agent 判断并转化为用户可见回复，子 Agent 不能绕过主 Agent 直接对用户发声

## 0.4.4 (2026-08-24)

- 修复豆包 output-only 音色试听在已成功出声后仍等待 `AudioTTSIdleTimeoutError`：播放开始即设置有界自动收口，若 Provider 在出声后才报 idle timeout 也按已完成处理；同时修复首批缓存事件在订阅时已结束、随后 UI 又被错误重置为 active 的竞态

## 0.4.3 (2026-08-24)

- 修复严格 Remote 设置 schema 漏掉 `wakeWord`：该遗漏会让 `describe()` 响应校验失败、前端静默回退为只读默认值，表现为“保存设置”始终禁用且助手无法感知真实配置

## 0.4.2 (2026-08-24)

- **可感知、可修改自身配置**：Realtime 助手上下文始终包含非敏感设置快照，并新增 `get_assistant_settings` / `update_assistant_settings`；用户可直接询问或修改 Provider、模型、音色、唤醒词、自动朗读与上下文范围，工具结果会明确提示重连/重新进入待机的生效边界
- **执行前立即回应**：需要准备草稿、命令或 Agent 交接时，助手必须先在同一轮立即说一句简短确认，再继续生成工具参数，不再等准备完成才首次开口
- **音色试听即点即说**：试听改为 output-only 单句示例，使用实际所选 Realtime 模型与音色，不申请麦克风；播放结束自动收口并显示完成状态
- **设置反馈与语义修正**：保存后显示明确成功状态；唤醒词标签直接说明“长按麦克风进入待机”；朗读语速明确不影响 Provider Realtime；`autoSpeakMode=final` 现在只朗读 Host 标记的最终回复，不再与“全部回复”等效

## 0.4.1 (2026-08-24)

- **Workspace 与 Agent 上下文**：始终从 Host 的 Session/Workspace 投影注入当前 session、workspace 路径与名称、Agent preset 和双方能力边界；“关闭上下文”只关闭草稿与对话历史，不再丢失运行上下文，个人知识库只作为可选附加投影
- **三类任务路由**：语音助手明确区分可本地讨论的问题、需要主 Agent 的 workspace/当前状态/工具/副作用/验证任务，以及需要单次澄清的模糊意图；不再陷入“自己不能做、又不知道何时交给 Agent”的死区
- **显式交接闭环**：新增 `prepare_agent_handoff`，先把完整请求写入输入框并显示“需要主 Agent · 等待确认”，用户回答“可以/提交”后才调用 `submit_to_agent`；准备交接不会执行或隐式提交

## 0.4.0 (2026-08-24)

- **依赖与兼容基线**：升级到 DeepSeek Harness `0.1.1-rc.2`；multi-model `rc.11` 与 realtime-voice `0.3.1` 为必需 peer，Personal Knowledge `0.3.2` 改为显式可选 peer，并同步 Inventory 元数据与安装/更新说明
- **讨论增量整理**：`organize_notes` 只把**上次成功整理之后的新讨论**交给整理 agent（成功才推进基线，失败自动全量重试）——长会话多次整理不再重复归纳同一段讨论，省 token 且提案更聚焦
- **整理闭环完善**：语音会话的**讨论转写本身参与整理**（finalized transcript 累积，`organize_notes` 与草稿一起交给整理 agent——不再只整理草稿而丢失讨论）；整理完成后**结果回注语音会话上下文**（`[Curator notice]` 摘要，模型下次开口自然带出"N 条提案待确认"），语音会话结束后结果也不会丢
- **语音能力抽象升级**：继续依赖 `dsh-realtime-voice`，但产品 API 收敛为 `voiceAgent.startConversation` 与 `VoiceConversation`，Provider 协议留在运行时内部。模型动作由 `voiceAgent.registerActions` 执行和回传（支持异步双输出），并发出标准化 `action-result`。Session Assistant 仍以 `session-assistant:<sessionId>` 注册四个产品动作，并继续独占草稿、提交授权与并发守卫
- **移除自动 TTS 播报**：主 Agent 提问与完成只以状态条文字提示，不再用浏览器合成语音（speechSynthesis）机械播报；手动“朗读本条回复”按钮保留
- **待机 + 唤醒词**：空闲时麦克风旁出现月亮图标（无文字），点击进入待机；待机状态由麦克风颜色表达（琥珀色 + 右上角小圆点），只响应唤醒词（默认“你好助手”，设置页可改、留空禁用），命中即自动恢复语音会话；待机监听可被主动语音会话抢占
- 新增 `docs/design.md` 设计哲学文档：为什么存在、价值、第一性原理、能力全景、边界、关键决策记录（含历史根因如豆包 `items` 数组、空草稿静默等）
- **主 Agent 提问提示（human-in-the-loop）**：监听当前会话中主 Agent 的 `ask_user_question` 工具调用，状态条显示“主 Agent 询问：<问题+选项>”，按 callId 去重不重复打扰
- **主 Agent 完成提醒**：语音提交后监听当前会话，主 Agent 产出新回复时状态条显示“主 Agent 已回复”
- 设置页“助手音色试听”改为**全双工对话试听**：直接开启带麦克风的 Realtime 会话，使用 Session Assistant 的提示词上下文（无工具），可以问它“你会什么”并来回对话；显示实时转写；点击停止或**退出设置页自动关闭**
- 移除设置页“回复朗读试听”（浏览器 speechSynthesis 预览，音色不一致且多余）；清理相关 locale 键
- 语音状态条转写改为**实时流式显示**（配合 realtime-voice 转发豆包 `input_audio_transcription.started/delta`），并支持**多行换行**（不再单行省略）
- 修复豆包续轮机制：工具结果（`tool.result`）现在**先于** `context.update` 回传——Doubao Duplex 在函数结果上自动续轮，若先发 `session.update` 可能冲掉 pending call，导致模型永远等不到结果、确认语音不出现；`context.update` 改为工具流和提交之后的 best-effort，失败不再影响任何链路
- 空草稿提交拒绝现在**直接显示在状态条**（“没有可发送的内容…”），不再只依赖模型语音转述——即使豆包模型不出声也有可见反馈
- 修复“发送后无反应且未提交”：空草稿的 `submit_to_agent` 之前会通过校验，但输入框对空草稿提交静默忽略，导致模型说“已提交”实际什么都没发；现在空/纯空白草稿直接以 `ok:false` 拒绝，并在提交成功后状态条显示“已提交给主 Agent”
- 修复提交后语音静默卡死：`submit_to_agent` / `update_working_draft` 工具执行中任一异步步骤（如知识库投影 `remote.context`）失败时，不再被 `void consume` 静默吞掉导致模型一直等工具结果、提交丢失；现在会以 `ok:false` 回传工具结果并把错误显示在状态条，会话仍可继续使用
- 建连与草稿 context 的知识库投影失败时降级为本地上下文，不再阻断语音会话启动或工具链路
- 语音报错本地化：浏览器麦克风失败（找不到设备/权限被拒/被占用等）显示可读中文提示而非原始英文；`dsh-realtime-voice` 提供稳定错误码（`mic_not_found`、`mic_permission_denied`、`mic_unreadable`、`mic_aborted`、`audio_input_busy`），本插件映射为对应 locale 文案，未知错误仍回退原文
- 输入栏语音按钮由文字“语音/结束”改为麦克风图标：录制中图标变红并脉冲呼吸，`title`/`aria-label` 与 `aria-pressed` 保留完整“开始/结束语音会话”语义；移除已无引用的 `startVoice`/`stopVoice` 文案键
- 修正助手边界：恢复会话输入栏麦克风与状态条，并彻底移除宠物激活/状态事件；Session Assistant 只服务当前 Session
- 设置页新增两条语音播放试听：receive-only Realtime 会话播放实际所选助手模型/音色且不申请麦克风权限；浏览器朗读试听使用当前未保存的语言、音色和语速；两者均支持停止、完成与错误反馈
- Client UI 接入宿主 locale namespace，设置页、语音控件、会话状态与朗读操作统一支持中英文；中文设置分组名改为“会话助手”
- Realtime 建连与草稿 context.update 可选合并 `dsh-personal-knowledge-base` 的有界投影；知识库缺失或不可用时保持原链路

- Host 配置迁移到 DSH Settings `session-assistant` 命名空间，实时应用 composition base；旧 JSON 仅作一次性导入源且不再写回
- 新增插件自有严格 Typert Remote，设置保存带 revision 防冲突；移除自定义 HTTP 配置协议
- Client 重写为四个 Slot 组件，只消费 `voiceAgent` 标准事件和 Session `inputActions`
- 修复 Client bundle 将 `zod`、Schemastery 与 Host Settings 模块错误外置导致 Harness loader 加载失败；浏览器产物现在只请求已声明的 React 运行时
- 移除 Session Assistant 内所有 Provider 媒体传输、DOM observer/selector、猜测提交按钮和页面 overlay
- 新增 controller 生命周期、并发编辑、显式提交/结束、bounded context、messageId 朗读与禁止实现字符串测试

- 设置页改为 Provider 能力驱动：浏览器、OpenAI Realtime、豆包 Duplex 只显示各自支持的字段；GPT 提供官方内置音色下拉，豆包直接选择已启用的音色路由
- 浏览器回复朗读从实时语音 Provider 中拆出独立分组，音色由 `speechSynthesis.getVoices()` 动态枚举，不再要求手填名称
- 修复 Session Profile 固定 `vivi` 覆盖豆包已选音色的问题；OpenAI 每个受支持音色使用独立 Profile，确保建连前选择真实生效
- 新增跨宠物、文本助手、主 Agent 与 Realtime Voice 的 26 项验收目录和首轮缺口基线；明确文本链路先于语音接宠物
- 客户端 DOM observer、轮询、媒体连接、全局监听器和注入节点纳入 `ctx.effect` 生命周期，插件重载/卸载时统一释放
- Session Assistant 改为只消费 `dsh-multi-model-provider/realtimeModelRuntime`；模型目录、凭据解析和 Profile runtime 不再由语音适配插件重复管理
- 一次语音连接绑定启动时的 `focusedSessionId`；切换 Session 后拒绝修改或提交原会话草稿，避免静默改变目标
- Realtime 角色收紧为主 Agent 前的语音控制器：只能讨论、维护草稿、提交和结束会话，不得声称执行文件、命令或浏览器任务
- 新增 `submit_to_agent` 与 `end_voice_session` 原子工具；“提交 / 让 Agent 执行 / 结束语音”等指令可全程通过语音完成
- 移除双工工作区中的“整理 / 提交 / 结束”按钮，只保留必要状态与回复转写；整理继续由 `update_working_draft` 的 `ready` 状态完成

## 0.3.0 (2026-08-19)

- 新增豆包 Realtime Speech 3.0 / Seeduplex 后端：JSON WebSocket 全双工音频、插话取消、ASR/回复转写与原生函数调用
- host 增加同源 WebSocket 安全代理，长期 App ID/API Key 不下发浏览器；仅允许白名单音频、上下文、取消和工具结果事件
- 模型注册插件新增 `doubao/realtime-duplex-3.0`，自动选择并在设置页显示凭据缺口
- 浏览器采集音频后下采样为 16 kHz PCM，上游 24 kHz PCM 通过 Web Audio 排队播放并支持立即打断
- 豆包与 OpenAI 共用 `update_working_draft` 草稿侧通道，讨论回复仍不会直接写入草稿
- “整理成最终稿”自动选择已注册的非 Realtime 文本模型，根据当前草稿、应用上下文和最近语音讨论生成最终文本

## 0.2.0 (2026-08-19)

- 将产品从“语音听写/改稿”升级为上下文感知的语音思考与定稿工作台
- Realtime 改为真正的 WebRTC 双工语音对话，支持模型语音回复和 server VAD 插话打断
- 语音讨论与草稿修改拆成两条通道：纯讨论只输出音频，只有 `update_working_draft` 工具调用才能修改草稿
- 客户端执行草稿操作并回传 `function_call_output`，模型随后在同一会话中用语音确认
- composer 新增共同思考面板，以及“整理成最终稿”和“提交给 Agent”的明确状态与提交边界
- “整理成最终稿”在同一 Realtime 会话中追加文本轮次，保留本轮讨论与已经确认的约束

## 0.1.8 (2026-08-19)

- 新增 GPT Realtime 语音草稿编辑：支持追加口述内容和修改前文，每个语音轮次返回整份新草稿
- 自动读取 `dsh-multi-model-provider` 和 `llm-pi-ai` 中的兼容 Realtime 路由；单模型自动选中，多模型可在设置页下拉选择
- host 从注册路由解析 Base URL 和凭据引用，长期 Key 不下发浏览器；保留免费浏览器 SpeechRecognition 回退
- Realtime 同步当前草稿、工作区名与最近可见对话；隐藏 Agent 状态不外发，host 强制 4,000 字符上限

## 0.1.7 (2026-08-16)

- README 演示图拆为三个场景 GIF（中英双语各一套）：demo-input（语音输入）/ demo-speak（回复朗读）/ demo-edit（边听边改）

- 语音输入改为「只追加、绝不回写」：确认句逐句实时追加到框尾；中间结果只进上方气泡不进输入框；停止时不做任何回填——聆听中打字改字、全删都立即生效，删掉的内容不会复活
- Voice input is now append-only: each confirmed sentence appends to the composer in real time, interim results show only in the bubble, and stopping never refills the box — edits and deletions made while listening are respected immediately

## 0.1.6 (2026-08-16)

- 边听边改（方案 D）：聆听中真实打字立即接管输入框（isTrusted 区分），识别继续累积；停止时只把接管后新识别的文本追加到框尾，不覆盖用户修改；气泡提示「正在打字修改，识别继续…」
- Edit while listening: real keystrokes instantly take over the composer (isTrusted detection); recognition keeps accumulating and only the post-takeover text is appended on stop, never overwriting user edits; bubble hints "Typing, still listening…"

## 0.1.5 (2026-08-16)

- README 恢复标准双文件结构：README.md 纯英文 / README.zh-CN.md 纯中文，每个文件仅顶部一行语言切换链接（不再双语混排）
- README restored to the standard two-file layout: English-only README.md + Chinese-only README.zh-CN.md, with a single top switcher line per file

## 0.1.4 (2026-08-16)

- 自动朗读新增「范围」选项：只读最终结论（默认）/ 全部朗读（思维链+结论），设置页下拉切换
- README 合并为单文件双语版：页内锚点切换语言（不再跳页），EN 段用 demo.en.gif、中文段用 demo.gif
- 演示 GIF 识别文本只保留「你好世界」/「Hello world」（去掉第二句累积）
- Auto-read scope option: final conclusion only (default) or everything including thinking chains
- Single bilingual README with in-page anchor language switching; demo.en.gif for the English section, demo.gif for the Chinese section
- Demo GIFs keep a single final transcript: 你好世界 / Hello world

## 0.1.3 (2026-08-16)

- 自动朗读修复：speak 前 resume + 首次用户交互预热（0 音量空 utterance）解锁浏览器自动播放策略
- 自动朗读只读最终结论（新 UI 的 step/tool-call 交替结构下跳过思维链与中间步骤）
- 语音预览框配色对齐 dsh 风格：灰边框/箭头 + 蓝色光标（麦克风录制红点保留）
- 小喇叭恢复全挂（所有带正文的助手消息，含思维链）
- README 双语 GIF：docs/demo.gif（中文）/ docs/demo.en.gif（英文），保留朗读演示段
- Auto-read fix: resume() + first-interaction warm-up unlock the browser autoplay policy
- Auto-read speaks only the final conclusion (skips thinking chains in the new alternating flow)
- Preview bubble recolored to dsh-neutral (gray border, blue caret; mic recording dot stays red)
- Speaker buttons restored on every assistant message with a body
- Bilingual demo GIFs: docs/demo.gif (zh) / docs/demo.en.gif (en), read-aloud segment kept

## 0.1.2 (2026-08-16)

- 朗读小喇叭只挂在**最终结论**正文右上角（悬浮按钮），思维链/中间步骤不再显示喇叭
- 自动朗读同样只读最终结论，跳过思维链
- Speaker button now appears only on the final conclusion (floating at the top-right of the reply body), never on thinking-chain rows
- Auto-read also skips thinking chains and reads only final conclusions

## 0.1.1 (2026-08-16)

- 连续听写：点一次麦克风持续聆听，多句累积写入输入框，仅手动点击停止（不再说完一句自动停）
- 语音预览框即时化：点击即显「正在聆听…」聆听态（呼吸动画），锚定输入框正上方跟随滚动，停止淡出
- README 拆分中英两版（README.md 英文 / README.zh-CN.md 中文，顶部互链）
- Continuous dictation: mic listens until manually stopped, sentences accumulate in the composer
- Instant preview: "Listening…" state appears immediately on click, anchored above the composer with a fade-out on stop
- README split into English (README.md) and Chinese (README.zh-CN.md) editions with cross-links

## 0.1.0 (2026-08-16)

- MVP: composer 麦克风按钮 + SpeechRecognition 语音输入（中间结果实时上屏、权限/网络错误提示）
- 助手回复小喇叭朗读 + 自动朗读开关（可随时打断）+ Edge 中文自然音色自动选择
- dsh web 设置页 Session Assistant 分组（识别语言 / 自动朗读 / 音色 / 语速），保存即生效
- 非安全上下文 / 浏览器不支持 / 无麦克风权限均有可读提示
