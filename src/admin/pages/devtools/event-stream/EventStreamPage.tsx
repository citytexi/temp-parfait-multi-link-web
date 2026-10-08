import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react'
import { Card } from '../../../components/Card'
import { CardState } from '../../../components/CardState'
import { GaError } from '../../../ga/errors'
import { displayDim } from '../../../ga/reports/common'
import { useNav, usePageParam } from '../../../menu/NavContext'
import { SearchField } from '../shared/SearchField'
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

const announce = (label: string, h: Highlight): string =>
  h.kind === 'new' ? `${label} 새로 들어왔어요` : `${label} ${h.delta}번 더 들어왔어요`

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
  const [announcement, setAnnouncement] = useState('')
  const seen = useRef<ReadonlyMap<string, number>>(new Map())
  useEffect(() => {
    const before = seen.current
    seen.current = new Map([...highlights].map(([name, h]) => [name, h.at]))
    const messages = lines
      .filter((line) => line.watched)
      .flatMap((line) => {
        const h = highlights.get(line.name)
        if (!h || before.get(line.name) === h.at) return []
        return h.kind === 'up' && h.delta <= 0 ? [] : [announce(line.label, h)]
      })
    if (messages.length > 0) setAnnouncement(messages.join(', '))
    // Only a change in the highlights announces; `lines` is read as it is at that moment.
  }, [highlights])

  const clearFilters = () => {
    setQ(null)
    setPlatform(null)
    setVersion(null)
  }

  const quotaOnFirstLoad = error instanceof GaError && error.kind === 'quota'
  const noUnwatched = lines.every((line) => line.watched)

  return (
    <>
      <StreamStatus decision={decision} snapshot={snapshot} paused={paused} onPause={setPaused} onRefresh={refreshNow} />
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
                  {noUnwatched && (
                    <div className="adm-state adm-state--empty adm-event-stream-empty">
                      {snapshot.rows.length === 0 ? (
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
        {announcement}
      </p>
    </>
  )
}
