import { useState, type ReactElement } from 'react'
import { detectPlatform, landingView, type LandingView, type Platform } from '../../../../landing/ua'
import { Card } from '../../../components/Card'
import { CheckboxField } from '../../../components/form/CheckboxField'
import { CopyButton } from '../../../components/form/CopyButton'
import { StatusRegion } from '../../../components/form/StatusRegion'
import { TextField } from '../../../components/form/TextField'
import { LANDING_URL } from '../../../lib/siteUrls'
import { useDebouncedPageParam } from '../../../lib/useDebouncedPageParam'
import { usePageParam } from '../../../menu/NavContext'
import { UA_PRESETS, type UaPreset } from './config'
import { isLandingAddress, resolveUaState, touchParam } from './state'
import './ua-tester.css'

const PROMPT = '기기를 고르거나 UA 문자열을 넣어 주세요'
const NOT_HTTPS = 'https://로 시작하는 주소를 넣어 주세요'
/** Stands where an address would be while the landing address cannot be used. */
const BLANK = '—'

const OS_LABEL: Record<Platform['os'], string> = { ios: 'iOS', android: 'Android', other: '그 밖의 기기' }

function verdict({ os, inApp, kakao }: Platform): string {
  return `${OS_LABEL[os]} · ${inApp ? '인앱 브라우저' : '일반 브라우저'}${kakao ? ' · 카카오톡' : ''}`
}

function redirectText(view: LandingView): string {
  if (view.autoRedirect !== null) return 'Play로 바로 보내요'
  return view.noRedirectReason === 'in-app' ? '하지 않아요 (인앱 브라우저라서)' : '하지 않아요 (Android가 아니라서)'
}

/**
 * An address as plain text with its copy button. Never a link: it is an intent:// or kakaotalk://
 * address built from a URL the user typed or was sent. `address` is null while there is none to show.
 */
function Address({ address, name }: { address: string | null; name: string }): ReactElement {
  return (
    <>
      <span className="adm-ua-tester-address">{address ?? BLANK}</span>
      {address !== null && <CopyButton label="복사" name={name} text={address} variant="ghost" />}
    </>
  )
}

/** What the landing does for this platform and address. Every value comes from src/landing/ua.ts. */
function Result({
  platform,
  view,
  addressOk,
}: {
  platform: Platform
  view: LandingView
  addressOk: boolean
}): ReactElement {
  return (
    <dl className="adm-ua-tester-result">
      <div className="adm-ua-tester-row">
        <dt>판정</dt>
        <dd>{verdict(platform)}</dd>
      </div>
      <div className="adm-ua-tester-row">
        <dt>자동 이동</dt>
        <dd>
          <span>{redirectText(view)}</span>
          {view.autoRedirect !== null && (
            <span className="adm-ua-tester-line">
              <Address address={addressOk ? view.autoRedirect : null} name="자동 이동 주소 복사" />
            </span>
          )}
        </dd>
      </div>
      <div className="adm-ua-tester-row">
        <dt>보이는 버튼</dt>
        <dd>
          <ul className="adm-ua-tester-buttons">
            {view.buttons.map((b) => (
              <li key={b.id} className="adm-ua-tester-line">
                <span className="adm-ua-tester-buttons__label">{b.label}</span>
                <Address address={addressOk ? b.href : null} name={`${b.label} 주소 복사`} />
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="adm-ua-tester-row">
        <dt>안내 문구</dt>
        <dd>{view.showInAppHint ? '보여요' : '안 보여요'}</dd>
      </div>
      <div className="adm-ua-tester-row">
        <dt>Play로 넘기는 캠페인</dt>
        <dd className="adm-ua-tester-address">{addressOk ? view.referrer || '없어요' : BLANK}</dd>
      </div>
    </dl>
  )
}

function Tester(): ReactElement {
  const [presetId, setPreset] = usePageParam('preset')
  const [touchValue, setTouch] = usePageParam('touch')
  const [uaText, setUa, flushUa] = useDebouncedPageParam('ua')
  const [urlText, setUrl, flushUrl] = useDebouncedPageParam('url')
  // The user emptied the address field. Without this the default would come back and the field
  // could never be cleared to type another address.
  const [urlCleared, setUrlCleared] = useState(false)

  const state = resolveUaState({ preset: presetId, ua: uaText, touch: touchValue })
  const address = urlText !== '' ? urlText : urlCleared ? '' : LANDING_URL
  const addressOk = isLandingAddress(address)
  const platform = detectPlatform(state.ua, state.touch ? 5 : 0)

  const onPreset = (preset: UaPreset) => {
    setPreset(preset.id)
    setUa('')
    flushUa()
    setTouch(null)
  }

  const onMine = () => {
    setPreset(null)
    setUa(navigator.userAgent)
    flushUa()
    setTouch(touchParam(null, navigator.maxTouchPoints > 0))
  }

  const onUa = (value: string) => {
    // A typed UA releases the preset; the touch value on screen stays as it is.
    setPreset(null)
    setTouch(touchParam(null, state.touch))
    setUa(value)
  }

  const onUrl = (value: string) => {
    setUrlCleared(value === '')
    setUrl(value === LANDING_URL ? '' : value)
  }

  return (
    <div className="adm-ua-tester-layout">
      <Card title="기기와 주소">
        <div className="adm-ua-tester-form">
          <div className="adm-ua-tester-presets" role="group" aria-label="기기">
            {UA_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="adm-ua-tester-preset"
                aria-pressed={state.preset?.id === preset.id}
                onClick={() => onPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="adm-ua-tester-preset" onClick={onMine}>
              내 브라우저
            </button>
          </div>
          <TextField
            label="UA 문자열"
            value={state.ua}
            onChange={onUa}
            onBlur={flushUa}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <CheckboxField
            label="터치를 지원해요"
            checked={state.touch}
            onChange={(checked) => setTouch(touchParam(state.preset, checked))}
          />
          <TextField
            label="랜딩 주소"
            value={address}
            onChange={onUrl}
            onBlur={flushUrl}
            error={addressOk ? null : NOT_HTTPS}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </Card>
      {/* Not a live region: it would be read out on every keystroke. */}
      <Card title="결과">
        {state.ua === '' ? (
          <p className="adm-ua-tester-prompt">{PROMPT}</p>
        ) : (
          <Result platform={platform} view={landingView(platform, address)} addressOk={addressOk} />
        )}
      </Card>
    </div>
  )
}

export function UaTesterPage(): ReactElement {
  return (
    <StatusRegion>
      <Tester />
    </StatusRegion>
  )
}
