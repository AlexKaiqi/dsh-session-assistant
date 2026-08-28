import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by the Session Assistant client UI. */
export const NS = 'sessionAssistant'

/** Simplified Chinese dictionary and key-set source of truth. */
export const zh = {
  settingsTitle: '会话助手',
  startVoiceSession: '开始语音会话',
  stopVoiceSession: '结束语音会话',
  draftReady: '最终稿就绪',
  agentRequired: '需要主 Agent · 等待确认',
  submitted: '已提交给主 Agent',
  agentAsking: '主 Agent 询问：',
  agentReplied: '主 Agent 已回复',
  agentPlanCreated: '主 Agent 已制定计划，共',
  agentPlanProgress: '主 Agent 计划进展',
  agentPlanCompleted: '主 Agent 计划已完成',
  standbyTitle: '长按进入待机，说唤醒词唤醒',
  wakeByVoice: '说唤醒词或点击此处唤醒',
  wakeWord: '待机唤醒词（长按麦克风启用）',
  wakeWordPlaceholder: '留空禁用待机唤醒',
  interrupt: '打断',
  provider: 'Provider',
  browserRecognition: '浏览器识别',
  openaiRealtime: 'OpenAI Realtime',
  doubaoRealtime: '豆包 Realtime Duplex',
  recognitionLanguage: '识别语言',
  chinese: '中文',
  english: 'English',
  realtimeModel: '实时模型',
  autoSelect: '自动选择',
  outputVoice: '输出音色',
  context: '上下文',
  draftAndRecent: '草稿与最近对话',
  draftOnly: '仅草稿',
  off: '关闭',
  voicePreview: '语音导览',
  playRealtimePreview: '开始语音导览',
  stopRealtimePreview: '结束语音导览',
  realtimePreviewUsingCurrent: '用所选音色与插件向导对话，可询问“你能做什么”、能力边界和推荐工作流；可能消耗少量 Provider 额度',
  realtimePreviewConnecting: '正在连接插件语音向导…',
  realtimePreviewFinished: '语音导览已结束，可再次开始',
  realtimePreviewUnavailable: '所选 Realtime 路由当前无法启动语音导览',
  previewFailed: '语音导览失败：',
  previewUnknownError: '未知错误',
  saving: '保存中…',
  saveSettings: '保存设置',
  settingsSaved: '设置已保存并生效',
  browserRecognitionFailed: '浏览器语音识别失败。',
  settingsSaveFailed: '设置保存失败。',
  micNotFound: '未检测到麦克风，请检查系统输入设备或连接耳机/外接麦克风',
  micPermissionDenied: '麦克风权限被拒绝，请在浏览器和系统设置中允许麦克风访问',
  micUnreadable: '麦克风不可用或正被其他应用占用',
  micAborted: '麦克风访问被中断，请重试',
  micBusy: '麦克风正被其他语音功能占用，请先结束那边的语音会话',
  emptySubmit: '没有可发送的内容，请先在输入框输入或口述要发送的内容',
  phaseIdle: '空闲',
  phaseConnecting: '连接中',
  phaseListening: '正在聆听',
  phaseThinking: '正在思考',
  phaseSpeaking: '正在回复',
  phaseEditing: '正在编辑草稿',
  phaseCurating: '正在整理知识',
  phaseStopped: '已停止',
  phaseClosed: '已结束',
  curatedDone: '知识整理完成',
  curatedNone: '知识整理完成：无新提案',
  curateFailed: '知识整理失败',
  curateUnavailable: '知识库未安装',
} as const

export type SessionAssistantLocaleKey = keyof typeof zh

