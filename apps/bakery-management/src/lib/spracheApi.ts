import { apiClient } from '@bakery/shared/data-access'

export interface VoiceStatus {
  enabled: boolean
  sttProvider?: 'mistral' | 'openai' | 'local' | null
  screens: string[]
  budget: {
    month: string
    limitEuro: number
    spentEuro: number
    remainingEuro: number
    warning: boolean
  }
}

export interface VoiceProposal {
  key: string
  menge: number | null
  heard: string
  unsicher: boolean
  reason: string | null
}

export interface VoiceUnmatched {
  heard: string
  candidates?: string[]
}

export interface VoiceResult {
  transcript: string
  hint?: string
  proposal: VoiceProposal[]
  unmatched: VoiceUnmatched[]
  usage: { costEuro: number; llmUsed: boolean }
}

export async function fetchVoiceStatus() {
  return (await apiClient.get<VoiceStatus>('/api/sprache/status')).data
}

export async function understandVoice(
  date: string,
  clip: Blob,
  signal: AbortSignal
) {
  const query = new URLSearchParams({ screen: 'rest', date })
  const response = await apiClient.postRaw<VoiceResult>(
    `/api/sprache/verstehen?${query}`,
    clip,
    signal,
    // Bis zu 60 s für STT und 12 s für Claude, dazu Zeit für Upload und API.
    { timeoutMs: 80_000 }
  )
  if (!response.data) throw new Error('Leere Antwort.')
  return response.data
}
