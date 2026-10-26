import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { pngScale, qrMatrix, qrPngBlob, qrRects, qrSvg, type QrMatrix } from './qr'
import { QrCode } from './QrCode'

const LINK = 'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story'

afterEach(() => { vi.restoreAllMocks() })

describe('qr', () => {
  it('builds a square matrix with a 4-cell quiet zone, the same every time', () => {
    const m = qrMatrix(LINK)
    expect(m.size).toBe(57)
    expect(m.data).toHaveLength(57)
    expect(m.data.every((row) => row.length === 57)).toBe(true)
    expect(m.data.slice(0, 4).flat().some(Boolean)).toBe(false)
    expect(m.data.slice(-4).flat().some(Boolean)).toBe(false)
    expect(m.data.every((row) => !row.slice(0, 4).some(Boolean) && !row.slice(-4).some(Boolean))).toBe(true)
    expect(m.data[4][4]).toBe(true)
    expect(qrMatrix(LINK)).toEqual(m)
    expect(qrMatrix(`${LINK}x`)).not.toEqual(m)
  })
  it('turns dark cells into rects, row by row, scaled', () => {
    const m: QrMatrix = { size: 3, data: [[true, false, false], [false, false, true], [false, true, false]] }
    expect(qrRects(m, 1)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 1, w: 1, h: 1 }, { x: 1, y: 2, w: 1, h: 1 }])
    expect(qrRects(m, 10)[1]).toEqual({ x: 20, y: 10, w: 10, h: 10 })
  })
  it('picks the smallest integer scale that reaches 1024px', () => {
    expect(pngScale(57)).toBe(18)
    expect(pngScale(29)).toBe(36)
    expect(pngScale(1024)).toBe(1)
    expect(pngScale(1025)).toBe(1)
  })
  it('writes a standalone SVG with a white background, the quiet zone and a name', () => {
    const m = qrMatrix(LINK)
    const svg = qrSvg(m)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 57 57"')).toBe(true)
    expect(svg).toContain('role="img" aria-label="이 링크로 가는 QR 코드"')
    expect(svg).toContain('<rect width="57" height="57" fill="#ffffff"/>')
    expect(svg.match(/fill="#000000"/g)).toHaveLength(qrRects(m, 1).length)
    expect(svg).toContain('<rect x="4" y="4" width="1" height="1" fill="#000000"/>')
    expect(svg).not.toMatch(/<rect x="[0-3]" /)
  })
  it('draws the PNG on a canvas at the scaled size', async () => {
    const ctx = { fillStyle: '', fillRect: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    const blob = new Blob(['png'], { type: 'image/png' })
    let canvas: HTMLCanvasElement | undefined
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb) {
      canvas = this
      cb(blob)
    })
    const m = qrMatrix(LINK)
    await expect(qrPngBlob(m)).resolves.toBe(blob)
    expect(canvas?.width).toBe(1026)
    expect(canvas?.height).toBe(1026)
    expect(ctx.fillRect).toHaveBeenCalledTimes(qrRects(m, 1).length + 1)
    expect(ctx.fillRect.mock.calls[0]).toEqual([0, 0, 1026, 1026])
    expect(ctx.fillRect.mock.calls[1]).toEqual([72, 72, 18, 18])
  })
  it('returns null without a 2D context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(qrPngBlob(qrMatrix(LINK))).resolves.toBeNull()
  })
  it('renders the same cells on screen', () => {
    const m = qrMatrix(LINK)
    const { container } = render(createElement(QrCode, { matrix: m }))
    expect(screen.getByRole('img', { name: '이 링크로 가는 QR 코드' })).toBeInTheDocument()
    expect(container.querySelectorAll('rect[fill="#000000"]')).toHaveLength(qrRects(m, 1).length)
  })
})
