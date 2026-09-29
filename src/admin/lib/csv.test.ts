import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('escapes and joins with CRLF after a BOM', () => {
    expect(
      toCsv(['이름', '값'], [['a,b', 'say "hi"'], ['줄\n바꿈', 3]]),
    ).toBe('﻿이름,값\r\n"a,b","say ""hi"""\r\n"줄\n바꿈",3')
  })

  it('neutralizes string cells that a spreadsheet would read as a formula', () => {
    expect(toCsv(['a', 'b', 'c', 'd'], [['=SUM(A1)', '+1', '-2', '@cmd']])).toBe(
      '﻿a,b,c,d\r\n\'=SUM(A1),\'+1,\'-2,\'@cmd',
    )
    expect(toCsv(['a'], [['=HYPERLINK("x","y")']])).toBe('﻿a\r\n"\'=HYPERLINK(""x"",""y"")"')
  })

  it('leaves numbers untouched, including negatives', () => {
    expect(toCsv(['n'], [[-3], [0]])).toBe('﻿n\r\n-3\r\n0')
  })
})

describe('downloadCsv', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a temporary link and revokes the object url after the click task', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadCsv('a.csv', 'x')
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