/** English dictionary, statically checked against the Chinese key set. */
export const en: Record<SessionAssistantLocaleKey, string> = {
  settingsTitle: 'Session Assistant',
  startVoiceSession: 'Start voice session',
  stopVoiceSession: 'End voice session',
  draftReady: 'Final draft ready',
  agentRequired: 'Primary Agent required · awaiting confirmation',
  submitted: 'Submitted to the Agent',
  agentAsking: 'The Agent asks: ',
  agentReplied: 'The Agent replied',
  agentPlanCreated: 'The Agent created a plan. Total items:',
  agentPlanProgress: 'Agent plan progress',
  agentPlanCompleted: 'The Agent plan is complete',
  standbyTitle: 'Press and hold to enter standby; the wake word reactivates',
  wakeByVoice: 'Say the wake word or click to wake',
  wakeWord: 'Wake word',
  wakeWordPlaceholder: 'Empty disables standby wake-up',
  interrupt: 'Interrupt',
  provider: 'Provider',
  browserRecognition: 'Browser recognition',
  openaiRealtime: 'OpenAI Realtime',
  doubaoRealtime: 'Doubao Realtime Duplex',
  recognitionLanguage: 'Recognition language',
  chinese: '中文',
  english: 'English',
  realtimeModel: 'Realtime model',
  autoSelect: 'Auto-select',
  outputVoice: 'Output voice',
  context: 'Context',
  draftAndRecent: 'Draft and recent conversation',
  draftOnly: 'Draft only',
  off: 'Off',
  voicePreview: 'Voice tour',
  playRealtimePreview: 'Start voice tour',
  stopRealtimePreview: 'End voice tour',
  realtimePreviewUsingCurrent: 'Talk to the plugin guide in the selected voice and ask what it can do, its limits, and recommended workflows; may use a small amount of Provider quota',
  realtimePreviewConnecting: 'Connecting to the plugin voice guide…',
  realtimePreviewFinished: 'Tour ended; start again anytime',
  realtimePreviewUnavailable: 'The selected Realtime route cannot start the voice tour',
  previewFailed: 'Voice tour failed: ',
  previewUnknownError: 'Unknown error',
  saving: 'Saving…',
  saveSettings: 'Save settings',
  settingsSaved: 'Settings saved and applied',
  browserRecognitionFailed: 'Browser speech recognition failed.',
  settingsSaveFailed: 'Failed to save settings.',
  micNotFound: 'No microphone was detected. Check your system input devices or connect a headset.',
  micPermissionDenied: 'Microphone permission was denied. Allow microphone access in your browser and system settings.',
  micUnreadable: 'The microphone is unavailable or in use by another app.',
  micAborted: 'Microphone access was interrupted. Please try again.',
  micBusy: 'The microphone is in use by another voice feature. End that voice session first.',
  emptySubmit: 'There is nothing to send. Type or dictate content into the composer first.',
  phaseIdle: 'Idle',
  phaseConnecting: 'Connecting',
  phaseListening: 'Listening',
  phaseThinking: 'Thinking',
  phaseSpeaking: 'Speaking',
  phaseEditing: 'Editing draft',
  phaseCurating: 'Organizing knowledge',
  phaseStopped: 'Stopped',
  phaseClosed: 'Closed',
  curatedDone: 'Knowledge organized',
  curatedNone: 'Knowledge organized: no new proposals',
  curateFailed: 'Knowledge organization failed',
  curateUnavailable: 'Knowledge base is not installed',
}

function fromEnglish(overrides: Partial<Record<SessionAssistantLocaleKey, string>>): Record<SessionAssistantLocaleKey, string> {
  return { ...en, ...overrides }
}

/** Main controls are translated for every built-in locale; long diagnostics safely retain English. */
export const zhTW = fromEnglish({
  settingsTitle: '會話助手', startVoiceSession: '開始語音會話', stopVoiceSession: '結束語音會話', draftReady: '最終稿就緒', interrupt: '打斷', browserRecognition: '瀏覽器辨識', recognitionLanguage: '辨識語言', chinese: '中文', realtimeModel: '即時模型', autoSelect: '自動選擇', outputVoice: '輸出音色', context: '上下文', draftAndRecent: '草稿與最近對話', draftOnly: '僅草稿', off: '關閉', voicePreview: '助手音色試聽', playRealtimePreview: '試聽助手音色', stopRealtimePreview: '停止助手試聽', saving: '儲存中…', saveSettings: '儲存設定', settingsSaveFailed: '設定儲存失敗。', phaseIdle: '閒置', phaseConnecting: '連線中', phaseListening: '正在聆聽', phaseThinking: '正在思考', phaseSpeaking: '正在回覆', phaseEditing: '正在編輯草稿', phaseStopped: '已停止', phaseClosed: '已結束',
})

