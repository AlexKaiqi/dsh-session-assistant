function blockText(value) {
    if (!Array.isArray(value))
        return '';
    return value.map(entry => entry && typeof entry === 'object' && 'text' in entry ? String(entry.text ?? '') : '').filter(Boolean).join('\n');
}
export function buildBoundedContext(session, draft, mode) {
    if (mode === 'off')
        return '';
    const sections = ['Session Assistant maintains the current composer draft for the primary Agent.'];
    const clippedDraft = draft.trim().slice(0, 2_400);
    if (clippedDraft)
        sections.push(`Current working draft:\n${clippedDraft}`);
    if (mode === 'recent' && session.chat?.order && session.chat.nodes) {
        const recent = [];
        for (const id of [...session.chat.order].reverse()) {
            if (recent.length >= 6)
                break;
            const node = session.chat.nodes.get(id);
            if (!node || node.visibility === 'hidden' || node.data?.status === 'running')
                continue;
            if (node.kind !== 'assistant-step' && node.kind !== 'user' && node.kind !== 'steering')
                continue;
            const text = blockText(node.kind === 'assistant-step' ? node.data?.blocks : node.data?.content).trim().slice(0, 360);
            if (text)
                recent.unshift(`${node.kind === 'assistant-step' ? 'Assistant' : 'User'}: ${text}`);
        }
        if (recent.length)
            sections.push(`Recent visible conversation (terminology only):\n${recent.join('\n')}`);
    }
    return sections.join('\n\n').slice(0, 3_800);
}
export function messageText(session, messageId) {
    const nodes = session.chat?.nodes;
    if (!nodes || !messageId)
        return '';
    for (const value of nodes.values()) {
        const node = value;
        const closing = node.data?.closing;
        if (closing?.finalNode?.messageId === messageId) {
            return blockText(closing.blocks ?? closing.finalNode.blocks).trim().slice(0, 12_000);
        }
        if (node.data?.messageId === messageId)
            return blockText(node.data.blocks ?? node.data.content).trim().slice(0, 12_000);
    }
    return '';
}
