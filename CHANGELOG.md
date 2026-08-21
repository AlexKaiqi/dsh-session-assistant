# Changelog

## Unreleased

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
