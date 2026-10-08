import { useMemo, useRef, type ReactElement, type Ref } from 'react'
import { campaignReferrer, playWebUrl } from '../../../../landing/ua'
import { Card } from '../../../components/Card'
import { CopyButton } from '../../../components/form/CopyButton'
import { SelectField } from '../../../components/form/SelectField'
import { StatusRegion, useAnnounce } from '../../../components/form/StatusRegion'
import { TextField } from '../../../components/form/TextField'
import { downloadBlob } from '../../../lib/download'
import { useStored } from '../../../lib/localStore'
import { useDebouncedPageParam } from '../../../lib/useDebouncedPageParam'
import { usePageParam } from '../../../menu/NavContext'
import { CAMPAIGN_EXAMPLE, CHANNELS, RECENT_KEY, type Channel } from './config'
import {
  addRecent,
  buildCampaign,
  findChannel,
  normalizeUtm,
  parseRecent,
  qrFilename,
  reopenParams,
  type RecentLink,
  type UtmValues,
} from './link'
import { qrMatrix, qrPngBlob, qrSvg, type QrMatrix } from './qr'
import { QrCode } from './QrCode'
import { RecentLinks } from './RecentLinks'
import './utm-builder.css'

const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c.id, label: c.label }))
const NO_RECENT: RecentLink[] = []
const PNG_FAILED = 'PNG를 만들지 못했어요. SVG로 받아 주세요.'

/** What useDebouncedPageParam returns: [field value, set it, write it to the URL now]. */
type Param = readonly [string, (value: string) => void, () => void]

/** The values the channel fixes, shown under the select. */
function channelHelp(channel: Channel | undefined): string | undefined {
  if (!channel || channel.medium === null) return undefined
  if (channel.source === null) return `medium ${channel.medium}`
  return `source ${channel.source} · medium ${channel.medium}`
}

function setNow([, set, flush]: Param, value: string): void {
  set(value)
  flush()
}

/** A utm_* field. Its text is normalised on blur and when IME composition ends, never while typing. */
function UtmField({
  label,
  help,
  error,
  param,
  ref,
}: {
  label: string
  help: string
  error?: string
  param: Param
  ref?: Ref<HTMLInputElement>
}): ReactElement {
  const [value, set, flush] = param
  const normalize = (current: string) => {
    const normalized = normalizeUtm(current)
    if (normalized !== current) set(normalized)
  }
  return (
    <TextField
      ref={ref}
      label={label}
      help={help}
      error={error}
      value={value}
      onChange={set}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onBlur={(e) => {
        normalize(e.currentTarget.value)
        flush()
      }}
      onCompositionEnd={(e) => normalize(e.currentTarget.value)}
    />
  )
}

/** The finished link with everything that takes it away: copy, the QR downloads and the Play preview. */
function FinishedLink({ url, values, onTake }: { url: string; values: UtmValues; onTake(): void }): ReactElement {
  const announce = useAnnounce()
  const matrix = useMemo<QrMatrix | null>(() => {
    // qrMatrix throws past QR capacity. A campaign link is far below it; the page must not crash either way.
    try {
      return qrMatrix(url)
    } catch {
      return null
    }
  }, [url])

  const downloadSvg = (m: QrMatrix) => {
    onTake()
    downloadBlob(qrFilename(values, 'svg'), new Blob([qrSvg(m)], { type: 'image/svg+xml' }))
  }
  const downloadPng = async (m: QrMatrix) => {
    onTake()
    const filename = qrFilename(values, 'png')
    const blob = await qrPngBlob(m).catch(() => null)
    if (blob) downloadBlob(filename, blob)
    else announce(PNG_FAILED)
  }

  return (
    <div className="adm-utm-builder-finished">
      <p className="adm-utm-builder-link">{url}</p>
      <CopyButton label="링크 복사" text={url} variant="primary" onCopy={onTake} />
      {matrix && (
        <div className="adm-utm-builder-qr">
          <div className="adm-utm-builder-qr__box">
            <QrCode matrix={matrix} />
          </div>
          <div className="adm-utm-builder-qr__actions">
            <button type="button" className="adm-button adm-button--secondary" onClick={() => void downloadPng(matrix)}>
              PNG 받기
            </button>
            <button type="button" className="adm-button adm-button--secondary" onClick={() => downloadSvg(matrix)}>
              SVG 받기
            </button>
          </div>
        </div>
      )}
      <div className="adm-utm-builder-preview">
        <h3 className="adm-utm-builder-preview__title">Android에서는 이렇게 Play로 넘어가요</h3>
        <p className="adm-utm-builder-link">{playWebUrl(campaignReferrer(url))}</p>
        <p className="adm-utm-builder-text">iOS 설치는 캠페인별로 측정되지 않아요</p>
      </div>
    </div>
  )
}

