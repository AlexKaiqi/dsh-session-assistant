export declare const UPDATE_WORKING_DRAFT_TOOL: {
    type: string;
    name: string;
    strict: boolean;
    description: string;
    parameters: {
        type: string;
        additionalProperties: boolean;
        properties: {
            draft: {
                type: string;
                description: string;
            };
            summary: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
            };
        };
        required: string[];
    };
};
export declare const SUBMIT_TO_AGENT_TOOL: {
    type: string;
    name: string;
    strict: boolean;
    description: string;
    parameters: {
        type: string;
        additionalProperties: boolean;
        properties: {
            draft: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const PREPARE_AGENT_HANDOFF_TOOL: {
    type: string;
    name: string;
    strict: boolean;
    description: string;
    parameters: {
        type: string;
        additionalProperties: boolean;
        properties: {
            draft: {
                type: string;
                description: string;
            };
            reason: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const END_VOICE_SESSION_TOOL: {
    type: string;
    name: string;
    strict: boolean;
    description: string;
    parameters: {
        type: string;
        additionalProperties: boolean;
        properties: {};
    };
};
export declare const ORGANIZE_NOTES_TOOL: {
    type: string;
    name: string;
    strict: boolean;
    description: string;
    parameters: {
        type: string;
        additionalProperties: boolean;
        properties: {
            instruction: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
export declare const SESSION_ASSISTANT_TOOLS: {
    type: string;
    name: string;
    strict: boolean;
    description: string;
    parameters: {
        type: string;
        additionalProperties: boolean;
        properties: {};
    };
}[];
export declare const SESSION_ASSISTANT_TOOL_OUTPUT: {
    update_working_draft: {
        required: string[];
    };
    prepare_agent_handoff: {
        required: string[];
    };
    submit_to_agent: {
        required: string[];
    };
    end_voice_session: {
        required: never[];
    };
    organize_notes: {};
};
//# sourceMappingURL=tool-surface.d.ts.map