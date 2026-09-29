import { describe, expect, it, vi } from 'vitest'
import { downloadCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('escapes and joins with CRLF after a BOM', () => {
    expect(
      toCsv(['이름', '값'], [['a,b', 'say "hi"'], ['줄\n바꿈', 3]]),
    ).toBe('﻿이름,값\r\n"a,b","say ""hi"""\r\n"줄\n바꿈",3')
  })
})

describe('downloadCsv', () => {
  it('clicks a temporary link and revokes the object url', () => {
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadCsv('a.csv', 'x')
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:x')
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
})
