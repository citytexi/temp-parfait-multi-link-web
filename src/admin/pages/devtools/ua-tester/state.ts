import { UA_PRESETS, type UaPreset } from './config'

export type UaState = { preset: UaPreset | null; ua: string; touch: boolean }

/**
 * The device the page shows, from its URL params. A preset counts as picked only while there is no
 * UA of its own; a typed UA wins and releases the preset. An unknown preset id is ignored.
 */
export function resolveUaState(p: { preset: string | null; ua: string; touch: string | null }): UaState {
  const known = p.ua === '' ? UA_PRESETS.find((preset) => preset.id === p.preset) : undefined
  const preset = known ?? null
  const baseline = preset ? preset.touch : false
  const touch = p.touch === '1' ? true : p.touch === '0' ? false : baseline
  return { preset, ua: preset ? preset.ua : p.ua, touch }
}

/** The `touch` param for a touch value: null when it equals the preset's (false without one). */
export function touchParam(preset: UaPreset | null, touch: boolean): string | null {
  const baseline = preset ? preset.touch : false
  if (touch === baseline) return null
  return touch ? '1' : '0'
}

const HTTPS = 'https://'

/** Whether the text can stand for the landing's address: `https://` followed by something. */
export function isLandingAddress(url: string): boolean {
  return url.startsWith(HTTPS) && url.length > HTTPS.length
}
