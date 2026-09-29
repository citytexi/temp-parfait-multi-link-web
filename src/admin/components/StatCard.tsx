import type { Delta } from '../lib/format'
import { CardHeader } from './Card'
import { DeltaText } from './Delta'

type StatCardProps = {
  title: string
  subtitle?: string
  info?: string
  value: string
  delta?: Delta
}

export function StatCard({ value, delta, ...header }: StatCardProps) {
  return (
    <section className="adm-card adm-stat">
      <CardHeader {...header} />
      <p className="adm-stat__value">{value}</p>
      {delta && (
        <p className="adm-stat__delta">
          <DeltaText delta={delta} />
        </p>
      )}
    </section>
  )
}
