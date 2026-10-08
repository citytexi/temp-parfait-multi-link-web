import type { ReactElement } from 'react'
import { QR_LABEL, qrRects, type QrMatrix } from './qr'

export function QrCode({ matrix }: { matrix: QrMatrix }): ReactElement {
  const s = matrix.size
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${s} ${s}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={QR_LABEL}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <rect width={s} height={s} fill="#ffffff" />
      {qrRects(matrix, 1).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={1} height={1} fill="#000000" />
      ))}
    </svg>
  )
}
