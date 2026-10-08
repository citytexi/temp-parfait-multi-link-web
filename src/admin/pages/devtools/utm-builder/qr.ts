import { encode } from 'uqr'

export const QR_LABEL = '이 링크로 가는 QR 코드'
export const QR_PNG_MIN_PX = 1024

// data[y][x]. The 4-cell quiet zone is already inside size and data.
export type QrMatrix = { size: number; data: boolean[][] }
export type QrRect = { x: number; y: number; w: number; h: number }

export function qrMatrix(text: string): QrMatrix {
  const { size, data } = encode(text, { ecc: 'M', border: 4 })
  return { size, data }
}

export function qrRects(m: QrMatrix, scale: number): QrRect[] {
  const rects: QrRect[] = []
  m.data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push({ x: x * scale, y: y * scale, w: scale, h: scale })
    })
  })
  return rects
}

export function pngScale(size: number): number {
  return Math.max(1, Math.ceil(QR_PNG_MIN_PX / size))
}

export function qrSvg(m: QrMatrix): string {
  const s = m.size
  const cells = qrRects(m, 1)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="1" height="1" fill="#000000"/>`)
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${QR_PNG_MIN_PX}" height="${QR_PNG_MIN_PX}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${QR_LABEL}">` +
    `<rect width="${s}" height="${s}" fill="#ffffff"/>${cells}</svg>`
  )
}

// Draws with fillRect: the admin CSP has no blob: in img-src, so the SVG cannot go through an Image.
export function qrPngBlob(m: QrMatrix): Promise<Blob | null> {
  const scale = pngScale(m.size)
  const px = m.size * scale
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, px, px)
  ctx.fillStyle = '#000000'
  for (const r of qrRects(m, scale)) ctx.fillRect(r.x, r.y, r.w, r.h)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
