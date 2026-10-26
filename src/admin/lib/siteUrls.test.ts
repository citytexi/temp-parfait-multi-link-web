import { describe, expect, it } from 'vitest'
import html from '../../../index.html?raw'
import { LANDING_URL } from './siteUrls'

describe('LANDING_URL', () => {
  it('matches og:url in index.html', () => {
    expect(html.match(/<meta property="og:url" content="([^"]+)">/)?.[1]).toBe(LANDING_URL)
  })

  it('is an https url that ends with a slash', () => {
    expect(LANDING_URL).toMatch(/^https:\/\/.+\/$/)
  })
})
