import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { sessionAssistantRemoteDescriptors } from './remote-contract.ts'

export const TYPERT_REMOTE = {
  package: 'dsh-session-assistant',
  descriptors: sessionAssistantRemoteDescriptors(),
} as unknown as TypertRemoteContribution

export default TYPERT_REMOTE
