import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/Card'
import { CardState } from '../components/CardState'
import { ChartFrame, chartTheme } from '../components/ChartFrame'
import { StatCard } from '../components/StatCard'
import { buildSummary, type OverviewModel } from '../ga/reports/overview'
import { useGa } from '../hooks/useGa'
import { cardQuery, useOverview, useRealtimeTotal } from '../hooks/useReports'
import { formatDuration, formatNumber, formatShortDate, type Delta } from '../lib/format'

const INFO_USERS = '앱을 한 번 이상 연 사람 수예요. 같은 사람이 여러 번 열어도 1명으로 세요.'
const INFO_NEW = '이 기간에 앱을 처음 연 사람 수예요.'
const INFO_AVG = '앱이 화면에 떠 있던 시간을 사람 수로 나눈 값이에요.'
const TREND_TITLE = '날짜별 앱을 쓴 사람'

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
function StatSlot<T>({ query, value, delta, ...header }: StatSlotProps<T>) {
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

function trendLabel(trend: OverviewModel['trend']): string {
  if (trend.length === 0) return `${TREND_TITLE} 선 차트`
  const values = trend.map((t) => t.activeUsers)
  const first = formatShortDate(trend[0].date)
  const last = formatShortDate(trend[trend.length - 1].date)
  return `${TREND_TITLE} 선 차트. ${first}부터 ${last}까지, 가장 많은 날 ${formatNumber(Math.max(...values))}명, 가장 적은 날 ${formatNumber(Math.min(...values))}명이에요.`
}

export function OverviewPage() {
  const { ranges, period, periodLabel } = useGa()
  const overview = useOverview()
  const realtime = useRealtimeTotal()
  const data = overview.data

  const isPreset = period.kind === 'preset'
  // With days = null (custom period) buildSummary ignores the label and says '선택한 기간'.
  const summary =
    data && ranges
      ? buildSummary(isPreset ? `지난 ${ranges.days}일` : periodLabel, isPreset ? ranges.days : null, data.users)
      : null

  return (
    <>
      <h1 className="adm-page__title">한눈에 보기</h1>
      {summary && <p className="adm-page__lead">{summary}</p>}
      <div className="adm-grid adm-grid--stats">
        <StatSlot
          query={overview}
          title="앱을 쓴 사람"
          subtitle="활성 사용자"
          info={INFO_USERS}
          value={(d) => formatNumber(d.users.current)}
          delta={(d) => d.users.delta}
        />
        <StatSlot
          query={overview}
          title="처음 온 사람"
          subtitle="신규 사용자"
          info={INFO_NEW}
          value={(d) => formatNumber(d.newUsers.current)}
          delta={(d) => d.newUsers.delta}
        />
        <StatSlot
          query={overview}
          title="한 사람당 평균 이용 시간"
          subtitle="평균 참여 시간"
          info={INFO_AVG}
          value={(d) => formatDuration(d.avgEngagementSec.current)}
          delta={(d) => d.avgEngagementSec.delta}
        />
        <StatSlot query={realtime} title="지금 접속 중" subtitle="최근 30분" value={formatNumber} />
      </div>
      <Card title={TREND_TITLE} subtitle="활성 사용자" info={INFO_USERS}>
        <CardState
          query={cardQuery(overview)}
          isEmpty={data !== undefined && data.trend.length === 0 && data.users.current === 0}
        >
          {data && (
            <ChartFrame label={trendLabel(data.trend)}>
              <LineChart accessibilityLayer={false} data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} {...chartTheme.grid} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={chartTheme.tick} tickLine={false} />
                <YAxis tickFormatter={formatNumber} tick={chartTheme.tick} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                <Tooltip
                  {...chartTheme.tooltip}
                  labelFormatter={(d) => formatShortDate(String(d))}
                  formatter={(v) => [`${formatNumber(Number(v))}명`, '앱을 쓴 사람']}
                />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  name="앱을 쓴 사람"
                  stroke="var(--adm-accent)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartFrame>
          )}
        </CardState>
      </Card>
    </>
  )
}
