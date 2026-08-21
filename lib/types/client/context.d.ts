import type { ContextMode } from '../settings.ts';
interface SessionSnapshotLike {
    readonly chat?: {
        readonly order?: readonly string[];
        readonly nodes?: Map<string, unknown>;
    };
}
export declare function buildBoundedContext(session: SessionSnapshotLike, draft: string, mode: ContextMode): string;
export declare function messageText(session: SessionSnapshotLike, messageId: string): string;
export {};
//# sourceMappingURL=context.d.ts.map