function Builder(): ReactElement {
  const [chParam, setCh] = usePageParam('ch')
  const source = useDebouncedPageParam('src')
  const medium = useDebouncedPageParam('med')
  const campaign = useDebouncedPageParam('camp')
  const content = useDebouncedPageParam('content')
  const recent = useStored(RECENT_KEY, parseRecent, NO_RECENT)
  const campaignRef = useRef<HTMLInputElement>(null)

  // An unknown ch in the URL is no channel at all.
  const channel = findChannel(chParam)
  const result = buildCampaign({
    channel: channel?.id ?? null,
    source: source[0],
    medium: medium[0],
    campaign: campaign[0],
    content: content[0],
  })
  const errors = result.ok ? {} : result.errors

  const onChannel = (id: string) => {
    const next = findChannel(id)
    setCh(next ? next.id : null)
    // Values the new channel does not take from the user must not linger in the URL.
    if (!next || next.source !== null) setNow(source, '')
    if (!next || next.medium !== null) setNow(medium, '')
  }

  const onReopen = (item: RecentLink) => {
    const p = reopenParams(item)
    setCh(p.ch)
    setNow(source, p.src)
    setNow(medium, p.med)
    setNow(campaign, p.camp)
    setNow(content, p.content)
  }

  const onClear = () => {
    recent.update(() => [])
    // The pressed button goes away with the list.
    campaignRef.current?.focus()
  }

  return (
    <div className="adm-utm-builder-layout">
      <Card title="링크 정보">
        <div className="adm-utm-builder-form">
          <SelectField
            label="어디에 올리나요?"
            placeholder="골라 주세요"
            value={channel?.id ?? ''}
            onChange={onChannel}
            options={CHANNEL_OPTIONS}
            help={channelHelp(channel)}
          />
          {channel && channel.source === null && (
            <UtmField label="출처 (source)" help="예: google, meta" error={errors.source} param={source} />
          )}
          {channel && channel.medium === null && (
            <UtmField label="매체 (medium)" help="예: social, email, cpc" error={errors.medium} param={medium} />
          )}
          <UtmField
            ref={campaignRef}
            label="캠페인 이름"
            help={`예: ${CAMPAIGN_EXAMPLE}`}
            error={errors.campaign}
            param={campaign}
          />
          <UtmField label="소재 구분 (선택)" help="예: story, feed" error={errors.content} param={content} />
        </div>
      </Card>
      <Card title="완성된 링크">
        {/* An invalid link shows only what is missing: nothing to copy or scan. */}
        {!result.ok && <p className="adm-utm-builder-text">{result.hint}</p>}
        {result.ok && channel && (
          <FinishedLink
            url={result.url}
            values={result.values}
            onTake={() =>
              recent.update((list) =>
                addRecent(list, { channel: channel.id, ...result.values, createdAt: new Date().toISOString() }),
              )
            }
          />
        )}
      </Card>
      <div className="adm-utm-builder-layout__wide">
        <RecentLinks items={recent.value} onReopen={onReopen} onClear={onClear} persisted={recent.persisted} />
      </div>
    </div>
  )
}

export function UtmBuilderPage(): ReactElement {
  return (
    <StatusRegion>
      <Builder />
    </StatusRegion>
  )
}
