import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/Card'
import { CardState } from '../components/CardState'
import { ChartFrame, chartTheme } from '../components/ChartFrame'
import { CsvButton } from '../components/CsvButton'
import { DataTable } from '../components/DataTable'
import { DeltaText } from '../components/Delta'
import type { EventItem } from '../ga/reports/events'
import { useGa } from '../hooks/useGa'
import { cardQuery, useEvents } from '../hooks/useReports'
import { formatNumber } from '../lib/format'

const CHART_TITLE = '가장 많이 일어난 행동 Top 10'
const FOOTNOTE = '사용자가 적은 항목은 개인정보 보호를 위해 GA가 숨길 수 있어요'
const UNREGISTERED = '이름 미등록'

const COLUMNS = [
  { key: 'name', header: '행동' },
  { key: 'count', header: '횟수', align: 'right' as const },
  { key: 'users', header: '한 사람 이상 한 수', align: 'right' as const },
  { key: 'delta', header: '직전 기간 대비', align: 'right' as const },
]

function chartLabel(events: EventItem[]): string {
  const top = events[0]
  if (!top) return `${CHART_TITLE} 막대 차트`
  return `${CHART_TITLE} 막대 차트. 1위는 ${top.label} ${formatNumber(top.count.current)}번이에요.`
}

function EventName({ event }: { event: EventItem }) {
  if (event.registered) return <>{event.label}</>
  return (
    <span className="adm-event">
      {event.name}
      <span className="adm-tag">{UNREGISTERED}</span>
    </span>
  )
}

export function EventsPage() {
  const { ranges } = useGa()
  const events = useEvents()
  const list = events.data ?? []
  const query = cardQuery(events)
  const isEmpty = events.data !== undefined && list.length === 0
  const chartData = list.map((e) => ({ label: e.label, count: e.count.current }))

  return (
    <>
      <h1 className="adm-page__title">많이 한 행동</h1>
      <div className="adm-grid">
        <Card title={CHART_TITLE} subtitle="이벤트">
          <CardState query={query} isEmpty={isEmpty}>
            <ChartFrame label={chartLabel(list)} height={360}>
              <BarChart accessibilityLayer={false} data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} {...chartTheme.grid} />
                <XAxis type="number" tickFormatter={formatNumber} tick={chartTheme.tick} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={120} tick={chartTheme.tick} tickLine={false} axisLine={false} />
                <Tooltip {...chartTheme.tooltip} formatter={(v) => [`${formatNumber(Number(v))}번`, '횟수']} />
                <Bar dataKey="count" name="횟수" fill="var(--adm-accent)" radius={[0, 6, 6, 0]} barSize={16} isAnimationActive={false} />
              </BarChart>
            </ChartFrame>
          </CardState>
        </Card>
        <Card
          title="행동별 횟수"
          subtitle="eventCount · totalUsers"
          action={
            list.length > 0 &&
            ranges && (
              <CsvButton
                filename={`parfait-events-${ranges.current.startDate}_${ranges.current.endDate}.csv`}
                headers={COLUMNS.map((c) => c.header)}
                rows={list.map((e) => [
                  e.registered ? e.label : `${e.name} (${UNREGISTERED})`,
                  e.count.current,
                  e.users,
                  e.count.delta.text,
                ])}
              />
            )
          }
        >
          <CardState query={query} isEmpty={isEmpty}>
            <DataTable
              columns={COLUMNS}
              footnote={FOOTNOTE}
              rows={list.map((e) => ({
                name: <EventName event={e} />,
                count: formatNumber(e.count.current),
                users: formatNumber(e.users),
                delta: <DeltaText delta={e.count.delta} />,
              }))}
            />
          </CardState>
        </Card>
      </div>
    </>
  )
}
