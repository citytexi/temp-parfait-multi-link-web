import { expect, it } from 'vitest'
import { UA_PRESETS } from './config'
import { isLandingAddress, resolveUaState, touchParam } from './state'

const KAKAO = UA_PRESETS.find((p) => p.id === 'kakaotalk-android')!
const DESKTOP = UA_PRESETS.find((p) => p.id === 'desktop')!

it('resolves a preset, a custom UA and nothing', () => {
  expect(resolveUaState({ preset: 'kakaotalk-android', ua: '', touch: null })).toEqual({ preset: KAKAO, ua: KAKAO.ua, touch: true })
  expect(resolveUaState({ preset: 'kakaotalk-android', ua: 'X', touch: null })).toEqual({ preset: null, ua: 'X', touch: false })
  expect(resolveUaState({ preset: 'nope', ua: '', touch: null })).toEqual({ preset: null, ua: '', touch: false })
  expect(resolveUaState({ preset: null, ua: '', touch: '1' })).toEqual({ preset: null, ua: '', touch: true })
})

it('lets the touch param override the preset and ignores junk', () => {
  expect(resolveUaState({ preset: 'kakaotalk-android', ua: '', touch: '0' }).touch).toBe(false)
  expect(resolveUaState({ preset: 'desktop', ua: '', touch: '1' }).touch).toBe(true)
  expect(resolveUaState({ preset: 'desktop', ua: '', touch: 'yes' }).touch).toBe(false)
})

it('writes touch only when it differs from the baseline', () => {
  expect(touchParam(KAKAO, true)).toBeNull()
  expect(touchParam(KAKAO, false)).toBe('0')
  expect(touchParam(DESKTOP, true)).toBe('1')
  expect(touchParam(null, false)).toBeNull()
  expect(touchParam(null, true)).toBe('1')
})

it('accepts only https addresses', () => {
  expect(isLandingAddress('https://a.b/')).toBe(true)
  for (const bad of ['', 'https://', 'http://a.b', 'javascript:alert(1)', ' https://a.b', 'a.b']) expect(isLandingAddress(bad)).toBe(false)
})
