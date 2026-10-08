import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react'
import { Card } from '../../../components/Card'
import { CardState } from '../../../components/CardState'
import { GaError } from '../../../ga/errors'
import { displayDim } from '../../../ga/reports/common'
import { useNav, usePageParam } from '../../../menu/NavContext'
import { SearchField } from '../shared/SearchField'
import { HIGHLIGHT_TTL_MS } from './config'
import { reasonText } from './pollPolicy'
import { filterOptions, parseWatch, toLines, toggleWatch, type DimFilter, type Highlight } from './report'
import { StreamStatus } from './StreamStatus'
import { StreamTable } from './StreamTable'
import { useEventStream } from './useEventStream'
import './event-stream.css'

const ALL = ''
const QUOTA_MESSAGE = reasonText({ intervalMs: null, reason: 'quota_exhausted' })

function DimSelect(props: {
  label: string
  value: string | null
  options: readonly string[]
  onChange(value: string | null): void
}): ReactElement {
  const { label, value, options, onChange } = props
  const id = useId()
  return (
    <div className="adm-event-stream-filter">
      <label className="adm-event-stream-filter__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="adm-event-stream-select"
        value={value ?? ALL}
        onChange={(e) => onChange(e.target.value === ALL ? null : e.target.value)}
      >
        <option value={ALL}>전체</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {displayDim(option)}
          </option>
        ))}
      </select>
    </div>
  )
}

type Seen = Pick<Highlight, 'at' | 'delta'>

/** What to say about a highlight that changed since `before`; null when there is nothing new to say. */
function announce(label: string, h: Highlight, before: Seen | undefined): string | null {
  if (before?.at === h.at) return null
  // A change within the highlight's lifetime was added onto it, so only the difference is new.
  const continued = before !== undefined && h.at - before.at < HIGHLIGHT_TTL_MS
  if (!continued && h.kind === 'new') return `${label} 새로 들어왔어요`
  const added = continued ? h.delta - before.delta : h.delta
  return added > 0 ? `${label} ${added}번 더 들어왔어요` : null
}

export function EventStreamPage(): ReactElement {
  const { setMenu } = useNav()
  const [q, setQ] = usePageParam('q')
  const [platformParam, setPlatform] = usePageParam('platform')
  const [versionParam, setVersion] = usePageParam('ver')
  const [watchParam, setWatch] = usePageParam('watch')

  const platform = platformParam || null
  const version = versionParam || null
  const dim = useMemo<DimFilter>(() => ({ platform, version }), [platform, version])
  const watch = useMemo(() => parseWatch(watchParam), [watchParam])

  const { snapshot, highlights, decision, isPending, error, paused, setPaused, refreshNow } = useEventStream(dim)

  const lines = useMemo(() => (snapshot ? toLines(snapshot, dim, q ?? '', watch) : []), [snapshot, dim, q, watch])
  const options = useMemo(
    () =>
      snapshot
        ? filterOptions(snapshot, dim)
        : { platforms: platform === null ? [] : [platform], versions: version === null ? [] : [version] },
    [snapshot, dim, platform, version],
  )

  // Every highlight is marked as seen, so starring an event later does not announce an old change.
  // `seq` gives each announcement its own node: the same sentence twice must be read twice.
  const [announcement, setAnnouncement] = useState({ text: '', seq: 0 })
  const seen = useRef<ReadonlyMap<string, Seen>>(new Map())
  useEffect(() => {
    const before = seen.current
    seen.current = new Map([...highlights].map(([name, h]) => [name, { at: h.at, delta: h.delta }]))
    const messages = lines.flatMap((line) => {
      const h = line.watched ? highlights.get(line.name) : undefined
      const text = h ? announce(line.label, h, before.get(line.name)) : null
      return text === null ? [] : [text]
    })
    if (messages.length > 0) setAnnouncement((prev) => ({ text: messages.join(', '), seq: prev.seq + 1 }))
    // Only a change in the highlights announces; `lines` is read as it is at that moment.
  }, [highlights])

  const clearFilters = () => {
    setQ(null)
    setPlatform(null)
    setVersion(null)
  }

  const quotaOnFirstLoad = error instanceof GaError && error.kind === 'quota'
  const filtered = (q ?? '').trim() !== '' || platform !== null || version !== null
  const nothingArrived = snapshot !== undefined && snapshot.rows.length === 0
  // Without a filter, having starred every event is not an empty result.
  const showEmpty = lines.every((line) => line.watched) && (nothingArrived || filtered)

  return (
    <>
      <StreamStatus
        decision={decision}
        snapshot={snapshot}
        paused={paused}
        onPause={setPaused}
        onRefresh={refreshNow}
        reasonShownBelow={quotaOnFirstLoad && decision.reason === 'quota_exhausted'}
      />
      <div className="adm-event-stream-filters">
        <SearchField label="이벤트 검색" value={q} onCommit={setQ} />
        <DimSelect label="플랫폼" value={platform} options={options.platforms} onChange={setPlatform} />
        <DimSelect label="앱 버전" value={version} options={options.versions} onChange={setVersion} />
      </div>
      <div className="adm-grid">
        <Card title="최근 30분 이벤트">
          {quotaOnFirstLoad ? (
            <div className="adm-state adm-state--error" role="alert">
              <p className="adm-state__text">{QUOTA_MESSAGE}</p>
              <button type="button" className="adm-button adm-button--secondary" onClick={refreshNow}>
                다시 시도
              </button>
            </div>
          ) : (
            <CardState query={{ isPending, error, refetch: refreshNow }} isEmpty={false}>
              {snapshot && (
                <>
                  {lines.length > 0 && (
                    <StreamTable
                      lines={lines}
                      highlights={highlights}
                      onToggleWatch={(name) => setWatch(toggleWatch(watch, name))}
                      onOpenDictionary={(name) => setMenu('event-dictionary', { event: name })}
                    />
                  )}
                  {snapshot.truncated && (
                    <p className="adm-event-stream-truncated">
                      이벤트가 많아서 오래된 기록 일부가 빠졌어요. 30분 횟수가 실제보다 적을 수 있어요.
                    </p>
                  )}
                  {showEmpty && (
                    <div className="adm-state adm-state--empty adm-event-stream-empty">
                      {nothingArrived ? (
                        <p className="adm-state__text">
                          최근 30분 동안 들어온 이벤트가 없어요. 앱에서 이벤트를 보내면 여기에 나타나요.
                        </p>
                      ) : (
                        <>
                          <p className="adm-state__text">조건에 맞는 이벤트가 없어요</p>
                          <button type="button" className="adm-button adm-button--secondary" onClick={clearFilters}>
                            필터 지우기
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardState>
          )}
        </Card>
      </div>
      <p className="adm-page__note">여러 사람이 함께 쓰면 이벤트가 섞여 보여요. 플랫폼과 앱 버전으로 좁혀 보세요.</p>
      <p className="adm-sr-only" aria-live="polite">
        {announcement.seq > 0 && <span key={announcement.seq}>{announcement.text}</span>}
      </p>
    </>
  )
}
