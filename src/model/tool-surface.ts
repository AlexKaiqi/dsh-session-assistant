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
}

export const SUBMIT_TO_AGENT_TOOL = {
  type: 'function', name: 'submit_to_agent', strict: true,
  description: 'Atomically place the exact final request in the main composer and submit it to the primary Agent. Use only after an explicit spoken instruction to submit, send, proceed, or execute.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: { draft: { type: 'string', description: 'The complete exact final text for the primary Agent.' } },
    required: ['draft'],
  },
}

export const END_VOICE_SESSION_TOOL = {
  type: 'function', name: 'end_voice_session', strict: true,
  description: 'End this voice connection without submitting. Use only after an explicit request to end or close it.',
  parameters: { type: 'object', additionalProperties: false, properties: {} },
}

export const ORGANIZE_NOTES_TOOL = {
  type: 'function', name: 'organize_notes', strict: true,
  description: 'Ask the dedicated knowledge-curator agent (a separate text model) to consolidate the current draft, the voice discussion, and recent session activity into the personal knowledge base: it updates the current-work projection and proposes durable knowledge. The call returns immediately; completion is announced separately. Use it when the user asks to organize, save, remember, or turn the discussion into knowledge.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      instruction: { type: 'string', description: 'Optional user intent for the curator, for example "organize the accepted decisions into durable knowledge". Not a draft replacement.' },
    },
    required: [],
  },
}

export const SESSION_ASSISTANT_TOOLS = [UPDATE_WORKING_DRAFT_TOOL, SUBMIT_TO_AGENT_TOOL, END_VOICE_SESSION_TOOL, ORGANIZE_NOTES_TOOL]

export const SESSION_ASSISTANT_TOOL_OUTPUT = {
  update_working_draft: { required: ['draft', 'summary', 'status'] },
  submit_to_agent: { required: ['draft'] },
  end_voice_session: { required: [] },
  organize_notes: {},
}
