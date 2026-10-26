import type { ReactElement } from 'react'
import { formatSeoulTime } from '../../../lib/format'
import { reasonText, type PollDecision } from './pollPolicy'
import type { StreamSnapshot } from './report'
import './event-stream.css'

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
  /** The card below already shows the sentence; saying it here too would read it twice. */
  reasonShownBelow?: boolean
}): ReactElement {
  const { decision, snapshot, paused, onPause, onRefresh, reasonShownBelow = false } = props
  // Before the first snapshot the card's skeleton speaks for normal polling; a pause or a stop is said here.
  const showReason = !reasonShownBelow && (snapshot !== undefined || decision.reason !== 'normal')
  return (
    <div className="adm-event-stream-status">
      <div className="adm-event-stream-status__line">
        <p className="adm-event-stream-status__text">
          {/* Always on the page, empty or not: a status element drawn together with its first sentence may go unread. */}
          <span role="status">{showReason ? reasonText(decision) : ''}</span>
          {snapshot && <span>{`마지막 갱신 ${formatSeoulTime(snapshot.fetchedAt)}`}</span>}
        </p>
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