export const ja = fromEnglish({
  settingsTitle: 'セッションアシスタント', startVoiceSession: '音声セッションを開始', stopVoiceSession: '音声セッションを終了', draftReady: '最終稿の準備完了', interrupt: '中断', browserRecognition: 'ブラウザー音声認識', recognitionLanguage: '認識言語', chinese: '中国語', realtimeModel: 'リアルタイムモデル', autoSelect: '自動選択', outputVoice: '出力音声', context: 'コンテキスト', draftAndRecent: '下書きと最近の会話', draftOnly: '下書きのみ', off: 'オフ', voicePreview: 'アシスタント音声プレビュー', playRealtimePreview: 'アシスタント音声を試聴', stopRealtimePreview: '試聴を停止', saving: '保存中…', saveSettings: '設定を保存', settingsSaveFailed: '設定を保存できませんでした。', phaseIdle: '待機中', phaseConnecting: '接続中', phaseListening: '聞き取り中', phaseThinking: '思考中', phaseSpeaking: '応答中', phaseEditing: '下書きを編集中', phaseStopped: '停止済み', phaseClosed: '終了済み',
})

export const ko = fromEnglish({
  settingsTitle: '세션 도우미', startVoiceSession: '음성 세션 시작', stopVoiceSession: '음성 세션 종료', draftReady: '최종 초안 준비됨', interrupt: '중단', browserRecognition: '브라우저 음성 인식', recognitionLanguage: '인식 언어', chinese: '중국어', realtimeModel: '실시간 모델', autoSelect: '자동 선택', outputVoice: '출력 음성', context: '컨텍스트', draftAndRecent: '초안 및 최근 대화', draftOnly: '초안만', off: '끄기', voicePreview: '도우미 음성 미리듣기', playRealtimePreview: '도우미 음성 재생', stopRealtimePreview: '미리듣기 중지', saving: '저장 중…', saveSettings: '설정 저장', settingsSaveFailed: '설정을 저장하지 못했습니다.', phaseIdle: '대기', phaseConnecting: '연결 중', phaseListening: '듣는 중', phaseThinking: '생각 중', phaseSpeaking: '응답 중', phaseEditing: '초안 편집 중', phaseStopped: '중지됨', phaseClosed: '종료됨',
})

export const es = fromEnglish({
  settingsTitle: 'Asistente de sesión', startVoiceSession: 'Iniciar sesión de voz', stopVoiceSession: 'Finalizar sesión de voz', draftReady: 'Borrador final listo', interrupt: 'Interrumpir', browserRecognition: 'Reconocimiento del navegador', recognitionLanguage: 'Idioma de reconocimiento', chinese: 'Chino', english: 'Inglés', realtimeModel: 'Modelo en tiempo real', autoSelect: 'Selección automática', outputVoice: 'Voz de salida', context: 'Contexto', draftAndRecent: 'Borrador y conversación reciente', draftOnly: 'Solo borrador', off: 'Desactivado', voicePreview: 'Vista previa de la voz', playRealtimePreview: 'Probar voz del asistente', stopRealtimePreview: 'Detener prueba', saving: 'Guardando…', saveSettings: 'Guardar ajustes', settingsSaveFailed: 'No se pudieron guardar los ajustes.', phaseIdle: 'Inactivo', phaseConnecting: 'Conectando', phaseListening: 'Escuchando', phaseThinking: 'Pensando', phaseSpeaking: 'Respondiendo', phaseEditing: 'Editando borrador', phaseStopped: 'Detenido', phaseClosed: 'Finalizado',
})

export const fr = fromEnglish({
  settingsTitle: 'Assistant de session', startVoiceSession: 'Démarrer la session vocale', stopVoiceSession: 'Terminer la session vocale', draftReady: 'Brouillon final prêt', interrupt: 'Interrompre', browserRecognition: 'Reconnaissance du navigateur', recognitionLanguage: 'Langue de reconnaissance', chinese: 'Chinois', english: 'Anglais', realtimeModel: 'Modèle temps réel', autoSelect: 'Sélection automatique', outputVoice: 'Voix de sortie', context: 'Contexte', draftAndRecent: 'Brouillon et conversation récente', draftOnly: 'Brouillon uniquement', off: 'Désactivé', voicePreview: "Aperçu de la voix de l’assistant", playRealtimePreview: 'Écouter la voix de l’assistant', stopRealtimePreview: "Arrêter l’aperçu", saving: 'Enregistrement…', saveSettings: 'Enregistrer les réglages', settingsSaveFailed: "Échec de l’enregistrement des réglages.", phaseIdle: 'Inactif', phaseConnecting: 'Connexion', phaseListening: 'Écoute', phaseThinking: 'Réflexion', phaseSpeaking: 'Réponse', phaseEditing: 'Modification du brouillon', phaseStopped: 'Arrêté', phaseClosed: 'Terminé',
})

