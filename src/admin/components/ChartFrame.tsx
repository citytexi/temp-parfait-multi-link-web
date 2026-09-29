import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type ChartFrameProps = {
  /** Plain-Korean summary of what the chart shows, read by screen readers. */
  label: string
  height?: number
  children: ReactElement
}

/** Fixed-height box so charts never shift the layout while they size themselves. */
export function ChartFrame({ label, height = 240, children }: ChartFrameProps) {
  return (
    <div className="adm-chart" role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Shared Recharts styling, all from tokens.css variables. */
export const chartTheme = {
  grid: { stroke: 'var(--adm-border)', strokeDasharray: '3 3' },
  tick: { fill: 'var(--adm-text-3)', fontSize: 12 },
  tooltip: {
    contentStyle: {
      background: 'var(--adm-surface)',
      border: '1px solid var(--adm-border)',
      borderRadius: 12,
      color: 'var(--adm-text-1)',
      fontSize: 14,
    },
    labelStyle: { color: 'var(--adm-text-2)' },
    cursor: { stroke: 'var(--adm-border)', fill: 'var(--adm-surface-muted)' },
  },
  legend: { wrapperStyle: { fontSize: 14, color: 'var(--adm-text-2)' } },
} as const
