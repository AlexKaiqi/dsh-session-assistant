import { Context, Service } from '@deepseek-ai/cordis';
type JsonValue = null | boolean | number | string | readonly JsonValue[] | {
    readonly [key: string]: JsonValue;
};
export interface ComposedAsrRequest {
    readonly routeId: string;
    readonly operation: string;
    readonly audio: Readonly<Record<string, JsonValue>>;
}
export interface ComposedTtsRequest {
    readonly routeId: string;
    readonly operation: string;
    readonly text: string;
    readonly options?: Readonly<Record<string, JsonValue>>;
}
/** Host boundary for composed voice stages. Provider adapters own all media and wire details. */
export declare class ComposedVoicePipelineHost extends Service {
    constructor(ctx: Context);
    transcribe(request: ComposedAsrRequest, signal: AbortSignal): Promise<{
        text: string;
        output: Readonly<Record<string, JsonValue>>;
    }>;
    synthesize(request: ComposedTtsRequest, signal: AbortSignal): Promise<{
        uri: string;
        output: Readonly<Record<string, JsonValue>>;
    }>;
    private runtime;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        composedVoicePipelineHost: ComposedVoicePipelineHost;
    }
}
export {};
//# sourceMappingURL=composed-pipeline-host.d.ts.map