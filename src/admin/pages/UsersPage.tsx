import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/Card'
import { CardState } from '../components/CardState'
import { ChartFrame, chartTheme } from '../components/ChartFrame'
import { CsvButton } from '../components/CsvButton'
import { DataTable } from '../components/DataTable'
import { DeltaText } from '../components/Delta'
import type { UsersModel } from '../ga/reports/users'
import { useGa } from '../hooks/useGa'
import { cardQuery, useUsers } from '../hooks/useReports'
import { formatNumber, formatShortDate } from '../lib/format'

const TREND_TITLE = '하루·일주일·한 달 동안 앱을 쓴 사람'
const TREND_INFO = '그날 기준으로 최근 1일, 7일, 28일 동안 앱을 쓴 사람 수예요.'
const TABLE_TITLE = '처음 온 사람과 다시 온 사람'

// One accent hue only: series are told apart by line style and the legend, not color alone.
const SERIES = [
  { key: 'dau', name: '하루 (DAU)', color: 'var(--adm-accent)', dash: undefined },
  { key: 'wau', name: '일주일 (WAU)', color: 'var(--adm-accent)', dash: '6 4' },
  { key: 'mau', name: '한 달 (MAU)', color: 'var(--adm-text-3)', dash: '2 4' },
] as const

const COLUMNS = [
  { key: 'label', header: '구분' },
  { key: 'users', header: '사람 수', align: 'right' as const },
  { key: 'delta', header: '직전 기간 대비', align: 'right' as const },
]

function trendLabel(trend: UsersModel['trend']): string {
  const last = trend[trend.length - 1]
  if (!last) return `${TREND_TITLE} 선 차트`
  return `${TREND_TITLE} 선 차트. ${formatShortDate(last.date)} 기준 하루 ${formatNumber(last.dau)}명, 일주일 ${formatNumber(last.wau)}명, 한 달 ${formatNumber(last.mau)}명이에요.`
}

export function UsersPage() {
  const { ranges } = useGa()
  const users = useUsers()
  const data = users.data
  const query = cardQuery(users)
  const rows = data?.newVsReturning ?? []

  return (
    <>
      <div className="adm-grid">
        <Card title={TREND_TITLE} subtitle="DAU · WAU · MAU" info={TREND_INFO}>
          <CardState query={query} isEmpty={data !== undefined && data.trend.length === 0}>
            {data && (
              <ChartFrame label={trendLabel(data.trend)}>
                <LineChart accessibilityLayer={false} data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} {...chartTheme.grid} />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={chartTheme.tick} tickLine={false} />
                  <YAxis tickFormatter={formatNumber} tick={chartTheme.tick} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip
                    {...chartTheme.tooltip}
                    labelFormatter={(d) => formatShortDate(String(d))}
                    formatter={(v) => `${formatNumber(Number(v))}명`}
                  />
                  <Legend {...chartTheme.legend} />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeDasharray={s.dash}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ChartFrame>
            )}
          </CardState>
        </Card>
        <Card
          title={TABLE_TITLE}
          subtitle="신규 · 재방문"
          action={
            rows.length > 0 &&
            ranges && (
              <CsvButton
                filename={`parfait-users-${ranges.current.startDate}_${ranges.current.endDate}.csv`}
                headers={COLUMNS.map((c) => c.header)}
                rows={rows.map((r) => [r.label, r.users.current, r.users.delta.text])}
              />
            )
          }
        >
          <CardState query={query} isEmpty={data !== undefined && rows.length === 0}>
            <DataTable
              columns={COLUMNS}
              rows={rows.map((r) => ({
                label: r.label,
                users: formatNumber(r.users.current),
                delta: <DeltaText delta={r.users.delta} />,
              }))}
            />
          </CardState>
        </Card>
      </div>
    </>
  )
}
