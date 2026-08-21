export const UPDATE_WORKING_DRAFT_TOOL = {
    type: 'function', name: 'update_working_draft', strict: true,
    description: 'Apply an intentional change to the editable working draft. Do not call this for discussion that leaves the draft unchanged.',
    parameters: {
        type: 'object', additionalProperties: false,
        properties: {
            draft: { type: 'string', description: 'The complete new working draft.' },
            summary: { type: 'string', description: 'A short change description; not the spoken reply.' },
            status: { type: 'string', enum: ['drafting', 'ready'] },
        },
        required: ['draft', 'summary', 'status'],
    },
};
export const SUBMIT_TO_AGENT_TOOL = {
    type: 'function', name: 'submit_to_agent', strict: true,
    description: 'Atomically place the exact final request in the main composer and submit it to the primary Agent. Use only after an explicit spoken instruction to submit, send, proceed, or execute.',
    parameters: {
        type: 'object', additionalProperties: false,
        properties: { draft: { type: 'string', description: 'The complete exact final text for the primary Agent.' } },
        required: ['draft'],
    },
};
export const END_VOICE_SESSION_TOOL = {
    type: 'function', name: 'end_voice_session', strict: true,
    description: 'End this voice connection without submitting. Use only after an explicit request to end or close it.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
};
export const SESSION_ASSISTANT_TOOLS = [UPDATE_WORKING_DRAFT_TOOL, SUBMIT_TO_AGENT_TOOL, END_VOICE_SESSION_TOOL];
export const SESSION_ASSISTANT_TOOL_OUTPUT = {
    update_working_draft: { required: ['draft', 'summary', 'status'] },
    submit_to_agent: { required: ['draft'] },
    end_voice_session: { required: [] },
};