export const de = fromEnglish({
  settingsTitle: 'Sitzungsassistent', startVoiceSession: 'Sprachsitzung starten', stopVoiceSession: 'Sprachsitzung beenden', draftReady: 'Finaler Entwurf bereit', interrupt: 'Unterbrechen', browserRecognition: 'Browser-Spracherkennung', recognitionLanguage: 'Erkennungssprache', chinese: 'Chinesisch', english: 'Englisch', realtimeModel: 'Echtzeitmodell', autoSelect: 'Automatisch auswählen', outputVoice: 'Ausgabestimme', context: 'Kontext', draftAndRecent: 'Entwurf und letzter Dialog', draftOnly: 'Nur Entwurf', off: 'Aus', voicePreview: 'Assistentenstimme testen', playRealtimePreview: 'Assistentenstimme abspielen', stopRealtimePreview: 'Vorschau stoppen', saving: 'Speichern…', saveSettings: 'Einstellungen speichern', settingsSaveFailed: 'Einstellungen konnten nicht gespeichert werden.', phaseIdle: 'Bereit', phaseConnecting: 'Verbindung wird hergestellt', phaseListening: 'Hört zu', phaseThinking: 'Denkt nach', phaseSpeaking: 'Antwortet', phaseEditing: 'Entwurf wird bearbeitet', phaseStopped: 'Gestoppt', phaseClosed: 'Beendet',
})

export const ptBR = fromEnglish({
  settingsTitle: 'Assistente de sessão', startVoiceSession: 'Iniciar sessão de voz', stopVoiceSession: 'Encerrar sessão de voz', draftReady: 'Rascunho final pronto', interrupt: 'Interromper', browserRecognition: 'Reconhecimento do navegador', recognitionLanguage: 'Idioma de reconhecimento', chinese: 'Chinês', english: 'Inglês', realtimeModel: 'Modelo em tempo real', autoSelect: 'Seleção automática', outputVoice: 'Voz de saída', context: 'Contexto', draftAndRecent: 'Rascunho e conversa recente', draftOnly: 'Somente rascunho', off: 'Desativado', voicePreview: 'Prévia da voz do assistente', playRealtimePreview: 'Ouvir voz do assistente', stopRealtimePreview: 'Parar prévia', saving: 'Salvando…', saveSettings: 'Salvar configurações', settingsSaveFailed: 'Falha ao salvar as configurações.', phaseIdle: 'Inativo', phaseConnecting: 'Conectando', phaseListening: 'Ouvindo', phaseThinking: 'Pensando', phaseSpeaking: 'Respondendo', phaseEditing: 'Editando rascunho', phaseStopped: 'Parado', phaseClosed: 'Encerrado',
})

export const ru = fromEnglish({
  settingsTitle: 'Помощник сеанса', startVoiceSession: 'Начать голосовой сеанс', stopVoiceSession: 'Завершить голосовой сеанс', draftReady: 'Итоговый черновик готов', interrupt: 'Прервать', browserRecognition: 'Распознавание в браузере', recognitionLanguage: 'Язык распознавания', chinese: 'Китайский', english: 'Английский', realtimeModel: 'Модель реального времени', autoSelect: 'Автовыбор', outputVoice: 'Выходной голос', context: 'Контекст', draftAndRecent: 'Черновик и недавний диалог', draftOnly: 'Только черновик', off: 'Выкл.', voicePreview: 'Прослушать голос помощника', playRealtimePreview: 'Воспроизвести голос помощника', stopRealtimePreview: 'Остановить предпросмотр', saving: 'Сохранение…', saveSettings: 'Сохранить настройки', settingsSaveFailed: 'Не удалось сохранить настройки.', phaseIdle: 'Ожидание', phaseConnecting: 'Подключение', phaseListening: 'Слушаю', phaseThinking: 'Думаю', phaseSpeaking: 'Отвечаю', phaseEditing: 'Редактирую черновик', phaseStopped: 'Остановлено', phaseClosed: 'Завершено',
})

