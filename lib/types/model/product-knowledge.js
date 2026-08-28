import { readFileSync } from 'node:fs';
/**
 * Canonical, human-readable product introduction.
 * The operational assistant and voice tour both consume this exact file.
 */
export const SESSION_ASSISTANT_INTRODUCTION_PATH = new URL('../INTRODUCTION.md', import.meta.url);
export const SESSION_ASSISTANT_PRODUCT_KNOWLEDGE = readFileSync(SESSION_ASSISTANT_INTRODUCTION_PATH, 'utf8').trim();
