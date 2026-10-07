import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/Card'
import { CardState } from '../components/CardState'
import { ChartFrame, chartTheme } from '../components/ChartFrame'
import { cardQuery, useRealtime } from '../hooks/useReports'
import { formatNumber } from '../lib/format'

const CHART_TITLE = '1분마다 앱을 쓴 사람'
const OLDEST = 29

const updatedAt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Only the two ends of the axis are labelled. */
function axisTick(minutesAgo: number): string {
  if (minutesAgo === OLDEST) return '30분 전'
  if (minutesAgo === 0) return '지금'
  return ''
}

const minuteLabel = (minutesAgo: number): string => (minutesAgo === 0 ? '지금' : `${minutesAgo}분 전`)

function chartLabel(perMinute: { minutesAgo: number; users: number }[]): string {
  const peak = Math.max(0, ...perMinute.map((m) => m.users))
  return `${CHART_TITLE} 막대 차트. 최근 30분 중 가장 많을 때 ${formatNumber(peak)}명이에요.`
}

export function RealtimePage() {
  const realtime = useRealtime()
  const data = realtime.data

  return (
    <>
      {data && (
        <p className="adm-page__lead adm-realtime__headline">
          최근 30분 동안 <strong className="adm-realtime__count">{formatNumber(data.activeUsers)}</strong>명이 앱을
          쓰고 있어요
        </p>
      )}
      <div className="adm-grid">
        <Card title={CHART_TITLE} subtitle="minutesAgo · activeUsers">
          <CardState query={cardQuery(realtime)} isEmpty={false}>
            {data && (
              <ChartFrame label={chartLabel(data.perMinute)}>
                <BarChart accessibilityLayer={false} data={data.perMinute} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} {...chartTheme.grid} />
                  <XAxis dataKey="minutesAgo" interval={0} tickFormatter={axisTick} tick={chartTheme.tick} tickLine={false} />
                  <YAxis tickFormatter={formatNumber} tick={chartTheme.tick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip
                    {...chartTheme.tooltip}
                    labelFormatter={(m) => minuteLabel(Number(m))}
                    formatter={(v) => [`${formatNumber(Number(v))}명`, '앱을 쓴 사람']}
                  />
                  <Bar dataKey="users" name="앱을 쓴 사람" fill="var(--adm-accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ChartFrame>
            )}
          </CardState>
        </Card>
      </div>
      <p className="adm-page__note">
        <span>1분마다 자동으로 새로고침돼요</span>
        {realtime.dataUpdatedAt > 0 && <span>{`마지막 갱신 ${updatedAt.format(realtime.dataUpdatedAt)}`}</span>}
      </p>
    </>
  )
}
