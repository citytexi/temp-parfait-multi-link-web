import { expect, it } from 'vitest'
import { detectPlatform } from '../../../../landing/ua'
import { UA_PRESETS } from './config'

it('has unique ids and non-empty labels and UAs', () => {
  expect(new Set(UA_PRESETS.map((p) => p.id)).size).toBe(UA_PRESETS.length)
  for (const p of UA_PRESETS) {
    expect(p.label).not.toBe('')
    expect(p.ua).not.toBe('')
  }
})

it('classifies each preset as its label says', () => {
  expect(UA_PRESETS.map((p) => [p.id, detectPlatform(p.ua, p.touch ? 5 : 0)])).toEqual([
    ['iphone-safari', { os: 'ios', inApp: false, kakao: false }],
    ['ipad', { os: 'ios', inApp: false, kakao: false }],
    ['android-chrome', { os: 'android', inApp: false, kakao: false }],
    ['instagram-android', { os: 'android', inApp: true, kakao: false }],
    ['kakaotalk-android', { os: 'android', inApp: true, kakao: true }],
    ['kakaotalk-ios', { os: 'ios', inApp: true, kakao: true }],
    ['naver-android', { os: 'android', inApp: true, kakao: false }],
    ['desktop', { os: 'other', inApp: false, kakao: false }],
  ])
})
