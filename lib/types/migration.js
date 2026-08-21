import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { SETTINGS_NAMESPACE, normalizeSettings } from "./settings.js";
export const CONFIG_PATH = `${homedir()}/.dsh/session-assistant.json`;
export const LEGACY_CONFIG_PATHS = Object.freeze([
    `${homedir()}/.dsh/talk-to-text.json`,
    `${homedir()}/.dsh/chatvoice.json`,
]);
export function readLegacySettings(candidates = [CONFIG_PATH, ...LEGACY_CONFIG_PATHS], read = readFileSync) {
    for (const path of candidates) {
        try {
            const parsed = JSON.parse(read(path, 'utf8'));
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
                return normalizeSettings(parsed);
        }
        catch {
            // Missing and malformed files are not migration sources.
        }
    }
    return undefined;
}
export async function migrateLegacySettings(settings, candidates, read) {
    const descriptor = settings.describe().find(item => item.ns === SETTINGS_NAMESPACE);
    if (descriptor === undefined)
        throw new Error('session-assistant settings namespace is unavailable');
    const user = descriptor.user;
    if (user !== null && typeof user === 'object' && !Array.isArray(user) && Object.keys(user).length > 0)
        return false;
    const migrated = readLegacySettings(candidates, read);
    if (migrated === undefined)
        return false;
    await settings.replace(SETTINGS_NAMESPACE, migrated, descriptor.revision);
    return true;
}
