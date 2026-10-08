import type { ReactElement } from 'react'
import { reasonText, type PollDecision } from './pollPolicy'
import type { StreamSnapshot } from './report'
import './event-stream.css'

// Same settings as the `updatedAt` formatter in RealtimePage.
const updatedAt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const num = (n: number | undefined): string => (n === undefined ? '—' : String(n))

function diagnostics(snapshot: StreamSnapshot | undefined): string {
  const q = snapshot?.quota
  const rows = snapshot ? String(snapshot.rows.length) : '—'
  return `진단(개발 모드): 직전 요청 ${num(q?.tokensPerHour?.consumed)}토큰 · 남은 한도 시간 ${num(q?.tokensPerHour?.remaining)} / 프로젝트 ${num(q?.tokensPerProjectPerHour?.remaining)} / 하루 ${num(q?.tokensPerDay?.remaining)} · ${rows}행`
}

export function StreamStatus(props: {
  decision: PollDecision
  snapshot: StreamSnapshot | undefined
  paused: boolean
  onPause(paused: boolean): void
  onRefresh(): void
}): ReactElement {
  const { decision, snapshot, paused, onPause, onRefresh } = props
  return (
    <div className="adm-event-stream-status">
      <div className="adm-event-stream-status__line">
        {snapshot && (
          <p className="adm-event-stream-status__text">
            <span role="status">{reasonText(decision)}</span>
            <span>{`마지막 갱신 ${updatedAt.format(snapshot.fetchedAt)}`}</span>
          </p>
        )}
        <div className="adm-event-stream-status__actions">
          <button type="button" className="adm-button adm-button--secondary" onClick={() => onPause(!paused)}>
            {paused ? '다시 시작' : '일시정지'}
          </button>
          <button type="button" className="adm-button adm-button--ghost" onClick={onRefresh}>
            지금 새로고침
          </button>
        </div>
      </div>
      {import.meta.env.DEV && <p className="adm-page__note">{diagnostics(snapshot)}</p>}
    </div>
  )
}
