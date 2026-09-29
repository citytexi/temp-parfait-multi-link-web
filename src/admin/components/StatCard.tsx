import { cardQuery } from '../hooks/useReports'
import type { Delta } from '../lib/format'
import { Card, CardHeader } from './Card'
import { CardState } from './CardState'
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

type SlotQuery<T> = { data: T | undefined; isPending: boolean; error: unknown; refetch(): unknown }

type StatSlotProps<T> = {
  query: SlotQuery<T>
  title: string
  subtitle: string
  info?: string
  value(data: T): string
  delta?(data: T): Delta
}

/** A stat card that shows loading or error in place until its value is ready. */
export function StatSlot<T>({ query, value, delta, ...header }: StatSlotProps<T>) {
  if (query.data !== undefined) {
    return <StatCard {...header} value={value(query.data)} delta={delta?.(query.data)} />
  }
  return (
    <Card {...header}>
      <CardState query={cardQuery(query)} isEmpty={false}>
        {null}
      </CardState>
    </Card>
  )
}