export const ar = fromEnglish({
  settingsTitle: 'مساعد الجلسة', startVoiceSession: 'بدء جلسة صوتية', stopVoiceSession: 'إنهاء الجلسة الصوتية', draftReady: 'المسودة النهائية جاهزة', interrupt: 'مقاطعة', browserRecognition: 'التعرّف في المتصفح', recognitionLanguage: 'لغة التعرّف', chinese: 'الصينية', english: 'الإنجليزية', realtimeModel: 'نموذج الوقت الفعلي', autoSelect: 'اختيار تلقائي', outputVoice: 'صوت الإخراج', context: 'السياق', draftAndRecent: 'المسودة والمحادثة الأخيرة', draftOnly: 'المسودة فقط', off: 'إيقاف', voicePreview: 'معاينة صوت المساعد', playRealtimePreview: 'تشغيل صوت المساعد', stopRealtimePreview: 'إيقاف المعاينة', saving: 'جارٍ الحفظ…', saveSettings: 'حفظ الإعدادات', settingsSaveFailed: 'تعذّر حفظ الإعدادات.', phaseIdle: 'خامل', phaseConnecting: 'جارٍ الاتصال', phaseListening: 'جارٍ الاستماع', phaseThinking: 'جارٍ التفكير', phaseSpeaking: 'جارٍ الرد', phaseEditing: 'جارٍ تعديل المسودة', phaseStopped: 'متوقف', phaseClosed: 'منتهٍ',
})

export const hi = fromEnglish({
  settingsTitle: 'सत्र सहायक', startVoiceSession: 'वॉइस सत्र शुरू करें', stopVoiceSession: 'वॉइस सत्र समाप्त करें', draftReady: 'अंतिम ड्राफ्ट तैयार', interrupt: 'बीच में रोकें', browserRecognition: 'ब्राउज़र पहचान', recognitionLanguage: 'पहचान भाषा', chinese: 'चीनी', english: 'अंग्रेज़ी', realtimeModel: 'रीयलटाइम मॉडल', autoSelect: 'अपने आप चुनें', outputVoice: 'आउटपुट आवाज़', context: 'संदर्भ', draftAndRecent: 'ड्राफ्ट और हाल की बातचीत', draftOnly: 'केवल ड्राफ्ट', off: 'बंद', voicePreview: 'सहायक आवाज़ का पूर्वावलोकन', playRealtimePreview: 'सहायक आवाज़ सुनें', stopRealtimePreview: 'पूर्वावलोकन रोकें', saving: 'सहेजा जा रहा है…', saveSettings: 'सेटिंग सहेजें', settingsSaveFailed: 'सेटिंग सहेजी नहीं जा सकी।', phaseIdle: 'निष्क्रिय', phaseConnecting: 'कनेक्ट हो रहा है', phaseListening: 'सुन रहा है', phaseThinking: 'सोच रहा है', phaseSpeaking: 'उत्तर दे रहा है', phaseEditing: 'ड्राफ्ट संपादित हो रहा है', phaseStopped: 'रुका हुआ', phaseClosed: 'समाप्त',
})

export const dictionaries = {
  en, zh, 'zh-TW': zhTW, ja, ko, es, fr, de, 'pt-BR': ptBR, ru, ar, hi,
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** User-facing copy owned by dsh-session-assistant. */
    sessionAssistant: SessionAssistantLocaleKey
  }
}

export type SessionAssistantTranslate = TranslateNS<typeof NS>

const PHASE_KEYS = {
  idle: 'phaseIdle',
  connecting: 'phaseConnecting',
  listening: 'phaseListening',
  thinking: 'phaseThinking',
  speaking: 'phaseSpeaking',
  editing: 'phaseEditing',
  curating: 'phaseCurating',
  stopped: 'phaseStopped',
  closed: 'phaseClosed',
} as const satisfies Record<string, SessionAssistantLocaleKey>

/** Translate known protocol phases while leaving future provider phases visible. */
export function phaseLabel(t: SessionAssistantTranslate, phase: string): string {
  const key = PHASE_KEYS[phase as keyof typeof PHASE_KEYS]
  return key ? t(key) : phase
}
