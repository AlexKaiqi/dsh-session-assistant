import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { SETTINGS_NAMESPACE, normalizeSettings, type SessionAssistantSettings } from './settings.ts'

export const CONFIG_PATH = `${homedir()}/.dsh/session-assistant.json`
export const LEGACY_CONFIG_PATHS = Object.freeze([
  `${homedir()}/.dsh/talk-to-text.json`,
  `${homedir()}/.dsh/chatvoice.json`,
])

export function readLegacySettings(
  candidates: readonly string[] = [CONFIG_PATH, ...LEGACY_CONFIG_PATHS],
  read: (path: string, encoding: BufferEncoding) => string = readFileSync,
): SessionAssistantSettings | undefined {
  for (const path of candidates) {
    try {
      const parsed: unknown = JSON.parse(read(path, 'utf8'))
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return normalizeSettings(parsed)
    } catch {
      // Missing and malformed files are not migration sources.
    }
  }
  return undefined
}

export async function migrateLegacySettings(
  settings: SettingsProvider,
  candidates?: readonly string[],
  read?: (path: string, encoding: BufferEncoding) => string,
): Promise<boolean> {
  const descriptor = settings.describe().find(item => item.ns === SETTINGS_NAMESPACE)
  if (descriptor === undefined) throw new Error('session-assistant settings namespace is unavailable')
  const user = descriptor.user
  if (user !== null && typeof user === 'object' && !Array.isArray(user) && Object.keys(user).length > 0) return false
  const migrated = readLegacySettings(candidates, read)
  if (migrated === undefined) return false
  await settings.replace(SETTINGS_NAMESPACE, migrated, descriptor.revision)
  return true
}
