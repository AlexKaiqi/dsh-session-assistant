/** Locale namespace owned by the Session Assistant client UI. */
export const NS = 'sessionAssistant';
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
    standbyTitle: '长按进入待机，说唤醒词唤醒',
    wakeByVoice: '说唤醒词或点击此处唤醒',
    wakeWord: '待机唤醒词',
    wakeWordPlaceholder: '留空禁用待机唤醒',
    interrupt: '打断',
    readReply: '朗读本条回复',
    stopReading: '停止朗读',
    read: '朗读',
    stop: '停止',
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
    autoReadReplies: '自动朗读新回复',
    readScope: '朗读范围',
    finalReply: '最终回复',
    allReplies: '全部回复',
    readVoice: '朗读音色',
    readRate: '朗读语速',
    voicePreview: '助手音色试听',
    playRealtimePreview: '试听助手音色',
    stopRealtimePreview: '停止助手试听',
    realtimePreviewUsingCurrent: '与所选 Realtime 模型和音色全双工对话试听；可能消耗少量 Provider 额度',
    realtimePreviewConnecting: '正在连接所选 Realtime 音色…',
    realtimePreviewUnavailable: '所选 Realtime 音色当前不可试听',
    previewFailed: '试听失败：',
    previewUnknownError: '未知错误',
    voiceUnavailable: '当前不可用',
    defaultVoice: '默认',
    saving: '保存中…',
    saveSettings: '保存设置',
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
};
/** English dictionary, statically checked against the Chinese key set. */
export const en = {
    settingsTitle: 'Session Assistant',
    startVoiceSession: 'Start voice session',
    stopVoiceSession: 'End voice session',
    draftReady: 'Final draft ready',
    agentRequired: 'Primary Agent required · awaiting confirmation',
    submitted: 'Submitted to the Agent',
    agentAsking: 'The Agent asks: ',
    agentReplied: 'The Agent replied',
    standbyTitle: 'Press and hold to enter standby; the wake word reactivates',
    wakeByVoice: 'Say the wake word or click to wake',
    wakeWord: 'Wake word',
    wakeWordPlaceholder: 'Empty disables standby wake-up',
    interrupt: 'Interrupt',
    readReply: 'Read this reply aloud',
    stopReading: 'Stop reading aloud',
    read: 'Read',
    stop: 'Stop',
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
    autoReadReplies: 'Automatically read new replies',
    readScope: 'Read-aloud scope',
    finalReply: 'Final reply',
    allReplies: 'All replies',
    readVoice: 'Read-aloud voice',
    readRate: 'Read-aloud speed',
    voicePreview: 'Assistant voice preview',
    playRealtimePreview: 'Preview assistant voice',
    stopRealtimePreview: 'Stop assistant preview',
    realtimePreviewUsingCurrent: 'Full-duplex voice preview with the selected Realtime model and voice; may use a small amount of Provider quota',
    realtimePreviewConnecting: 'Connecting to the selected Realtime voice…',
    realtimePreviewUnavailable: 'The selected Realtime voice cannot be previewed',
    previewFailed: 'Preview failed: ',
    previewUnknownError: 'Unknown error',
    voiceUnavailable: 'currently unavailable',
    defaultVoice: 'default',
    saving: 'Saving…',
    saveSettings: 'Save settings',
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
};
function fromEnglish(overrides) {
    return { ...en, ...overrides };
}
/** Main controls are translated for every built-in locale; long diagnostics safely retain English. */
export const zhTW = fromEnglish({
    settingsTitle: '會話助手', startVoiceSession: '開始語音會話', stopVoiceSession: '結束語音會話', draftReady: '最終稿就緒', interrupt: '打斷', readReply: '朗讀本則回覆', stopReading: '停止朗讀', read: '朗讀', stop: '停止', browserRecognition: '瀏覽器辨識', recognitionLanguage: '辨識語言', chinese: '中文', realtimeModel: '即時模型', autoSelect: '自動選擇', outputVoice: '輸出音色', context: '上下文', draftAndRecent: '草稿與最近對話', draftOnly: '僅草稿', off: '關閉', autoReadReplies: '自動朗讀新回覆', readScope: '朗讀範圍', finalReply: '最終回覆', allReplies: '全部回覆', readVoice: '朗讀音色', readRate: '朗讀語速', voicePreview: '助手音色試聽', playRealtimePreview: '試聽助手音色', stopRealtimePreview: '停止助手試聽', voiceUnavailable: '目前不可用', defaultVoice: '預設', saving: '儲存中…', saveSettings: '儲存設定', settingsSaveFailed: '設定儲存失敗。', phaseIdle: '閒置', phaseConnecting: '連線中', phaseListening: '正在聆聽', phaseThinking: '正在思考', phaseSpeaking: '正在回覆', phaseEditing: '正在編輯草稿', phaseStopped: '已停止', phaseClosed: '已結束',
});
export const ja = fromEnglish({
    settingsTitle: 'セッションアシスタント', startVoiceSession: '音声セッションを開始', stopVoiceSession: '音声セッションを終了', draftReady: '最終稿の準備完了', interrupt: '中断', readReply: 'この返信を読み上げる', stopReading: '読み上げを停止', read: '読み上げ', stop: '停止', browserRecognition: 'ブラウザー音声認識', recognitionLanguage: '認識言語', chinese: '中国語', realtimeModel: 'リアルタイムモデル', autoSelect: '自動選択', outputVoice: '出力音声', context: 'コンテキスト', draftAndRecent: '下書きと最近の会話', draftOnly: '下書きのみ', off: 'オフ', autoReadReplies: '新しい返信を自動で読み上げる', readScope: '読み上げ範囲', finalReply: '最終返信', allReplies: 'すべての返信', readVoice: '読み上げ音声', readRate: '読み上げ速度', voicePreview: 'アシスタント音声プレビュー', playRealtimePreview: 'アシスタント音声を試聴', stopRealtimePreview: '試聴を停止', voiceUnavailable: '現在利用不可', defaultVoice: 'デフォルト', saving: '保存中…', saveSettings: '設定を保存', settingsSaveFailed: '設定を保存できませんでした。', phaseIdle: '待機中', phaseConnecting: '接続中', phaseListening: '聞き取り中', phaseThinking: '思考中', phaseSpeaking: '応答中', phaseEditing: '下書きを編集中', phaseStopped: '停止済み', phaseClosed: '終了済み',
});
export const ko = fromEnglish({
    settingsTitle: '세션 도우미', startVoiceSession: '음성 세션 시작', stopVoiceSession: '음성 세션 종료', draftReady: '최종 초안 준비됨', interrupt: '중단', readReply: '이 답변 읽기', stopReading: '읽기 중지', read: '읽기', stop: '중지', browserRecognition: '브라우저 음성 인식', recognitionLanguage: '인식 언어', chinese: '중국어', realtimeModel: '실시간 모델', autoSelect: '자동 선택', outputVoice: '출력 음성', context: '컨텍스트', draftAndRecent: '초안 및 최근 대화', draftOnly: '초안만', off: '끄기', autoReadReplies: '새 답변 자동 읽기', readScope: '읽기 범위', finalReply: '최종 답변', allReplies: '모든 답변', readVoice: '읽기 음성', readRate: '읽기 속도', voicePreview: '도우미 음성 미리듣기', playRealtimePreview: '도우미 음성 재생', stopRealtimePreview: '미리듣기 중지', voiceUnavailable: '현재 사용할 수 없음', defaultVoice: '기본값', saving: '저장 중…', saveSettings: '설정 저장', settingsSaveFailed: '설정을 저장하지 못했습니다.', phaseIdle: '대기', phaseConnecting: '연결 중', phaseListening: '듣는 중', phaseThinking: '생각 중', phaseSpeaking: '응답 중', phaseEditing: '초안 편집 중', phaseStopped: '중지됨', phaseClosed: '종료됨',
});
export const es = fromEnglish({
    settingsTitle: 'Asistente de sesión', startVoiceSession: 'Iniciar sesión de voz', stopVoiceSession: 'Finalizar sesión de voz', draftReady: 'Borrador final listo', interrupt: 'Interrumpir', readReply: 'Leer esta respuesta', stopReading: 'Detener lectura', read: 'Leer', stop: 'Detener', browserRecognition: 'Reconocimiento del navegador', recognitionLanguage: 'Idioma de reconocimiento', chinese: 'Chino', english: 'Inglés', realtimeModel: 'Modelo en tiempo real', autoSelect: 'Selección automática', outputVoice: 'Voz de salida', context: 'Contexto', draftAndRecent: 'Borrador y conversación reciente', draftOnly: 'Solo borrador', off: 'Desactivado', autoReadReplies: 'Leer automáticamente las respuestas nuevas', readScope: 'Alcance de lectura', finalReply: 'Respuesta final', allReplies: 'Todas las respuestas', readVoice: 'Voz de lectura', readRate: 'Velocidad de lectura', voicePreview: 'Vista previa de la voz', playRealtimePreview: 'Probar voz del asistente', stopRealtimePreview: 'Detener prueba', voiceUnavailable: 'no disponible', defaultVoice: 'predeterminada', saving: 'Guardando…', saveSettings: 'Guardar ajustes', settingsSaveFailed: 'No se pudieron guardar los ajustes.', phaseIdle: 'Inactivo', phaseConnecting: 'Conectando', phaseListening: 'Escuchando', phaseThinking: 'Pensando', phaseSpeaking: 'Respondiendo', phaseEditing: 'Editando borrador', phaseStopped: 'Detenido', phaseClosed: 'Finalizado',
});
export const fr = fromEnglish({
    settingsTitle: 'Assistant de session', startVoiceSession: 'Démarrer la session vocale', stopVoiceSession: 'Terminer la session vocale', draftReady: 'Brouillon final prêt', interrupt: 'Interrompre', readReply: 'Lire cette réponse', stopReading: 'Arrêter la lecture', read: 'Lire', stop: 'Arrêter', browserRecognition: 'Reconnaissance du navigateur', recognitionLanguage: 'Langue de reconnaissance', chinese: 'Chinois', english: 'Anglais', realtimeModel: 'Modèle temps réel', autoSelect: 'Sélection automatique', outputVoice: 'Voix de sortie', context: 'Contexte', draftAndRecent: 'Brouillon et conversation récente', draftOnly: 'Brouillon uniquement', off: 'Désactivé', autoReadReplies: 'Lire automatiquement les nouvelles réponses', readScope: 'Portée de lecture', finalReply: 'Réponse finale', allReplies: 'Toutes les réponses', readVoice: 'Voix de lecture', readRate: 'Vitesse de lecture', voicePreview: "Aperçu de la voix de l’assistant", playRealtimePreview: 'Écouter la voix de l’assistant', stopRealtimePreview: "Arrêter l’aperçu", voiceUnavailable: 'indisponible', defaultVoice: 'par défaut', saving: 'Enregistrement…', saveSettings: 'Enregistrer les réglages', settingsSaveFailed: "Échec de l’enregistrement des réglages.", phaseIdle: 'Inactif', phaseConnecting: 'Connexion', phaseListening: 'Écoute', phaseThinking: 'Réflexion', phaseSpeaking: 'Réponse', phaseEditing: 'Modification du brouillon', phaseStopped: 'Arrêté', phaseClosed: 'Terminé',
});
export const de = fromEnglish({
    settingsTitle: 'Sitzungsassistent', startVoiceSession: 'Sprachsitzung starten', stopVoiceSession: 'Sprachsitzung beenden', draftReady: 'Finaler Entwurf bereit', interrupt: 'Unterbrechen', readReply: 'Diese Antwort vorlesen', stopReading: 'Vorlesen stoppen', read: 'Vorlesen', stop: 'Stopp', browserRecognition: 'Browser-Spracherkennung', recognitionLanguage: 'Erkennungssprache', chinese: 'Chinesisch', english: 'Englisch', realtimeModel: 'Echtzeitmodell', autoSelect: 'Automatisch auswählen', outputVoice: 'Ausgabestimme', context: 'Kontext', draftAndRecent: 'Entwurf und letzter Dialog', draftOnly: 'Nur Entwurf', off: 'Aus', autoReadReplies: 'Neue Antworten automatisch vorlesen', readScope: 'Vorlesebereich', finalReply: 'Endgültige Antwort', allReplies: 'Alle Antworten', readVoice: 'Vorlesestimme', readRate: 'Vorlesegeschwindigkeit', voicePreview: 'Assistentenstimme testen', playRealtimePreview: 'Assistentenstimme abspielen', stopRealtimePreview: 'Vorschau stoppen', voiceUnavailable: 'derzeit nicht verfügbar', defaultVoice: 'Standard', saving: 'Speichern…', saveSettings: 'Einstellungen speichern', settingsSaveFailed: 'Einstellungen konnten nicht gespeichert werden.', phaseIdle: 'Bereit', phaseConnecting: 'Verbindung wird hergestellt', phaseListening: 'Hört zu', phaseThinking: 'Denkt nach', phaseSpeaking: 'Antwortet', phaseEditing: 'Entwurf wird bearbeitet', phaseStopped: 'Gestoppt', phaseClosed: 'Beendet',
});
export const ptBR = fromEnglish({
    settingsTitle: 'Assistente de sessão', startVoiceSession: 'Iniciar sessão de voz', stopVoiceSession: 'Encerrar sessão de voz', draftReady: 'Rascunho final pronto', interrupt: 'Interromper', readReply: 'Ler esta resposta', stopReading: 'Parar leitura', read: 'Ler', stop: 'Parar', browserRecognition: 'Reconhecimento do navegador', recognitionLanguage: 'Idioma de reconhecimento', chinese: 'Chinês', english: 'Inglês', realtimeModel: 'Modelo em tempo real', autoSelect: 'Seleção automática', outputVoice: 'Voz de saída', context: 'Contexto', draftAndRecent: 'Rascunho e conversa recente', draftOnly: 'Somente rascunho', off: 'Desativado', autoReadReplies: 'Ler automaticamente novas respostas', readScope: 'Escopo da leitura', finalReply: 'Resposta final', allReplies: 'Todas as respostas', readVoice: 'Voz de leitura', readRate: 'Velocidade da leitura', voicePreview: 'Prévia da voz do assistente', playRealtimePreview: 'Ouvir voz do assistente', stopRealtimePreview: 'Parar prévia', voiceUnavailable: 'indisponível', defaultVoice: 'padrão', saving: 'Salvando…', saveSettings: 'Salvar configurações', settingsSaveFailed: 'Falha ao salvar as configurações.', phaseIdle: 'Inativo', phaseConnecting: 'Conectando', phaseListening: 'Ouvindo', phaseThinking: 'Pensando', phaseSpeaking: 'Respondendo', phaseEditing: 'Editando rascunho', phaseStopped: 'Parado', phaseClosed: 'Encerrado',
});
export const ru = fromEnglish({
    settingsTitle: 'Помощник сеанса', startVoiceSession: 'Начать голосовой сеанс', stopVoiceSession: 'Завершить голосовой сеанс', draftReady: 'Итоговый черновик готов', interrupt: 'Прервать', readReply: 'Прочитать этот ответ', stopReading: 'Остановить чтение', read: 'Читать', stop: 'Стоп', browserRecognition: 'Распознавание в браузере', recognitionLanguage: 'Язык распознавания', chinese: 'Китайский', english: 'Английский', realtimeModel: 'Модель реального времени', autoSelect: 'Автовыбор', outputVoice: 'Выходной голос', context: 'Контекст', draftAndRecent: 'Черновик и недавний диалог', draftOnly: 'Только черновик', off: 'Выкл.', autoReadReplies: 'Автоматически читать новые ответы', readScope: 'Область чтения', finalReply: 'Итоговый ответ', allReplies: 'Все ответы', readVoice: 'Голос чтения', readRate: 'Скорость чтения', voicePreview: 'Прослушать голос помощника', playRealtimePreview: 'Воспроизвести голос помощника', stopRealtimePreview: 'Остановить предпросмотр', voiceUnavailable: 'сейчас недоступно', defaultVoice: 'по умолчанию', saving: 'Сохранение…', saveSettings: 'Сохранить настройки', settingsSaveFailed: 'Не удалось сохранить настройки.', phaseIdle: 'Ожидание', phaseConnecting: 'Подключение', phaseListening: 'Слушаю', phaseThinking: 'Думаю', phaseSpeaking: 'Отвечаю', phaseEditing: 'Редактирую черновик', phaseStopped: 'Остановлено', phaseClosed: 'Завершено',
});
export const ar = fromEnglish({
    settingsTitle: 'مساعد الجلسة', startVoiceSession: 'بدء جلسة صوتية', stopVoiceSession: 'إنهاء الجلسة الصوتية', draftReady: 'المسودة النهائية جاهزة', interrupt: 'مقاطعة', readReply: 'قراءة هذا الرد', stopReading: 'إيقاف القراءة', read: 'قراءة', stop: 'إيقاف', browserRecognition: 'التعرّف في المتصفح', recognitionLanguage: 'لغة التعرّف', chinese: 'الصينية', english: 'الإنجليزية', realtimeModel: 'نموذج الوقت الفعلي', autoSelect: 'اختيار تلقائي', outputVoice: 'صوت الإخراج', context: 'السياق', draftAndRecent: 'المسودة والمحادثة الأخيرة', draftOnly: 'المسودة فقط', off: 'إيقاف', autoReadReplies: 'قراءة الردود الجديدة تلقائيًا', readScope: 'نطاق القراءة', finalReply: 'الرد النهائي', allReplies: 'كل الردود', readVoice: 'صوت القراءة', readRate: 'سرعة القراءة', voicePreview: 'معاينة صوت المساعد', playRealtimePreview: 'تشغيل صوت المساعد', stopRealtimePreview: 'إيقاف المعاينة', voiceUnavailable: 'غير متاح حاليًا', defaultVoice: 'افتراضي', saving: 'جارٍ الحفظ…', saveSettings: 'حفظ الإعدادات', settingsSaveFailed: 'تعذّر حفظ الإعدادات.', phaseIdle: 'خامل', phaseConnecting: 'جارٍ الاتصال', phaseListening: 'جارٍ الاستماع', phaseThinking: 'جارٍ التفكير', phaseSpeaking: 'جارٍ الرد', phaseEditing: 'جارٍ تعديل المسودة', phaseStopped: 'متوقف', phaseClosed: 'منتهٍ',
});
export const hi = fromEnglish({
    settingsTitle: 'सत्र सहायक', startVoiceSession: 'वॉइस सत्र शुरू करें', stopVoiceSession: 'वॉइस सत्र समाप्त करें', draftReady: 'अंतिम ड्राफ्ट तैयार', interrupt: 'बीच में रोकें', readReply: 'यह उत्तर पढ़ें', stopReading: 'पढ़ना रोकें', read: 'पढ़ें', stop: 'रोकें', browserRecognition: 'ब्राउज़र पहचान', recognitionLanguage: 'पहचान भाषा', chinese: 'चीनी', english: 'अंग्रेज़ी', realtimeModel: 'रीयलटाइम मॉडल', autoSelect: 'अपने आप चुनें', outputVoice: 'आउटपुट आवाज़', context: 'संदर्भ', draftAndRecent: 'ड्राफ्ट और हाल की बातचीत', draftOnly: 'केवल ड्राफ्ट', off: 'बंद', autoReadReplies: 'नए उत्तर अपने आप पढ़ें', readScope: 'पढ़ने का दायरा', finalReply: 'अंतिम उत्तर', allReplies: 'सभी उत्तर', readVoice: 'पढ़ने की आवाज़', readRate: 'पढ़ने की गति', voicePreview: 'सहायक आवाज़ का पूर्वावलोकन', playRealtimePreview: 'सहायक आवाज़ सुनें', stopRealtimePreview: 'पूर्वावलोकन रोकें', voiceUnavailable: 'अभी उपलब्ध नहीं', defaultVoice: 'डिफ़ॉल्ट', saving: 'सहेजा जा रहा है…', saveSettings: 'सेटिंग सहेजें', settingsSaveFailed: 'सेटिंग सहेजी नहीं जा सकी।', phaseIdle: 'निष्क्रिय', phaseConnecting: 'कनेक्ट हो रहा है', phaseListening: 'सुन रहा है', phaseThinking: 'सोच रहा है', phaseSpeaking: 'उत्तर दे रहा है', phaseEditing: 'ड्राफ्ट संपादित हो रहा है', phaseStopped: 'रुका हुआ', phaseClosed: 'समाप्त',
});
export const dictionaries = {
    en, zh, 'zh-TW': zhTW, ja, ko, es, fr, de, 'pt-BR': ptBR, ru, ar, hi,
};
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
};
/** Translate known protocol phases while leaving future provider phases visible. */
export function phaseLabel(t, phase) {
    const key = PHASE_KEYS[phase];
    return key ? t(key) : phase;
}
