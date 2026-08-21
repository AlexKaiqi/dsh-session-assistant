import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type SettingsScope } from '@deepseek-ai/dsh-settings';
import { type SessionAssistantSettings } from './settings-values.ts';
export * from './settings-values.ts';
export declare const SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export declare const Config: z<SessionAssistantSettings>;
export declare function registerSessionAssistantSettings(ctx: Context, base: Partial<SessionAssistantSettings>): SettingsScope<SessionAssistantSettings>;
//# sourceMappingURL=settings.d.ts.map