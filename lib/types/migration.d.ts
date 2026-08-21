import type { SettingsProvider } from '@deepseek-ai/dsh-settings';
import { type SessionAssistantSettings } from './settings.ts';
export declare const CONFIG_PATH: string;
export declare const LEGACY_CONFIG_PATHS: readonly string[];
export declare function readLegacySettings(candidates?: readonly string[], read?: (path: string, encoding: BufferEncoding) => string): SessionAssistantSettings | undefined;
export declare function migrateLegacySettings(settings: SettingsProvider, candidates?: readonly string[], read?: (path: string, encoding: BufferEncoding) => string): Promise<boolean>;
//# sourceMappingURL=migration.d.ts.map