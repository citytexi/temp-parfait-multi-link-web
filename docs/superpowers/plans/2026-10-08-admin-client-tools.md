# 어드민 클라이언트 도구 (묶음 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민에 API 없이 브라우저만으로 도는 도구 네 개(캠페인 링크 만들기, 랜딩 분기 테스트, 바로가기, 릴리즈 체크리스트)를 넣고, 랜딩이 UTM을 Play 주소의 `referrer`로 넘기게 한다.

**Architecture:** 랜딩의 판정과 주소 조립은 `src/landing/ua.ts`의 순수 함수 한 벌에 두고, 랜딩 화면·어드민 화면·인라인 스크립트 테스트가 그것을 함께 쓴다. 어드민 쪽은 공용 코드(`lib/localStore`, `lib/useDebouncedPageParam`, `components/form/`)를 먼저 만들고, 화면마다 규칙을 React를 모르는 순수 모듈로 둔 뒤 페이지가 URL 상태와 컴포넌트를 조립한다. 네 화면은 `src/admin/pages/<그룹>/<메뉴 id>/` 폴더이고 레지스트리가 `*.menu.ts`를 알아서 모은다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, Vitest 5, @testing-library/react, jsdom, `lucide-react`, `uqr@0.1.3`(새로 추가), npm

**Spec:** `docs/superpowers/specs/2026-10-08-admin-client-tools-design.md`. 화면 문구, 표, 그림은 스펙이 원본이다. 이 문서는 파일, 이름, 시그니처, 테스트, 그리고 스펙이 비워 둔 결정을 정한다. Task를 맡으면 Task 맨 위에 적힌 스펙 장을 먼저 읽는다.

## Global Constraints

- 아래 7개 파일은 고치지 않는다: `src/admin/components/Shell.tsx`, `src/admin/components/SideMenu.tsx`, `src/admin/menu/registry.ts`, `src/admin/lib/urlState.ts`, `src/admin/styles/admin.css`, `vite.config.ts`, `src/admin/config.ts`.
- 이것도 고치지 않는다: `src/admin/menu/NavContext.tsx`, `src/admin/ga/*`, `src/admin/lib/csv.ts`, `src/admin/menu/collapsed.ts`. `src/admin/pages/devtools/shared/`, `event-stream/`, `event-dictionary/`에는 아무것도 만들지 않는다(병렬로 진행 중인 묶음 2의 것이다).
- 의존성은 `uqr` 하나만 더한다(Task 9). CSP 조각(`*.csp.json`)은 만들지 않는다.
- `localStorage`는 `src/admin/lib/localStore.ts`를 거쳐서만 쓴다. 키는 셋뿐이다: `parfait-admin:utm-builder:recent`, `parfait-admin:link-hub:personal`, `parfait-admin:release-checklist:releases`. UI 상태만 넣는다.
- 메뉴: `utm-builder`(devtools, 110), `ua-tester`(devtools, 120), `link-hub`(ops, 110), `release-checklist`(ops, 120). 넷 다 `usesPeriod`, `usesGa`를 쓰지 않는다(`false`).
- 페이지 모듈의 최상위에는 부수 효과가 없다. 저장소 읽기와 쓰기, 리스너, 타이머는 컴포넌트와 훅 안에서 시작하고 떠날 때 정리한다.
- 어드민은 `StrictMode`로 돈다. effect가 두 번 불려도 리스너와 타이머가 한 벌만 남아야 한다.
- URL 상태는 `usePageParam`으로, 글자를 치는 칸은 `useDebouncedPageParam`(Task 5)으로 쓴다. 쓰는 key: `ch`, `src`, `med`, `camp`, `content`, `preset`, `ua`, `touch`, `url`, `release`, `share`.
- `src/landing/ua.ts`는 DOM을 만지지 않는 순수 함수와 상수만 둔다. 어드민이 import하기 때문이다.
- CSS 클래스 접두사: `adm-utm-builder-`, `adm-ua-tester-`, `adm-link-hub-`, `adm-release-checklist-`, 공용은 `adm-field`, `adm-confirm`, `adm-copy`, `adm-status-region`. 기존 `adm-button`(`--primary`, `--secondary`, `--ghost`), `adm-card`, `adm-grid`, `adm-tag`, `adm-page__note`, `adm-sr-only`, `adm-state`는 그대로 쓴다.
- 색은 `src/admin/styles/tokens.css`의 토큰만 쓴다. 예외는 QR 하나다: 테마와 상관없이 `#ffffff` 바탕에 `#000000` 점(스펙 §2).
- 데스크톱 기준 폭 `960px`. 누르는 영역은 `--adm-hit`(44px) 이상. 입력 글자 크기는 `--adm-fs-md`(16px) 이상. 애니메이션은 `prefers-reduced-motion: reduce`에서 끈다.
- 화면 문구는 해요체. 스펙에 따옴표, 표, 그림으로 적힌 문구는 글자 그대로 쓴다. 이 문서가 정한 문구도 글자 그대로 쓴다.
- `tsconfig.app.json`에 전역 `JSX` 타입이 없다. 반환 타입은 `react`의 `ReactElement`를 쓴다. `src`에는 `vite/client` 타입만 있어서 `node:*`를 import하면 typecheck가 실패한다.
- 커밋 메시지는 Conventional Commits. 끝에는 구현자 자신의 세션이 attribution 안내로 준 `Co-Authored-By:` 줄을 그대로 붙인다(실제로 쓴 모델 이름이 들어 있다).
- 각 Task 끝에서 `npm run typecheck`와 `npm test`가 통과해야 한다. 시작 기준은 typecheck 통과, 테스트 314개 통과다. push와 PR은 하지 않는다.

## Review Focus

1. 저장소가 막혀 있거나 가득 참(사파리 개인정보 보호 모드, 용량 초과) → 세 화면 모두 추가·체크가 화면에서는 그대로 되고 "이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요."가 보인다. 예외가 없다. (Task 4, Task 10, Task 13, Task 15)
2. 글자를 치고 300ms 안에 다른 메뉴로 가거나, `StrictMode`로 두 번 마운트됨 → 남은 타이머가 새 메뉴의 URL에 파라미터를 쓰지 않고, 리스너와 타이머가 한 벌만 남는다. (Task 4, Task 5, Task 7)
3. 저장된 값이 손으로 고쳐졌거나 옛 모양임(`checked`에 `__proto__`, 41자 이름, 모르는 플랫폼, 형식이 틀린 UTM 값) → 틀린 항목만 버리고 나머지는 보인다. 크래시가 없다. (Task 8, Task 14)
4. UTM 칸에 붙여넣은 값(앞뒤 공백, 대문자, 공백 여러 칸, 탭, 줄바꿈) → 칸에서 포커스를 빼지 않아도 링크와 복사한 글자는 정규화한 값이다. (Task 8, Task 10)
5. 릴리즈 이름에 한글이나 이모지가 있음(`1.5.0 핫픽스 🍨`) → 공유 링크가 예외 없이 만들어지고, `URLSearchParams`를 거쳐 풀어도 같은 이름이 나온다. (Task 14, Task 16)

---

## File Structure

```
index.html                                   # 수정: 인라인 스크립트 (Task 3)
src/landing/
├─ ua.ts                                     # 수정: 캠페인, Play 주소 (Task 1), landingView (Task 2)
├─ ua.test.ts                                # 수정 (Task 1, 2)
├─ __fixtures__/campaignUrls.ts              # 새로: 주소와 기대 referrer (Task 1. Task 3도 쓴다)
├─ Landing.tsx, Landing.test.tsx             # 수정 (Task 2)
└─ inlineScript.test.ts                      # 새로 (Task 3)
src/admin/lib/
├─ localStore.ts (+test)                     # 새로 (Task 4)
├─ useDebouncedPageParam.ts (+test)          # 새로 (Task 5)
├─ download.ts (+test), siteUrls.ts (+test)  # 새로 (Task 5)
src/admin/components/form/
├─ StatusRegion.tsx, TextField.tsx, SelectField.tsx, CheckboxField.tsx, form.css, fields.test.tsx   # 새로 (Task 6)
└─ CopyButton.tsx, ConfirmButton.tsx, buttons.test.tsx                                              # 새로 (Task 7)
src/admin/pages/devtools/utm-builder/
├─ config.ts, link.ts, link.test.ts          # 새로: 채널, 정규화, 링크, 최근 기록 (Task 8)
├─ qr.ts, qr.test.ts, QrCode.tsx             # 새로 (Task 9)
└─ UtmBuilderPage.tsx, RecentLinks.tsx, UtmBuilderPage.menu.ts, UtmBuilderPage.test.tsx, utm-builder.css   # 새로 (Task 10)
src/admin/pages/devtools/ua-tester/
├─ config.ts, config.test.ts                 # 새로: UA 프리셋 (Task 3)
├─ state.ts, state.test.ts                   # 새로: URL 상태 풀기 (Task 11)
└─ UaTesterPage.tsx, UaTesterPage.menu.ts, UaTesterPage.test.tsx, ua-tester.css   # 새로 (Task 11)
src/admin/pages/ops/link-hub/
├─ links.ts, personal.ts, linkHub.test.ts    # 새로 (Task 12)
└─ LinkHubPage.tsx, LinkHubPage.menu.ts, LinkHubPage.test.tsx, link-hub.css       # 새로 (Task 13)
src/admin/pages/ops/release-checklist/
├─ template.ts, release.ts, share.ts, checklist.test.ts     # 새로 (Task 14)
├─ ReleaseChecklistPage.tsx, ReleaseChecklistPage.menu.ts, ReleaseChecklistPage.test.tsx, release-checklist.css   # 새로 (Task 15)
└─ SharedRelease.tsx, SharedRelease.test.tsx                # 새로 (Task 16)
package.json, package-lock.json              # 수정: uqr (Task 9)
README.md                                    # 수정 (Task 17)
```

UA 프리셋 데이터(`ua-tester/config.ts`)는 Task 3에서 만든다. 인라인 스크립트 테스트가 이 데이터를 쓰는데(스펙 §3), 페이지(Task 11)를 기다리면 랜딩 쪽 Task가 어드민 Task에 묶이기 때문이다. `*.menu.ts`가 없는 동안에는 레지스트리가 이 폴더를 보지 않는다.

Task 1~3은 랜딩, 4~7은 공용 코드, 8~10은 캠페인 링크, 11은 분기 테스트, 12~13은 바로가기, 14~16은 체크리스트다. 15의 "열기" 링크 테스트가 `ua-tester` 메뉴를 쓰므로 11은 15보다 먼저 한다.

테스트에서 지킬 것:

- 가짜 타이머를 쓰는 테스트는 `fireEvent`와 아래 `advance()`를 쓴다. `userEvent`는 쓰지 않는다. 가짜 `setTimeout` 아래에서 끝나지 않고, `userEvent.setup()`은 `navigator.clipboard`를 자기 것으로 바꾼다.
- `fireEvent.click`은 포커스를 옮기지 않는다. 포커스를 확인하는 테스트는 먼저 `.focus()`를 부른다.
- jsdom에는 `navigator.clipboard`가 없다. `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })`로 넣고 `afterEach`에서 `Reflect.deleteProperty(navigator, 'clipboard')`로 지운다.
- 저장소는 `beforeEach(() => localStorage.clear())`. 저장된 값은 `localStorage.setItem(KEY, JSON.stringify({ v: 1, items }))`로 넣는다. 쓰기 실패는 `vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })`로 만든다.
- 타이머나 spy를 쓰는 테스트 파일에는 `afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })`를 둔다. `src/test/setup.ts`는 `cleanup`만 한다. 두지 않으면 던지는 `setItem` spy나 가짜 타이머가 같은 파일의 다음 테스트로 샌다.
- 페이지 테스트는 아래 틀을 쓴다. 이 묶음의 페이지는 `QueryClientProvider`와 `useGa`가 필요 없다.

```tsx
const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'utm-builder', 'ua-tester', 'link-hub', 'release-checklist'].includes(id),
  usesPeriod: () => false,
}
function renderAt(search: string, page: ReactElement) {
  window.history.replaceState(null, '', `/admin/${search}`)
  return render(<NavProvider lookup={lookup}>{page}</NavProvider>)
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
```

---

### Task 1: 랜딩의 캠페인 referrer와 Play 주소

스펙 §3의 "바꾸는 것"(`campaignReferrer`의 알고리즘, 주소 조립)을 읽는다.

**Files:**
- Modify: `src/landing/ua.ts`, `src/landing/ua.test.ts`
- Create: `src/landing/__fixtures__/campaignUrls.ts`

**Interfaces:**
- Produces:

```ts
// ua.ts
export const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const
export function campaignReferrer(pageUrl: string): string     // 넘길 것이 없으면 ''
export function playWebUrl(referrer?: string): string         // referrer가 없거나 ''이면 지금의 PLAY_WEB_URL
export function playIntentUrl(referrer?: string): string      // referrer가 없거나 ''이면 지금과 같은 문자열
export const PLAY_WEB_URL: string                             // playWebUrl()
// __fixtures__/campaignUrls.ts
export const BASE = 'https://citytexi.github.io/temp-parfait-multi-link-web/'
export const CAMPAIGN_CASES: readonly (readonly [name: string, pageUrl: string, referrer: string])[]
```

정한 것:
- 알고리즘의 3단계(`=` 없는 조각을 버림)는 5단계("첫 번째 조각만 본다")보다 먼저다. `?utm_source&utm_source=s`에서 `=` 없는 조각은 key가 되기 전에 버려지므로 결과는 `utm_source=s`다.
- `URL`, `URLSearchParams`, `decodeURIComponent`를 쓰지 않는다. `split`과 `indexOf`만 쓴다. Task 3이 같은 절차를 ES5로 옮긴다.
- `ua.ts` 맨 위에 주석을 단다: 이 파일은 DOM을 만지지 않는 순수 함수와 상수만 두며 어드민도 import한다.

- [ ] **Step 1: fixture를 만든다** (`__fixtures__/campaignUrls.ts`)

```ts
export const BASE = 'https://citytexi.github.io/temp-parfait-multi-link-web/'
const A100 = 'a'.repeat(100)
const ALL = 'utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story&utm_term=kw&utm_id=abc.1'

export const CAMPAIGN_CASES: readonly (readonly [name: string, pageUrl: string, referrer: string])[] = [
  ['no query', BASE, ''],
  ['all six keys', `${BASE}?${ALL}`, ALL],
  ['keys out of order with a foreign key', `${BASE}?utm_campaign=c&x=1&utm_source=s`, 'utm_source=s&utm_campaign=c'],
  ['no source', `${BASE}?utm_medium=social&utm_campaign=c`, ''],
  ['a disallowed character', `${BASE}?utm_source=s&utm_campaign=a;b`, 'utm_source=s'],
  ['a 100-character value', `${BASE}?utm_source=s&utm_campaign=${A100}`, `utm_source=s&utm_campaign=${A100}`],
  ['a 101-character value', `${BASE}?utm_source=s&utm_campaign=${A100}a`, 'utm_source=s'],
  ['a repeated key whose first piece is bad', `${BASE}?utm_source=s&utm_campaign=a%2Db&utm_campaign=ok`, 'utm_source=s'],
  ['a repeated source whose first piece is bad', `${BASE}?utm_source=a%20b&utm_source=good`, ''],
  ['a repeated key whose first piece is good', `${BASE}?utm_source=first&utm_source=second`, 'utm_source=first'],
  ['a fragment after the query', `${BASE}?utm_source=s#utm_campaign=c`, 'utm_source=s'],
  ['a query inside the fragment', `${BASE}#?utm_source=s`, ''],
  ['a percent-encoded value', `${BASE}?utm_source=s&utm_campaign=a%2Db`, 'utm_source=s'],
  ['a plus sign', `${BASE}?utm_source=a+b&utm_campaign=c`, ''],
  ['a percent-encoded key', `${BASE}?utm%5Fsource=x&utm_campaign=c`, ''],
  ['an upper-case key', `${BASE}?UTM_SOURCE=x&utm_campaign=c`, ''],
  ['an empty source', `${BASE}?utm_source=&utm_campaign=c`, ''],
  ['an empty optional value', `${BASE}?utm_source=s&utm_campaign=`, 'utm_source=s'],
  ['a key without =', `${BASE}?utm_source&utm_campaign=c`, ''],
  ['a key without = before a good piece', `${BASE}?utm_source&utm_source=s`, 'utm_source=s'],
  ['a broken percent sequence', `${BASE}?utm_source=s&utm_campaign=%E0%`, 'utm_source=s'],
  ['no question mark', 'https://x/y&utm_source=s', ''],
  ['a second = in the value', `${BASE}?utm_source=a=b`, ''],
  ['a second ? in the value', `${BASE}?utm_source=s?utm_campaign=c`, ''],
  ['every allowed punctuation mark', `${BASE}?utm_source=A.b_c~d-e`, 'utm_source=A.b_c~d-e'],
  ['empty pieces', `${BASE}?&&utm_source=s&`, 'utm_source=s'],
  ['object-prototype keys', `${BASE}?constructor=x&__proto__=y&utm_source=s`, 'utm_source=s'],
]
```

- [ ] **Step 2: 실패하는 테스트를 더한다** (`ua.test.ts`. 기존 테스트는 그대로 둔다)

```ts
const R = 'utm_source=instagram&utm_medium=social&utm_campaign=x'

describe('campaignReferrer', () => {
  it.each(CAMPAIGN_CASES)('%s', (_name, pageUrl, referrer) => {
    expect(campaignReferrer(pageUrl)).toBe(referrer)
  })
})
describe('play urls with a referrer', () => {
  it('keeps the old strings without a referrer', () => {
    expect(PLAY_WEB_URL).toBe('https://play.google.com/store/apps/details?id=com.teamyg.parfait')
    expect(playWebUrl()).toBe(PLAY_WEB_URL)
    expect(playWebUrl('')).toBe(PLAY_WEB_URL)
    expect(playIntentUrl('')).toBe(playIntentUrl())
    expect(playIntentUrl()).toBe(
      'intent://details?id=com.teamyg.parfait#Intent;scheme=market;package=com.android.vending;' +
        'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.teamyg.parfait;end',
    )
  })
  it('adds the encoded referrer to the web url', () => {
    expect(playWebUrl(R)).toBe(
      'https://play.google.com/store/apps/details?id=com.teamyg.parfait&referrer=utm_source%3Dinstagram%26utm_medium%3Dsocial%26utm_campaign%3Dx',
    )
  })
  it('adds the referrer to the intent and to its fallback url', () => {
    expect(playIntentUrl(R)).toBe(
      'intent://details?id=com.teamyg.parfait&referrer=utm_source%3Dinstagram%26utm_medium%3Dsocial%26utm_campaign%3Dx' +
        '#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=' +
        'https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.teamyg.parfait%26referrer%3Dutm_source%253Dinstagram%2526utm_medium%253Dsocial%2526utm_campaign%253Dx;end',
    )
  })
})
```

- [ ] **Step 3: 실패를 확인한다.** Run: `npx vitest run src/landing/ua.test.ts` Expected: FAIL (`campaignReferrer` 없음)
- [ ] **Step 4: `ua.ts`를 Interfaces대로 고친다.** 값 검사는 `/^[A-Za-z0-9._~-]{1,100}$/`.
- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS. `Landing.test.tsx`가 그대로 통과한다.
- [ ] **Step 6: Commit** — `feat(landing): carry campaign params to the Play links as a referrer`

---

### Task 2: `landingView`와 `Landing.tsx`

스펙 §3의 "랜딩 화면의 판정을 한 곳으로"(타입, 표)를 읽는다.

**Files:**
- Modify: `src/landing/ua.ts`, `src/landing/ua.test.ts`, `src/landing/Landing.tsx`, `src/landing/Landing.test.tsx`

**Interfaces:**
- Consumes: `campaignReferrer`, `playWebUrl`, `playIntentUrl` (Task 1), 기존 `externalBrowserUrl`, `APP_STORE_URL`, `Platform`
- Produces: 스펙 §3의 `LandingButton`, `LandingView` 타입 그대로, 그리고

```ts
export function landingView(platform: Platform, pageUrl: string): LandingView
```

정한 것:
- 버튼 글자: `store`는 `Google Play에서 다운로드`, `appstore`는 `App Store에서 다운로드`, `external`은 `외부 브라우저로 열기`.
- `referrer`는 Play 링크가 있는 경우(`android`, `other`)에만 `campaignReferrer(pageUrl)`이고 `ios`는 `''`다. iOS에서는 Play로 넘기는 것이 없다.
- `Landing.tsx`는 `landingView(platform, pageUrl)`의 결과만 그린다. `buttons`를 순서대로 `<a id={b.id} className={b.variant === 'primary' ? 'btn primary' : 'btn'} href={b.href}>`로, `showInAppHint`면 기존 `#inapp-hint` 문단을 그린다. Props, 나머지 마크업, `main.tsx`는 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트를 더한다**

```ts
// ua.test.ts — Task 1이 같은 파일에 `R`을 두었으므로 이름을 달리한다
const UK = 'https://x/y?utm_source=kakaotalk&utm_medium=social&utm_campaign=c#f'
const RK = 'utm_source=kakaotalk&utm_medium=social&utm_campaign=c'
const store = (href: string) => ({ id: 'store', label: 'Google Play에서 다운로드', href, variant: 'primary' })
const appstore = { id: 'appstore', label: 'App Store에서 다운로드', href: APP_STORE_URL, variant: 'primary' }

describe('landingView', () => {
  it('sends a plain Android browser to the intent with the referrer', () => {
    expect(landingView({ os: 'android', inApp: false, kakao: false }, UK)).toEqual({
      autoRedirect: playIntentUrl(RK), noRedirectReason: null,
      buttons: [store(playIntentUrl(RK))], showInAppHint: false, referrer: RK,
    })
  })
  it('keeps an Android in-app browser on the page with both buttons and the hint', () => {
    expect(landingView({ os: 'android', inApp: true, kakao: true }, UK)).toEqual({
      autoRedirect: null, noRedirectReason: 'in-app',
      buttons: [
        store(playIntentUrl(RK)),
        { id: 'external', label: '외부 브라우저로 열기', href: externalBrowserUrl(UK, true), variant: 'secondary' },
      ],
      showInAppHint: true, referrer: RK,
    })
  })
  it('shows only the App Store on iOS, in-app or not, and passes nothing to Play', () => {
    for (const inApp of [false, true]) {
      expect(landingView({ os: 'ios', inApp, kakao: inApp }, UK)).toEqual({
        autoRedirect: null, noRedirectReason: 'not-android', buttons: [appstore], showInAppHint: false, referrer: '',
      })
    }
  })
  it('shows both stores elsewhere, with the referrer on the Play web url', () => {
    expect(landingView({ os: 'other', inApp: false, kakao: false }, UK)).toEqual({
      autoRedirect: null, noRedirectReason: 'not-android',
      buttons: [store(playWebUrl(RK)), appstore], showInAppHint: false, referrer: RK,
    })
  })
  it('is unchanged without campaign params', () => {
    const v = landingView({ os: 'android', inApp: false, kakao: false }, 'https://x/y')
    expect(v.autoRedirect).toBe(playIntentUrl())
    expect(v.referrer).toBe('')
    expect(landingView({ os: 'other', inApp: false, kakao: false }, 'https://x/y').buttons[0].href).toBe(PLAY_WEB_URL)
  })
})
```

`Landing.test.tsx`에는 두 가지를 더한다(`pageUrl`을 받는 `view` 변형을 쓴다): Android 인앱에서 `pageUrl`이 `UK`면 `Google Play에서 다운로드`의 `href`가 `playIntentUrl(RK)`이고 `외부 브라우저로 열기`의 `href`가 `externalBrowserUrl(UK, false)`다. `other`에서 `UK`면 Play 버튼의 `href`가 `playWebUrl(RK)`이다. 그리고 `other`에서 `container.querySelectorAll('.actions a')`의 `id` 순서가 `['store', 'appstore']`, 클래스가 둘 다 `btn primary`다.

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/landing` Expected: FAIL
- [ ] **Step 3: `landingView`를 스펙 표대로 구현하고 `Landing.tsx`를 고친다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS. 기존 `Landing.test.tsx`의 세 테스트가 고치지 않은 채 통과한다.
- [ ] **Step 5: Commit** — `refactor(landing): decide the landing view in one function`

---

### Task 3: 인라인 스크립트, UA 프리셋, 두 곳을 묶는 테스트

스펙 §3의 "인라인 스크립트"와 "두 곳을 묶는 테스트", §4 화면 그림의 프리셋 줄을 읽는다.

**Files:**
- Modify: `index.html`(인라인 `<script>`만)
- Create: `src/admin/pages/devtools/ua-tester/config.ts`, `config.test.ts`, `src/landing/inlineScript.test.ts`

**Interfaces:**
- Consumes: `CAMPAIGN_CASES`, `BASE` (Task 1), `landingView`, `detectPlatform`, `playIntentUrl` (Task 1, 2)
- Produces:

```ts
// ua-tester/config.ts — 데이터만 둔다. import가 없다
export type UaPreset = { id: string; label: string; ua: string; touch: boolean }
export const UA_PRESETS: readonly UaPreset[]
```

프리셋(이 순서). UA는 대표 값이다.

| id | label | touch | ua |
|----|-------|-------|----|
| `iphone-safari` | iPhone Safari | true | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1` |
| `ipad` | iPad | true | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15` |
| `android-chrome` | Android Chrome | true | `Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36` |
| `instagram-android` | 인스타그램 인앱 | true | `Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android` |
| `kakaotalk-android` | 카카오톡 인앱 (Android) | true | `Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.0.0` |
| `kakaotalk-ios` | 카카오톡 인앱 (iOS) | true | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK/10.0.0` |
| `naver-android` | 네이버 앱 | true | `Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.8.5)` |
| `desktop` | 데스크톱 | false | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36` |

`내 브라우저`는 데이터가 아니다. `navigator`를 읽는 버튼이고 Task 11이 만든다.

인라인 스크립트의 규칙:
- ES5만 쓴다(`var`, `function`, 문자열 더하기). 화살표 함수, `const`, `let`, 백틱, `URL`, `URLSearchParams`를 쓰지 않는다.
- 순서: UA가 `/iPhone|iPad|iPod/i`에 맞으면 끝낸다(`detectPlatform`처럼 대소문자를 가리지 않는다. `i` 플래그를 빠뜨리면 안 된다) → `Android`가 없거나 인앱이면 끝낸다 → referrer를 만든다 → `location.replace`를 한 번 부른다.
- 페이지 주소는 `location.href`에서 읽는다. referrer는 Task 1의 `campaignReferrer`와 같은 절차로 만든다(같은 key 순서, 같은 정규식, 디코딩 없음).
- referrer를 만드는 부분만 `try`/`catch`로 감싼다. 예외가 나면 referrer 없는 지금의 intent 주소로 보낸다.
- 스크립트 위의 주석을 고친다: 이 스크립트는 `src/landing/ua.ts`의 `landingView().autoRedirect`와 같아야 하고 `src/landing/inlineScript.test.ts`가 그것을 확인한다. `ua.ts`의 `IN_APP` 위 주석도 같은 내용으로 고친다. 인라인 스크립트 안의 주석에는 백틱, `=>`, `const`, `let`을 쓰지 않는다(이름은 백틱 없이 적는다). ES5 테스트는 주석을 떼고 보지만, 떼는 정규식이 놓칠 수 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// ua-tester/config.test.ts
it('has unique ids and non-empty labels and UAs', () => {
  expect(new Set(UA_PRESETS.map((p) => p.id)).size).toBe(UA_PRESETS.length)
  for (const p of UA_PRESETS) { expect(p.label).not.toBe(''); expect(p.ua).not.toBe('') }
})
it('classifies each preset as its label says', () => {
  expect(UA_PRESETS.map((p) => [p.id, detectPlatform(p.ua, p.touch ? 5 : 0)])).toEqual([
    ['iphone-safari', { os: 'ios', inApp: false, kakao: false }],
    ['ipad', { os: 'ios', inApp: false, kakao: false }],
    ['android-chrome', { os: 'android', inApp: false, kakao: false }],
    ['instagram-android', { os: 'android', inApp: true, kakao: false }],
    ['kakaotalk-android', { os: 'android', inApp: true, kakao: true }],
    ['kakaotalk-ios', { os: 'ios', inApp: true, kakao: true }],
    ['naver-android', { os: 'android', inApp: true, kakao: false }],
    ['desktop', { os: 'other', inApp: false, kakao: false }],
  ])
})
```

```ts
// src/landing/inlineScript.test.ts
import html from '../../index.html?raw'

const ANDROID = UA_PRESETS.find((p) => p.id === 'android-chrome')!.ua
const MIXED: [string, string][] = [
  ['android and iphone tokens', `${ANDROID} like iPhone`],
  ['android and kakaotalk', `${ANDROID} KAKAOTALK/10.0.0`],
  ['android and line', `${ANDROID} Line/13.0.0`],
  ['lower-case android', 'mozilla/5.0 (linux; android 14) chrome/124.0 mobile'],
  ['lower-case iphone with android', 'mozilla/5.0 (linux; android 14) like iphone'],
]
const UAS: [string, string][] = [...UA_PRESETS.map((p): [string, string] => [p.id, p.ua]), ...MIXED]

function inlineBody(): string {
  const found = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  expect(found).toHaveLength(1)
  return found[0][1]
}
function run(nav: object, loc: { replace: ReturnType<typeof vi.fn>; href?: string }): string | null {
  new Function('navigator', 'location', inlineBody())(nav, loc)
  expect(loc.replace.mock.calls.length).toBeLessThanOrEqual(1)
  return (loc.replace.mock.calls[0]?.[0] as string | undefined) ?? null
}
const at = (ua: string, href: string) => run({ userAgent: ua }, { href, replace: vi.fn() })

it.each(UAS)('redirects like landingView for %s', (_id, ua) => {
  for (const [name, pageUrl] of CAMPAIGN_CASES) {
    expect(at(ua, pageUrl), name).toBe(landingView(detectPlatform(ua, 0), pageUrl).autoRedirect)
  }
})
it('really carries the referrer (the comparison above is not vacuous)', () => {
  const [, pageUrl, referrer] = CAMPAIGN_CASES.find(([name]) => name === 'all six keys')!
  expect(at(ANDROID, pageUrl)).toBe(playIntentUrl(referrer))
  expect(at(ANDROID, pageUrl)).toContain('referrer=utm_source%3Dinstagram')
})
it('falls back to the plain intent when reading the address throws', () => {
  const loc = { replace: vi.fn(), get href(): string { throw new Error('blocked') } }
  expect(run({ userAgent: ANDROID }, loc)).toBe(playIntentUrl())
})
it('does nothing and does not throw without a user agent', () => {
  expect(run({}, { href: BASE, replace: vi.fn() })).toBeNull()
})
it('is written in ES5', () => {
  const code = inlineBody().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')   // 주석은 보지 않는다
  expect(code).not.toMatch(/=>|\bconst\b|\blet\b|`|URLSearchParams|new URL\b/)
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/landing/inlineScript.test.ts src/admin/pages/devtools/ua-tester` Expected: FAIL (`config` 없음. 만든 뒤에는 `android and iphone tokens`와 referrer 테스트가 실패한다)
- [ ] **Step 3: `config.ts`를 만들고 `index.html`의 인라인 스크립트를 규칙대로 고친다.** `<head>`의 다른 줄과 `<body>`는 건드리지 않는다.
- [ ] **Step 4: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build && grep -c "utm_source" dist/index.html` Expected: PASS, 마지막 줄은 1 이상(인라인 스크립트가 변환 없이 나갔다)
- [ ] **Step 5: Commit** — `feat(landing): pass the referrer in the inline redirect and pin it to landingView`

---

### Task 4: `localStore`

스펙 §7의 "`src/admin/lib/localStore.ts`"를 읽는다.

**Files:**
- Create: `src/admin/lib/localStore.ts`, `src/admin/lib/localStore.test.tsx`

**Interfaces:**
- Produces: 스펙 §7의 `Parser<T>`, `readStored`, `writeStored`, `Stored<T>`, `useStored` 시그니처 그대로, 그리고

```ts
export const STORE_PREFIX = 'parfait-admin:'
export function newId(): string   // crypto.randomUUID()가 있으면 그것, 없으면 시각과 난수로 만든 문자열
```

정한 것:
- 접두사 검사는 `import.meta.env.DEV`일 때만 예외를 던진다. 세 함수 모두 검사한다.
- `update(fn)`은 `fn`을 정확히 한 번 부른다. state updater 안에서 부르지 않는다(StrictMode가 updater를 두 번 부른다).
- `persisted`가 `false`인 동안의 `update`는 저장소가 아니라 화면의 값에 `fn`을 적용하고 다시 쓰기를 시도한다. 저장소의 값은 실패한 쓰기보다 오래됐으므로, 그것에 적용하면 화면에서 한 변경이 사라진다. 쓰기에 성공하면 `persisted`는 `true`로 돌아온다.
- `storage` 이벤트(`event.key`가 이 key이거나 `null`)가 오면 저장소를 다시 읽어 값을 바꾸고 `persisted`를 `true`로 둔다.
- 같은 저장 문자열이면 `parse`를 다시 부르지 않고 앞서 만든 값을 돌려준다. `key`가 바뀌면 새 key의 값을 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const KEY = 'parfait-admin:test'
const strings: Parser<string[]> = (raw) =>
  Array.isArray(raw) && raw.every((x) => typeof x === 'string') ? (raw as string[]) : null

it('wraps and unwraps the versioned envelope', () => {
  expect(writeStored(KEY, ['a'])).toBe(true)
  expect(localStorage.getItem(KEY)).toBe('{"v":1,"items":["a"]}')
  expect(readStored(KEY, strings, [])).toEqual(['a'])
})
it.each([
  ['a missing value', null],
  ['broken JSON', '{'],
  ['another version', '{"v":2,"items":["a"]}'],
  ['a value the parser rejects', '{"v":1,"items":[1]}'],
  ['a bare value without the envelope', '["a"]'],
  ['null', 'null'],
])('falls back on %s', (_name, raw) => {
  if (raw !== null) localStorage.setItem(KEY, raw)
  expect(readStored(KEY, strings, ['fallback'])).toEqual(['fallback'])
})
it('falls back when storage access throws and reports a failed write without throwing', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(readStored(KEY, strings, [])).toEqual([])
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  expect(writeStored(KEY, ['a'])).toBe(false)
})
it('rejects keys without the prefix in dev', () => {
  expect(() => readStored('other:key', strings, [])).toThrow(/parfait-admin:/)
  expect(() => writeStored('other:key', [])).toThrow(/parfait-admin:/)
})
it('makes ids that differ', () => {
  expect(newId()).not.toBe(newId())
})
```

`useStored`는 `renderHook`으로 확인한다. `storage` 이벤트는 `window.dispatchEvent(new StorageEvent('storage', { key }))`로 보낸다.

```ts
it('reads the stored value and returns the same reference across renders with a fresh fallback', () => {
  // 저장 ['a'] → renderHook(() => useStored(KEY, strings, [])) → rerender 뒤에도 result.current.value가 toBe로 같다
  // 저장된 것이 없을 때도 rerender마다 value의 참조가 같다(fallback은 매번 새 배열)
})
it('applies update to the latest stored value, not to the value on screen', () => {
  // 마운트 뒤 다른 탭이 썼다고 치고 setItem으로 ['a','b']를 직접 넣는다(이벤트 없이)
  // update((cur) => [...cur, 'c']) → true, value와 저장소 모두 ['a','b','c']
})
it('keeps working in memory when the write fails, and recovers', () => {
  // setItem이 던짐 → update(() => ['x'])는 false, value ['x'], persisted false
  // 그대로 update((cur) => [...cur, 'y']) → value ['x','y'] (저장소의 값이 아니라 화면의 값에 적용)
  // setItem을 되돌린 뒤 update((cur) => [...cur, 'z']) → true, persisted true, 저장소 ['x','y','z']
})
it('starts persisted', () => {})
it('follows storage events for its key and for a cleared storage', () => {
  // setItem ['n'] + StorageEvent(key: KEY) → value ['n']
  // localStorage.clear() + StorageEvent(key: null) → value는 fallback
  // StorageEvent(key: 'parfait-admin:other') → 다시 그리지 않는다(같은 참조)
})
it('calls fn once per update and keeps one listener under StrictMode', () => {
  // StrictMode wrapper. fn = vi.fn((cur) => [...cur, 'a']) → update(fn) → fn 1회, value ['a']
  // addEventListener('storage')와 removeEventListener('storage')를 spy → unmount 뒤 붙인 수와 뗀 수가 같다
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/lib/localStore.test.tsx` Expected: FAIL (모듈 없음)
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): add a versioned localStorage store with a hook`

---

### Task 5: `useDebouncedPageParam`, `download`, `siteUrls`

스펙 §7의 해당 세 절을 읽는다.

**Files:**
- Create: `src/admin/lib/useDebouncedPageParam.ts`, `useDebouncedPageParam.test.tsx`, `src/admin/lib/download.ts`, `download.test.ts`, `src/admin/lib/siteUrls.ts`, `siteUrls.test.ts`

**Interfaces:**
- Consumes: `usePageParam` (`src/admin/menu/NavContext.tsx`)
- Produces:

```ts
export const PARAM_COMMIT_DELAY_MS = 300
/** [칸에 보일 값, 칸의 값 바꾸기, 지금 바로 URL에 쓰기] */
export function useDebouncedPageParam(key: string, delayMs?: number): [string, (value: string) => void, () => void]
export function downloadBlob(filename: string, blob: Blob): void
export const LANDING_URL = 'https://citytexi.github.io/temp-parfait-multi-link-web/'
```

`useDebouncedPageParam`에서 정한 것:
- 처음 값은 URL 파라미터(없으면 `''`)다. 빈 값은 `null`로 써서 파라미터를 지운다.
- 두 함수는 안정된 참조다. 한 핸들러 안에서 `set(v); flush()`를 이어 부르면 `v`가 쓰인다(최신 값은 ref로 읽는다). 이미 URL에 있는 값과 같으면 쓰지 않는다.
- 한글 조합은 훅이 `document`의 `compositionstart`와 `compositionend`를 들어서 안다(시그니처에 칸이 없어서 칸의 이벤트를 받을 수 없다). 조합 중에는 타이머가 끝나도 쓰지 않고, 조합이 끝나면 `delayMs`를 다시 잰다. `flush()`는 조합 중에도 쓴다.
- URL의 값이 이 훅이 마지막으로 쓴 값과 다르게 바뀌면(뒤로 가기, 다른 코드의 쓰기) 칸의 값을 그것으로 바꾸고 타이머를 지운다. 자기가 쓴 값이 돌아온 것이면 칸을 건드리지 않는다. 그 사이에 더 친 글자가 남아야 한다.
- 화면을 떠날 때는 타이머를 지우고 쓰지 않는다. 떠난 뒤에 쓰면 새 메뉴의 URL에 이 화면의 파라미터가 붙는다.
- 훅은 `useNav().menu`도 읽는다. 메뉴가 바뀌면 타이머를 지우고 칸의 값을 URL의 값으로 되돌린다. `setMenu`는 페이지 파라미터를 모두 비우므로, 파라미터가 없던 key는 값이 `null`에서 `null`로 그대로라 위의 "바깥에서 바뀜" 규칙에 걸리지 않는다. 셸은 메뉴가 바뀌면 페이지를 떼지만, 이 규칙은 훅이 붙어 있는 채로도 지켜져야 한다.

`downloadBlob`은 `csv.ts`의 `downloadCsv`와 같은 순서다: `URL.createObjectURL` → `<a download>`를 `body`에 붙여 `click()` → 떼기 → `setTimeout(…, 0)`으로 `revokeObjectURL`.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 훅은 가짜 타이머와 `renderHook`으로, wrapper는 File Structure의 `lookup`을 넘긴 `NavProvider`다. 훅 본문은 `{ field: useDebouncedPageParam('camp'), nav: useNav(), raw: usePageParam('camp') }`를 돌려준다. `window.history.replaceState`를 spy한다.

```ts
it('starts from the URL value, or empty', () => {
  // '/admin/?menu=utm-builder&camp=x' → field[0] === 'x'. 파라미터가 없으면 ''
})
it('writes once, 300ms after the last change', () => {
  // set('a'), 100ms, set('ab'), 100ms, set('abc') → field[0]은 곧바로 'abc' → 299ms: 쓰기 없음 → 1ms: camp=abc로 1회
})
it('writes at once on flush, and not again when the timer fires', () => {})
it('writes the new value when set and flush run in the same handler', () => {
  // act(() => { set('x'); flush() }) → URL의 camp === 'x'
})
it('removes the param for an empty value', () => {
  // '?menu=utm-builder&camp=x' → set(''), 300ms → location.search === '?menu=utm-builder'
})
it('does not write during IME composition, then writes 300ms after it ends', () => {
  // fireEvent.compositionStart(document.body) → set('ㅎ') → 500ms: 쓰기 없음
  // set('한') → fireEvent.compositionEnd(document.body) → 299ms: 없음 → 1ms: new URLSearchParams(location.search).get('camp') === '한' (주소 문자열은 퍼센트 인코딩돼 있다)
})
it('takes an outside change and drops the pending write', () => {
  // set('typed') → 100ms → act(() => raw[1]('outside')) → field[0] === 'outside' → 300ms 뒤에도 URL은 camp=outside
})
it('keeps what the user typed when its own write comes back', () => {
  // set('ab') → 300ms(쓰임) → set('abc') → rerender → field[0] === 'abc'
})
it('does not write after unmount', () => {
  // set('x') → unmount → 300ms → replaceState 호출 없음
})
it('drops the pending write and resets the field when the menu changes under it', () => {
  // 훅은 붙어 있는 채로: set('x') → act(() => nav.setMenu('link-hub')) → field[0] === '' → 300ms → location.search === '?menu=link-hub'
})
it('keeps one timer and one pair of listeners under StrictMode', () => {
  // StrictMode wrapper. set('a') → 300ms → 쓰기 1회
  // unmount 뒤 document.removeEventListener가 compositionstart와 compositionend로 붙인 횟수만큼 불렸다
})
```

```ts
// download.test.ts — csv.test.ts의 downloadCsv 테스트와 같은 방식
it('clicks a temporary link with the file name and revokes the url after the click task', () => {
  // URL.createObjectURL/revokeObjectURL을 vi.fn으로 바꾸고 HTMLAnchorElement.prototype.click을 spy
  // downloadBlob('a.png', blob) → createObjectURL(blob) 1회, click 1회(그때 a.download === 'a.png'), a[download]는 문서에 없다
  // 타이머 전에는 revoke 없음 → vi.runAllTimers() → revoke('blob:x')
})
// siteUrls.test.ts
import html from '../../../index.html?raw'
it('matches og:url in index.html', () => {
  expect(html.match(/<meta property="og:url" content="([^"]+)">/)?.[1]).toBe(LANDING_URL)
})
it('is an https url that ends with a slash', () => {
  expect(LANDING_URL).toMatch(/^https:\/\/.+\/$/)
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/lib` Expected: FAIL (세 모듈 없음)
- [ ] **Step 3: 세 모듈을 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): add the debounced page param hook, blob download and the landing url`

---

### Task 6: 상태 영역과 입력 컴포넌트

스펙 §7의 "`src/admin/components/form/`"을 읽는다.

**Files:**
- Create: `src/admin/components/form/StatusRegion.tsx`, `TextField.tsx`, `SelectField.tsx`, `CheckboxField.tsx`, `form.css`, `fields.test.tsx`

**Interfaces:**
- Produces:

```ts
// StatusRegion.tsx
export function StatusRegion(props: { children: ReactNode }): ReactElement
export function useAnnounce(): (message: string) => void

// TextField.tsx
type InputRest = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange' | 'id' | 'aria-describedby' | 'aria-invalid'>
export function TextField(props: InputRest & {
  label: string; value: string; onChange(value: string): void
  help?: string; error?: string | null; ref?: Ref<HTMLInputElement>
}): ReactElement

// SelectField.tsx
export function SelectField(props: {
  label: string; value: string; onChange(value: string): void
  options: readonly { value: string; label: string }[]
  placeholder?: string          // 있으면 값 ''인 첫 항목으로 그린다
  help?: string; ref?: Ref<HTMLSelectElement>
}): ReactElement

// CheckboxField.tsx
export function CheckboxField(props: { label: string; checked: boolean; onChange(checked: boolean): void; help?: string }): ReactElement
```

정한 것:
- `StatusRegion`은 `children`을 그리고 그 뒤에 `<div role="status" className="adm-status-region adm-sr-only">`를 하나 둔다. 이 영역은 처음부터 그려져 있고 비어 있다. 페이지는 내용 전체를 `StatusRegion`으로 감싼다.
- `useAnnounce()`는 안정된 함수를 돌려준다. `StatusRegion` 밖에서는 아무 일도 하지 않는 함수다(버튼을 혼자 그려도 동작한다).
- 직전과 같은 문구를 다시 알리면 끝에 `\u00A0`(NBSP)를 붙였다 뗐다 해서 글자가 달라지게 한다. 같은 글자는 스크린 리더가 다시 읽지 않는다.
- 세 필드는 `useId()`로 id를 만들고 `<label htmlFor>`로 잇는다. `help`와 `error`는 각각 `<p id>`로 그리고, 있는 것의 id를 `aria-describedby`에 공백으로 이어 넣는다. `error`가 있으면 `aria-invalid="true"`다. `TextField`의 나머지 props(`type`, `inputMode`, `autoCapitalize`, `onBlur`, `onCompositionEnd` 등)는 `<input>`에 그대로 넘긴다.
- `CheckboxField`는 `<label>`이 `<input type="checkbox">`와 글자를 감싼다. 줄 전체가 눌린다.
- 클래스: `adm-field`, `adm-field__label`, `adm-field__input`, `adm-field__help`, `adm-field__error`, `adm-field--checkbox`. 각 컴포넌트 파일이 `./form.css`를 import한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`fields.test.tsx`)

```ts
it('renders an empty status region from the start and writes announcements into it', () => {
  // <StatusRegion><Probe /></StatusRegion> → getByRole('status')의 글자 '' → Probe가 announce('복사했어요') → '복사했어요'
})
it('changes the text when the same message is announced twice', () => {
  // announce('a') → textContent 'a' → announce('a') → textContent !== 'a' 이지만 toHaveTextContent('a')
})
it('gives a no-op announcer outside a region', () => {
  // StatusRegion 없이 useAnnounce()('x') → 예외 없음
})
it('labels the input and reports changes as strings', () => {
  // getByLabelText('캠페인 이름') → fireEvent.change(value 'a') → onChange('a')
})
it('connects help and error and marks the input invalid', () => {
  // help '예: 202610-launch', error '영문 소문자만' → toHaveAccessibleDescription('예: 202610-launch 영문 소문자만'), aria-invalid 'true'
  // error가 null이면 aria-invalid가 없고 설명은 help뿐이다. 둘 다 없으면 aria-describedby 속성이 없다
})
it('passes input attributes and the ref through', () => {
  // inputMode="url" autoCapitalize="none" spellCheck={false} onBlur → 속성이 있고 blur에서 불린다. ref.current가 그 input이다
})
it('renders a select with a placeholder option and reports the picked value', () => {
  // placeholder '골라 주세요' → 첫 option 값 '' → change(value 'instagram') → onChange('instagram')
})
it('toggles a checkbox from its label', () => {
  // fireEvent.click(getByText('Android')) → onChange(true)
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/components/form` Expected: FAIL
- [ ] **Step 3: 컴포넌트를 구현한다.**
- [ ] **Step 4: `form.css`를 쓴다.** 입력과 선택 상자는 `font-size: var(--adm-fs-md)`, `min-height: var(--adm-hit)`, 테두리 `1px solid var(--adm-border-strong)`, 반지름 `var(--adm-radius-sm)`, 배경 `var(--adm-surface)`. `[aria-invalid='true']`의 테두리와 `.adm-field__error`의 글자는 `var(--adm-negative)`. 도움말은 `var(--adm-fs-sm)`에 `var(--adm-text-2)`. 체크박스 줄은 `min-height: var(--adm-hit)`이고 `<input>`은 20px 이상이다. Task 7이 이 파일에 `adm-copy`, `adm-confirm` 규칙을 더한다.
- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 6: Commit** — `feat(admin): add form fields and a page status region`

---

### Task 7: 복사 버튼과 확인 버튼

스펙 §7의 `CopyButton`, `ConfirmButton` 항목을 읽는다.

**Files:**
- Create: `src/admin/components/form/CopyButton.tsx`, `ConfirmButton.tsx`, `buttons.test.tsx`
- Modify: `src/admin/components/form/form.css`

**Interfaces:**
- Consumes: `useAnnounce`, `StatusRegion` (Task 6)
- Produces:

```ts
type Variant = 'primary' | 'secondary' | 'ghost'
export const COPIED_MS = 2000
export function CopyButton(props: {
  label: string                    // 보이는 글자
  text: string | (() => string)    // 누를 때 읽는다
  name?: string                    // aria-label. 보이는 글자를 포함하는 문장으로 준다
  variant?: Variant                // 기본 'secondary'
  onCopy?(): void                  // 누를 때마다 한 번. 클립보드가 실패해도 부른다
}): ReactElement

export const CONFIRM_GUARD_MS = 400
export function ConfirmButton(props: {
  label: string; confirmLabel: string; onConfirm(): void
  name?: string                    // 평소의 aria-label. 확인 상태에서는 떼고 confirmLabel이 이름이 된다
  variant?: Variant                // 기본 'ghost'
  ref?: Ref<HTMLButtonElement>
}): ReactElement
```

정한 것:
- 둘 다 `<button type="button" className="adm-button adm-button--<variant> adm-copy">`(또는 `adm-confirm`)이다.
- `CopyButton`: `navigator.clipboard?.writeText`를 `try`/`catch`로 감싼다. 성공하면 보이는 글자를 `COPIED_MS` 동안 `복사했어요`로 바꾸고 `복사했어요`를 알린다. 그 사이에 다시 누르면 시간을 다시 잰다. 떠날 때 타이머를 지운다.
- 클립보드가 없거나 거부되면 버튼 아래에 `복사하지 못했어요. 아래 내용을 직접 복사해 주세요.`와 `readOnly`인 `<textarea aria-label="복사할 내용">`을 그리고 그 내용을 선택(`select()`)하며 같은 문장을 알린다. 글상자는 다음에 성공할 때까지 남는다.
- `ConfirmButton`: 첫 누름에서 확인 상태가 되고 글자가 `confirmLabel`로 바뀌며 `confirmLabel`을 알린다. 이때 버튼에 `focus()`를 준다. Safari는 눌러도 버튼에 포커스를 주지 않아서, 주지 않으면 포커스 잃음으로 풀리지 않는다.
- 확인 상태가 된 시각은 `Date.now()`로 잰다. 그 뒤 `CONFIRM_GUARD_MS` 안의 누름은 무시하고 확인 상태를 유지한다. 그 뒤의 누름은 `onConfirm()`을 부르고 평소로 돌아간다.
- `blur`와 `Escape`는 확인 상태를 푼다. `Escape`일 때만 `취소했어요`를 알린다. 시간으로는 풀리지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`buttons.test.tsx`. 가짜 타이머, `fireEvent`, `StatusRegion`으로 감싼다)

```ts
it('copies, shows 복사했어요 for 2 seconds and announces it', async () => {
  // writeText가 resolve → writeText('abc'), 버튼 글자 '복사했어요', status '복사했어요', role은 그대로 button
  // 1999ms: 그대로 → 1ms: '링크 복사'
})
it('reads a text function at click time and calls onCopy once per click', async () => {})
it('keeps the accessible name when one is given', () => {
  // name 'Google Play에서 다운로드 주소 복사', label '복사' → getByRole('button', { name: 'Google Play에서 다운로드 주소 복사' })
})
it('shows a selected read-only text box when the clipboard is missing', async () => {
  // clipboard 없음 → getByLabelText('복사할 내용')의 value 'abc', readOnly, selectionStart 0, selectionEnd 3
  // '복사하지 못했어요. 아래 내용을 직접 복사해 주세요.'가 보이고 onCopy는 불렸다. 예외 없음
})
it('shows the text box when writeText rejects, and removes it after a later success', async () => {})
it('clears its timer on unmount and runs one under StrictMode', async () => {
  // 누른 뒤 unmount → 타이머를 다 돌려도 경고와 예외가 없다. StrictMode에서 2초 뒤 글자가 한 번에 돌아온다
})

it('asks first and runs on the second press after the guard', () => {
  // 누름 → 글자 '정말 지울까요?', onConfirm 0회, status '정말 지울까요?' → 400ms → 누름 → onConfirm 1회, 글자 '기록 지우기'
})
it('ignores a second press inside 400ms', () => {
  // 누름 → 399ms → 누름 → onConfirm 0회, 여전히 '정말 지울까요?' → 1ms → 누름 → onConfirm 1회
})
it('does not time out', () => {
  // 누름 → 10분 → 여전히 '정말 지울까요?'
})
it('disarms on Escape and on blur', () => {
  // 누름 → keyDown Escape → '기록 지우기', status '취소했어요' → 누름 → 400ms → fireEvent.blur → '기록 지우기' → 누름은 다시 묻는다
})
it('takes focus on the first press', () => {
  // 포커스 없이 fireEvent.click → document.activeElement가 그 버튼
})
it('uses the name only while idle', () => {
  // name '내 링크 Figma 삭제' → 누르면 getByRole('button', { name: '정말 지울까요?' })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/components/form/buttons.test.tsx` Expected: FAIL
- [ ] **Step 3: 두 버튼을 구현하고 `form.css`에 규칙을 더한다.** `.adm-copy`의 글상자는 폭 100%, `font-size: var(--adm-fs-md)`, `overflow-wrap: anywhere`. 확인 상태의 `.adm-confirm`은 `data-armed` 속성으로 표시하고 글자와 테두리를 `var(--adm-negative)`로 한다.
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): add copy and confirm buttons`

---

### Task 8: 캠페인 링크의 규칙

스펙 §2의 "규칙"(채널 표, 값의 형식, 만들어지는 링크)과 "최근 만든 링크"를 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/utm-builder/config.ts`, `link.ts`, `link.test.ts`

**Interfaces:**
- Consumes: `LANDING_URL` (Task 5), `Parser` (Task 4)
- Produces:

```ts
// config.ts
export type Channel = { id: string; label: string; source: string | null; medium: string | null }   // null은 직접 입력
export const CHANNELS: readonly Channel[]
export const UTM_VALUE = /^[a-z0-9][a-z0-9_-]{0,49}$/
export const CAMPAIGN_EXAMPLE = '202610-launch'
export const RECENT_KEY = 'parfait-admin:utm-builder:recent'
export const RECENT_MAX = 20

// link.ts
export type UtmValues = { source: string; medium: string; campaign: string; content: string }   // content는 없으면 ''
export type UtmField = keyof UtmValues
export type UtmInput = { channel: string | null } & UtmValues     // 칸에 적힌 그대로
export type UtmResult =
  | { ok: true; values: UtmValues; url: string }
  | { ok: false; errors: Partial<Record<UtmField, string>>; hint: string }
export function findChannel(id: string | null): Channel | undefined
export function normalizeUtm(raw: string): string
export function utmError(normalized: string): string | null       // 빈 문자열은 null
export function buildCampaign(input: UtmInput): UtmResult
export function qrFilename(values: UtmValues, ext: 'png' | 'svg'): string
export type RecentLink = UtmValues & { channel: string; createdAt: string }
export const parseRecent: Parser<RecentLink[]>
export function addRecent(list: readonly RecentLink[], item: RecentLink): RecentLink[]
export function recentTitle(item: RecentLink): string
export function reopenParams(item: RecentLink): { ch: string; src: string; med: string; camp: string; content: string }
```

규칙:
- `normalizeUtm`: 앞뒤 공백을 지우고, 소문자로 바꾸고, 이어진 공백 문자(`\s+`, 탭과 줄바꿈 포함)를 하이픈 하나로 바꾼다. 그 밖의 글자는 그대로 둔다.
- `utmError`의 문구와 순서: 허용하지 않는 글자가 있으면 `영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요` → 첫 글자가 하이픈이나 밑줄이면 `영문 소문자나 숫자로 시작해야 해요` → 50자를 넘으면 `50자까지 쓸 수 있어요`.
- `buildCampaign`: 채널이 정한 `source`, `medium`이 있으면 칸의 값은 무시한다. 나머지는 `normalizeUtm`한 값으로 본다. `hint`는 처음 걸리는 것 하나다: 채널이 없거나 모르는 id면 `어디에 올릴지 고르면 링크가 만들어져요` → source가 비면 `출처를 넣으면 링크가 만들어져요` → medium이 비면 `매체를 넣으면 링크가 만들어져요` → campaign이 비면 `캠페인 이름을 넣으면 링크가 만들어져요` → 형식 오류가 있으면 `입력한 값을 고치면 링크가 만들어져요`. `errors`에는 형식이 틀린 칸만 넣는다(빈 칸은 오류가 아니다).
- `url`은 `LANDING_URL + '?utm_source=…&utm_medium=…&utm_campaign=…'`에 content가 있으면 `&utm_content=…`를 붙인 것이다. 값은 인코딩이 필요 없는 글자뿐이라 그대로 잇는다.
- `qrFilename`: `` `parfait-qr-${source}-${campaign}${content ? `-${content}` : ''}.${ext}` ``.
- `parseRecent`: 배열이 아니면 `null`. 항목은 `channel`과 `createdAt`이 문자열이고 `source`, `medium`, `campaign`이 `UTM_VALUE`에 맞고 `content`가 `''`이거나 맞을 때만 남긴다. 앞에서 `RECENT_MAX`개까지다.
- `addRecent`: `source`, `medium`, `campaign`, `content`가 모두 같은 항목을 빼고 새 항목을 맨 앞에 넣은 뒤 `RECENT_MAX`개로 자른다.
- `recentTitle`: 채널을 알고 그 채널의 source가 정해져 있으면 채널 이름, source를 직접 넣는 채널이면 `` `${채널 이름} (${source})` ``, 모르는 채널이면 `` `${source} / ${medium}` ``. 그 뒤에 `` ` · ${campaign}` ``, content가 있으면 `` ` · ${content}` ``.
- `reopenParams`: 채널을 알고 그 채널이 정한 source와 medium이 저장된 값과 같으면 `ch`는 그 id이고 `src`, `med`는 그 채널이 직접 입력받는 것만 채운다. 그 밖에는(모르는 채널, 규칙이 바뀐 채널) `ch: 'custom'`에 저장된 source와 medium을 채운다. 같은 기록은 언제 열어도 같은 링크가 돼야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const URL0 = 'https://citytexi.github.io/temp-parfait-multi-link-web/'
const base: UtmInput = { channel: 'instagram', source: '', medium: '', campaign: '202610-launch', content: 'story' }
const recent = (o: Partial<RecentLink> = {}): RecentLink =>
  ({ channel: 'instagram', source: 'instagram', medium: 'social', campaign: 'c', content: '', createdAt: '2026-10-08T00:00:00.000Z', ...o })

it('lists the channels with the spec values', () => {
  expect(CHANNELS.map((c) => [c.id, c.label, c.source, c.medium])).toEqual([
    ['instagram', '인스타그램', 'instagram', 'social'], ['kakaotalk', '카카오톡', 'kakaotalk', 'social'],
    ['threads', '스레드', 'threads', 'social'], ['x', 'X', 'x', 'social'], ['youtube', '유튜브', 'youtube', 'video'],
    ['naver_blog', '네이버 블로그', 'naver_blog', 'referral'], ['newsletter', '이메일', 'newsletter', 'email'],
    ['offline', '오프라인 QR', 'offline', 'qr'], ['paid', '유료 광고', null, 'cpc'], ['custom', '직접 입력', null, null],
  ])
  for (const c of CHANNELS) for (const v of [c.source, c.medium]) if (v !== null) expect(v).toMatch(UTM_VALUE)
})
it('normalises pasted text without dropping characters', () => {
  expect(normalizeUtm('  Summer  Sale\n')).toBe('summer-sale')
  expect(normalizeUtm('A\tB')).toBe('a-b')
  expect(normalizeUtm('한글 캠페인')).toBe('한글-캠페인')
  expect(normalizeUtm('   ')).toBe('')
})
it('explains what is wrong with a value', () => {
  expect(utmError('')).toBeNull()
  expect(utmError('202610-launch')).toBeNull()
  expect(utmError('a'.repeat(50))).toBeNull()
  expect(utmError('한글')).toBe('영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요')
  expect(utmError('a.b')).toBe('영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요')
  expect(utmError('-a')).toBe('영문 소문자나 숫자로 시작해야 해요')
  expect(utmError('a'.repeat(51))).toBe('50자까지 쓸 수 있어요')
})
it('builds the link in a fixed param order', () => {
  expect(buildCampaign(base)).toEqual({
    ok: true,
    values: { source: 'instagram', medium: 'social', campaign: '202610-launch', content: 'story' },
    url: `${URL0}?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story`,
  })
  expect(buildCampaign({ ...base, content: '' })).toMatchObject({ url: `${URL0}?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch` })
})
it('ignores typed source and medium when the channel fixes them', () => {
  expect(buildCampaign({ ...base, source: 'x', medium: 'y' })).toEqual(buildCampaign(base))
})
it('takes source for paid and both for custom', () => {
  expect(buildCampaign({ ...base, channel: 'paid', source: 'Google', content: '' }))
    .toMatchObject({ url: `${URL0}?utm_source=google&utm_medium=cpc&utm_campaign=202610-launch` })
  expect(buildCampaign({ ...base, channel: 'custom', source: 'partner', medium: 'affiliate', content: '' }))
    .toMatchObject({ url: `${URL0}?utm_source=partner&utm_medium=affiliate&utm_campaign=202610-launch` })
})
it('makes the link from normalised values', () => {
  expect(buildCampaign({ ...base, campaign: '  Summer  Sale ', content: '' }))
    .toMatchObject({ ok: true, url: `${URL0}?utm_source=instagram&utm_medium=social&utm_campaign=summer-sale` })
})
it('says what is missing, first thing first', () => {
  const hint = (i: Partial<UtmInput>) => { const r = buildCampaign({ ...base, ...i }); return r.ok ? null : r.hint }
  expect(hint({ channel: null })).toBe('어디에 올릴지 고르면 링크가 만들어져요')
  expect(hint({ channel: 'nope' })).toBe('어디에 올릴지 고르면 링크가 만들어져요')
  expect(hint({ channel: 'paid' })).toBe('출처를 넣으면 링크가 만들어져요')
  expect(hint({ channel: 'custom', source: 's' })).toBe('매체를 넣으면 링크가 만들어져요')
  expect(hint({ campaign: ' ' })).toBe('캠페인 이름을 넣으면 링크가 만들어져요')
  expect(hint({ content: '스토리' })).toBe('입력한 값을 고치면 링크가 만들어져요')
})
it('reports format errors per field and never for an empty one', () => {
  expect(buildCampaign({ ...base, campaign: '', content: 'a b!' })).toEqual({
    ok: false, errors: { content: '영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요' }, hint: '캠페인 이름을 넣으면 링크가 만들어져요',
  })
})
it('names QR files by source, campaign and content', () => {
  const v = { source: 'instagram', medium: 'social', campaign: '202610-launch', content: 'story' }
  expect(qrFilename(v, 'png')).toBe('parfait-qr-instagram-202610-launch-story.png')
  expect(qrFilename({ ...v, source: 'kakaotalk', content: '' }, 'svg')).toBe('parfait-qr-kakaotalk-202610-launch.svg')
})
it('moves a repeated link to the top and keeps 20', () => {
  const list = Array.from({ length: 20 }, (_, i) => recent({ campaign: `c${i}` }))
  const again = recent({ campaign: 'c5', channel: 'custom', createdAt: '2026-10-09T00:00:00.000Z' })
  const out = addRecent(list, again)
  expect(out).toHaveLength(20)
  expect(out[0]).toEqual(again)
  expect(out.filter((r) => r.campaign === 'c5')).toHaveLength(1)
  expect(addRecent(list, recent({ campaign: 'new' })).map((r) => r.campaign).slice(-1)).toEqual(['c18'])
})
it('drops stored items that are malformed or break the format, and keeps the rest', () => {
  expect(parseRecent('nope')).toBeNull()
  expect(parseRecent([recent(), { ...recent(), campaign: 'A B' }, { ...recent(), source: 'javascript:x' }, { source: 's' }, null, 3]))
    .toEqual([recent()])
  expect(parseRecent(Array.from({ length: 25 }, (_, i) => recent({ campaign: `c${i}` })))).toHaveLength(20)
})
it('titles a record', () => {
  expect(recentTitle(recent({ campaign: '202610-launch', content: 'story' }))).toBe('인스타그램 · 202610-launch · story')
  expect(recentTitle(recent({ channel: 'paid', source: 'google', medium: 'cpc' }))).toBe('유료 광고 (google) · c')
  expect(recentTitle(recent({ channel: 'gone', source: 's', medium: 'm' }))).toBe('s / m · c')
})
it('reopens a record so it gives the same link', () => {
  expect(reopenParams(recent({ content: 'story' }))).toEqual({ ch: 'instagram', src: '', med: '', camp: 'c', content: 'story' })
  expect(reopenParams(recent({ channel: 'paid', source: 'google', medium: 'cpc' }))).toEqual({ ch: 'paid', src: 'google', med: '', camp: 'c', content: '' })
  expect(reopenParams(recent({ channel: 'gone', source: 's', medium: 'm' }))).toEqual({ ch: 'custom', src: 's', med: 'm', camp: 'c', content: '' })
  // 채널은 남아 있지만 규칙이 바뀐 경우
  expect(reopenParams(recent({ channel: 'instagram', source: 'ig', medium: 'social' }))).toEqual({ ch: 'custom', src: 'ig', med: 'social', camp: 'c', content: '' })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/utm-builder/link.test.ts` Expected: FAIL
- [ ] **Step 3: `config.ts`와 `link.ts`를 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): add the campaign link rules`

---

### Task 9: QR

스펙 §2의 "QR"을 읽는다.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/admin/pages/devtools/utm-builder/qr.ts`, `qr.test.ts`, `QrCode.tsx`

**Interfaces:**
- Produces:

```ts
// qr.ts
export const QR_LABEL = '이 링크로 가는 QR 코드'
export const QR_PNG_MIN_PX = 1024
export type QrMatrix = { size: number; data: boolean[][] }     // data[y][x]. 여백 4칸이 들어 있다
export type QrRect = { x: number; y: number; w: number; h: number }
export function qrMatrix(text: string): QrMatrix                // uqr의 encode(text, { ecc: 'M', border: 4 })
export function qrRects(m: QrMatrix, scale: number): QrRect[]   // 어두운 칸마다 하나, 행 순서. 좌표와 크기에 scale을 곱한다
export function pngScale(size: number): number                  // size × s >= 1024인 가장 작은 정수 s
export function qrSvg(m: QrMatrix): string
export function qrPngBlob(m: QrMatrix): Promise<Blob | null>    // 캔버스를 쓸 수 없으면 null
// QrCode.tsx
export function QrCode(props: { matrix: QrMatrix }): ReactElement
```

정한 것:
- `uqr@0.1.3`의 `encode`가 돌려주는 `data`는 `data[행][열]`이고 `size`와 `data`에 여백이 들어 있다. 기본값이 `ecc: 'L'`, `border: 1`이라 옵션을 반드시 넘긴다.
- `qrSvg`: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 S S" width="1024" height="1024" shape-rendering="crispEdges" role="img" aria-label="이 링크로 가는 QR 코드">` 안에 `<rect width="S" height="S" fill="#ffffff"/>`와 `qrRects(m, 1)`의 `<rect x y width="1" height="1" fill="#000000"/>`들이 있다.
- `QrCode`는 같은 `qrRects(m, 1)`을 React 요소로 그린다(`dangerouslySetInnerHTML`을 쓰지 않는다). 속성은 `role="img"`, `aria-label={QR_LABEL}`, `viewBox`, 흰 바탕 `<rect>`. 화면과 받은 파일이 같은 함수에서 나온다.
- `qrPngBlob`은 얇은 포장이다: `document.createElement('canvas')` → 폭과 높이 `size × pngScale(size)` → `getContext('2d')`가 `null`이면 `null` → `#ffffff`로 전체를 `fillRect` → `#000000`으로 `qrRects(m, scale)`마다 `fillRect` → `canvas.toBlob(resolve, 'image/png')`. SVG를 `Image`에 넣어 옮기지 않는다(어드민 CSP가 막는다).

- [ ] **Step 1: `uqr`을 넣는다.** Run: `npm install uqr@0.1.3` Expected: `package.json`의 `dependencies`에 `"uqr": "^0.1.3"`이 생기고 `package-lock.json`이 바뀐다. 다른 의존성의 버전은 바뀌지 않는다(`git diff package.json`으로 확인).

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```ts
const LINK = 'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story'

it('builds a square matrix with a 4-cell quiet zone, the same every time', () => {
  const m = qrMatrix(LINK)
  expect(m.size).toBe(57)
  expect(m.data).toHaveLength(57)
  expect(m.data.every((row) => row.length === 57)).toBe(true)
  expect(m.data.slice(0, 4).flat().some(Boolean)).toBe(false)
  expect(m.data.slice(-4).flat().some(Boolean)).toBe(false)
  expect(m.data.every((row) => !row.slice(0, 4).some(Boolean) && !row.slice(-4).some(Boolean))).toBe(true)
  expect(m.data[4][4]).toBe(true)          // 왼쪽 위 위치 찾기 무늬의 모서리
  expect(qrMatrix(LINK)).toEqual(m)
  expect(qrMatrix(`${LINK}x`)).not.toEqual(m)
})
it('turns dark cells into rects, row by row, scaled', () => {
  const m: QrMatrix = { size: 3, data: [[true, false, false], [false, false, true], [false, true, false]] }
  expect(qrRects(m, 1)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 1, w: 1, h: 1 }, { x: 1, y: 2, w: 1, h: 1 }])
  expect(qrRects(m, 10)[1]).toEqual({ x: 20, y: 10, w: 10, h: 10 })
})
it('picks the smallest integer scale that reaches 1024px', () => {
  expect(pngScale(57)).toBe(18)      // 1026px
  expect(pngScale(29)).toBe(36)      // 1044px
  expect(pngScale(1024)).toBe(1)
  expect(pngScale(1025)).toBe(1)
})
it('writes a standalone SVG with a white background, the quiet zone and a name', () => {
  const m = qrMatrix(LINK)
  const svg = qrSvg(m)
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 57 57"')).toBe(true)
  expect(svg).toContain('role="img" aria-label="이 링크로 가는 QR 코드"')
  expect(svg).toContain('<rect width="57" height="57" fill="#ffffff"/>')
  expect(svg.match(/fill="#000000"/g)).toHaveLength(qrRects(m, 1).length)
  expect(svg).toContain('<rect x="4" y="4" width="1" height="1" fill="#000000"/>')
  expect(svg).not.toMatch(/<rect x="[0-3]" /)      // 여백에는 점이 없다
})
it('draws the PNG on a canvas at the scaled size', async () => {
  // HTMLCanvasElement.prototype.getContext를 { fillStyle: '', fillRect: vi.fn() }을 돌려주게 spy,
  // toBlob을 (cb) => cb(new Blob(['png'], { type: 'image/png' }))로 spy
  // qrPngBlob(qrMatrix(LINK)) → Blob. 캔버스 width/height 1026. fillRect 호출 수 = qrRects 수 + 1
  // 첫 호출은 (0, 0, 1026, 1026), 둘째 호출은 (72, 72, 18, 18)
})
it('returns null without a 2D context', async () => {
  // getContext가 null(jsdom의 기본) → null, 예외 없음
})
it('renders the same cells on screen', () => {
  // render(<QrCode matrix={m} />) → getByRole('img', { name: '이 링크로 가는 QR 코드' }), fill="#000000"인 rect 수 = qrRects(m, 1).length
})
```

- [ ] **Step 3: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/utm-builder/qr.test.ts` Expected: FAIL
- [ ] **Step 4: `qr.ts`와 `QrCode.tsx`를 구현한다.**
- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS
- [ ] **Step 6: Commit** — `feat(admin): generate QR codes as SVG and PNG` (`package.json`, `package-lock.json` 포함)

---

### Task 10: 캠페인 링크 만들기 페이지

스펙 §2 전체를 읽는다. 화면 그림, 문구, URL 상태, 좁은 화면은 스펙을 그대로 따른다.

**Files:**
- Create: `src/admin/pages/devtools/utm-builder/UtmBuilderPage.tsx`, `RecentLinks.tsx`, `UtmBuilderPage.menu.ts`, `UtmBuilderPage.test.tsx`, `utm-builder.css`

**Interfaces:**
- Consumes: `CHANNELS`, `CAMPAIGN_EXAMPLE`, `RECENT_KEY`, `findChannel`, `normalizeUtm`, `buildCampaign`, `qrFilename`, `parseRecent`, `addRecent`, `recentTitle`, `reopenParams`, `RecentLink` (Task 8), `qrMatrix`, `qrSvg`, `qrPngBlob`, `QrCode` (Task 9), `useStored` (Task 4), `useDebouncedPageParam`, `downloadBlob` (Task 5), `StatusRegion`, `useAnnounce`, `TextField`, `SelectField` (Task 6), `CopyButton`, `ConfirmButton` (Task 7), `campaignReferrer`, `playWebUrl` (Task 1), `usePageParam`, `Card`
- Produces: `export function UtmBuilderPage(): ReactElement`, `export function RecentLinks(props: { items: readonly RecentLink[]; onReopen(item: RecentLink): void; onClear(): void; persisted: boolean }): ReactElement`, 메뉴 정의(스펙 §2 "메뉴" 표의 값, 아이콘은 `lucide-react`의 `Link2`, `load`는 `() => import('./UtmBuilderPage').then((m) => ({ default: m.UtmBuilderPage }))`)

정한 것:
- `ch`는 `usePageParam`, `src`·`med`·`camp`·`content`는 `useDebouncedPageParam`이다. 링크는 매 렌더에 `buildCampaign({ channel: ch, source, medium, campaign, content })`로 만든다(칸에 보이는 값으로).
- 칸의 이름과 도움말: 선택 상자 `어디에 올리나요?`(placeholder `골라 주세요`), `출처 (source)`(도움말 `예: google, meta`), `매체 (medium)`(도움말 `예: social, email, cpc`), `캠페인 이름`(도움말 `예: 202610-launch`), `소재 구분 (선택)`(도움말 `예: story, feed`). 출처 칸은 채널의 `source`가 `null`일 때, 매체 칸은 `medium`이 `null`일 때만 그린다.
- 채널이 정한 값은 선택 상자의 도움말로 보인다: 둘 다 정해졌으면 `` `source ${source} · medium ${medium}` ``, `유료 광고`면 `medium cpc`.
- 네 글자 칸에는 `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`를 준다. 칸의 `blur`와 `compositionEnd`에서 `normalizeUtm(값)`이 값과 다르면 칸을 그것으로 바꾸고, `blur`에서는 `flush()`도 부른다. 치는 도중에는 칸을 고치지 않는다.
- 채널을 바꾸면 새 채널이 직접 입력받지 않는 `src`, `med`를 비운다(`set('')` 뒤 `flush()`).
- 카드 셋: `링크 정보`, `완성된 링크`, `최근 만든 링크`. `buildCampaign`이 실패하면 `완성된 링크` 카드에는 `hint` 문장만 있고 링크, 복사, QR, 받기 버튼, 미리보기를 그리지 않는다. 칸별 `errors`는 그 칸의 `error`로 넘긴다.
- 성공하면: 링크 글자, `CopyButton`(`링크 복사`, `variant="primary"`), `QrCode`, 버튼 `PNG 받기`와 `SVG 받기`, 그리고 `Android에서는 이렇게 Play로 넘어가요` 아래에 `playWebUrl(campaignReferrer(url))`, 그 아래에 `iOS 설치는 캠페인별로 측정되지 않아요`.
- `SVG 받기`는 `downloadBlob(qrFilename(values, 'svg'), new Blob([qrSvg(matrix)], { type: 'image/svg+xml' }))`. `PNG 받기`는 `qrPngBlob(matrix)`가 `null`이면 받지 않고 `PNG를 만들지 못했어요. SVG로 받아 주세요.`를 알린다.
- 복사(`onCopy`)와 두 받기 버튼은 `update((list) => addRecent(list, { channel: ch, ...values, createdAt: new Date().toISOString() }))`를 부른다.
- `RecentLinks`: 줄마다 `recentTitle(item)`, 날짜(`Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })` → `10월 8일`), 버튼 `다시 열기`(`aria-label`은 `` `${recentTitle(item)} 다시 열기` ``). 비었으면 `아직 만든 링크가 없어요`만 있고 `기록 지우기`는 없다. `기록 지우기`는 `ConfirmButton`(`confirmLabel="정말 지울까요?"`)이고 카드의 `action` 자리에 둔다. `persisted`가 `false`면 `이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.`를 보인다.
- `다시 열기`는 `reopenParams(item)`의 값을 `ch`, `src`, `med`, `camp`, `content` 순서로 쓴다(글자 칸은 `set` 뒤 `flush()`). 기록을 지운 뒤 포커스는 `캠페인 이름` 칸으로 간다.
- 페이지 전체를 `StatusRegion`으로 감싼다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`UtmBuilderPage.test.tsx`. `../../../lib/download`의 `downloadBlob`을 mock하고, `./qr`은 `importOriginal`에 `qrPngBlob`만 `vi.fn(async () => new Blob(['png']))`로 바꾼다. 가짜 타이머)

```ts
const LINK = 'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story'

it('builds the link from a channel, a campaign and a content', () => {
  // 채널 '인스타그램' 선택 → 'source instagram · medium social' → 캠페인 '202610-launch', 소재 'story' 입력 → LINK가 보인다
  // 300ms 뒤 location.search === '?menu=utm-builder&ch=instagram&camp=202610-launch&content=story'
})
it('shows what is missing and no copy or QR until the link is valid', () => {
  // 처음: '어디에 올릴지 고르면 링크가 만들어져요', '링크 복사'·QR·'PNG 받기'·'SVG 받기' 없음
  // 채널만 고름: '캠페인 이름을 넣으면 링크가 만들어져요'
})
it('reports a format error under its field and withholds the link', () => {
  // 캠페인 '한글' → 캠페인 칸의 설명에 '영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요', aria-invalid
  // '입력한 값을 고치면 링크가 만들어져요', '링크 복사' 없음
})
it('uses normalised values in the link before the field is blurred, and rewrites the field on blur', () => {
  // 캠페인 칸에 '  Summer  Sale ' → 링크에 utm_campaign=summer-sale, 칸의 value는 아직 '  Summer  Sale '
  // '링크 복사' → writeText가 …utm_campaign=summer-sale로 불림 → blur → 칸의 value 'summer-sale', URL의 camp=summer-sale
})
it('shows source and medium fields only for the channels that need them and clears them on a change', () => {
  // '유료 광고': '출처 (source)'만, 'medium cpc'. '직접 입력': 둘 다. '?ch=custom&src=a&med=b&camp=c'에서 '인스타그램'으로 → URL에 src와 med가 없다
})
it('restores the form from the URL and ignores an unknown channel', () => {
  // '?menu=utm-builder&ch=paid&src=google&camp=c' → …?utm_source=google&utm_medium=cpc&utm_campaign=c
  // '?menu=utm-builder&ch=nope&camp=c' → 선택 값 '', '어디에 올릴지 고르면 링크가 만들어져요'
})
it('previews the Play url the landing would use', () => {
  // LINK 상태 → 'https://play.google.com/store/apps/details?id=com.teamyg.parfait&referrer=utm_source%3Dinstagram%26utm_medium%3Dsocial%26utm_campaign%3D202610-launch%26utm_content%3Dstory'
  // 'iOS 설치는 캠페인별로 측정되지 않아요'
})
it('normalises the field when IME composition ends', () => {
  // 캠페인 칸에 ' Launch ' → fireEvent.compositionEnd(칸) → 칸의 value 'launch' (blur 없이)
})
it('sets the input attributes that keep phones from rewriting the text', () => {
  // '캠페인 이름', '소재 구분 (선택)', 그리고 '직접 입력'일 때의 '출처 (source)', '매체 (medium)' 칸: autocapitalize 'none', autocorrect 'off', spellcheck 'false'
})
it('shows the day a record was made, in Seoul time', () => {
  // 저장된 createdAt '2026-10-07T16:00:00.000Z'(서울 10월 8일 01:00) → 그 줄에 '10월 8일'
})
it('copies the link and records it', async () => {
  // '링크 복사' → writeText(LINK) → 최근 목록에 '인스타그램 · 202610-launch · story'
  // 저장소 RECENT_KEY의 items[0]은 { channel: 'instagram', source: 'instagram', medium: 'social', campaign: '202610-launch', content: 'story', createdAt: <ISO> }이고 url 필드가 없다
})
it('downloads the SVG and the PNG with the channel in the file name and records the link', async () => {
  // 'SVG 받기' → downloadBlob('parfait-qr-instagram-202610-launch-story.svg', Blob(type image/svg+xml))
  // 'PNG 받기' → downloadBlob('parfait-qr-instagram-202610-launch-story.png', …). 기록은 한 줄이다(같은 링크)
})
it('says so when the PNG cannot be made', async () => {
  // qrPngBlob이 null → downloadBlob 호출 없음, status 'PNG를 만들지 못했어요. SVG로 받아 주세요.'
})
it('reopens a record, including one whose channel is gone', () => {
  // 저장된 { channel: 'gone', source: 's', medium: 'm', campaign: 'c', content: '' } → 's / m · c 다시 열기'
  // → 선택 값 'custom', 출처 's', 매체 'm', 캠페인 'c', location.search === '?menu=utm-builder&ch=custom&src=s&med=m&camp=c'
})
it('clears the history after a second press and moves focus to the campaign field', () => {
  // '기록 지우기' → '정말 지울까요?' → 400ms → 누름 → '아직 만든 링크가 없어요', 저장소의 items는 [], activeElement는 '캠페인 이름' 칸
})
it('keeps the record on screen and says it was not saved when storage is full', async () => {
  // setItem이 던짐 → '링크 복사' → 목록에 줄이 있고 '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
})
it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'utm-builder', group: 'devtools', order: 110, label: '캠페인 링크 만들기', description: '어디서 들어왔는지 알 수 있는 링크를 만들어요', keywords: ['UTM', 'QR', '캠페인', '마케팅', '링크'] })
  expect(menu.usesPeriod ?? false).toBe(false)
  expect(menu.usesGa ?? false).toBe(false)
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/utm-builder/UtmBuilderPage.test.tsx` Expected: FAIL
- [ ] **Step 3: 페이지, `RecentLinks`, 메뉴 정의를 구현한다.**
- [ ] **Step 4: `utm-builder.css`를 쓴다.** 클래스는 모두 `adm-utm-builder-`로 시작한다. 960px 이상에서 `링크 정보`와 `완성된 링크`가 두 열, 그 아래 `최근 만든 링크`가 한 줄 전체다. 960px 미만은 한 열이고 순서는 링크 정보, 완성된 링크, 최근 만든 링크다. 링크 글자는 `overflow-wrap: anywhere`. QR은 흰 바탕 상자 안에 최대 폭 200px. `다시 열기`는 `min-height: var(--adm-hit)`.
- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS. `App.test.tsx`, `registry.test.ts`가 새 메뉴와 함께 통과한다.
- [ ] **Step 6: Commit** — `feat(admin): add the campaign link builder page`

---

### Task 11: 랜딩 분기 테스트 페이지

스펙 §4 전체를 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/ua-tester/state.ts`, `state.test.ts`, `UaTesterPage.tsx`, `UaTesterPage.menu.ts`, `UaTesterPage.test.tsx`, `ua-tester.css`

**Interfaces:**
- Consumes: `UA_PRESETS`, `UaPreset` (Task 3), `detectPlatform`, `landingView`, `LandingView` (Task 2), `LANDING_URL`, `useDebouncedPageParam` (Task 5), `StatusRegion`, `TextField`, `CheckboxField` (Task 6), `CopyButton` (Task 7), `usePageParam`, `Card`
- Produces:

```ts
// state.ts
export type UaState = { preset: UaPreset | null; ua: string; touch: boolean }
export function resolveUaState(p: { preset: string | null; ua: string; touch: string | null }): UaState
export function touchParam(preset: UaPreset | null, touch: boolean): string | null   // 기준과 같으면 null, 다르면 '1' 또는 '0'
export function isLandingAddress(url: string): boolean                               // 'https://' 뒤에 글자가 있다
// UaTesterPage.tsx
export function UaTesterPage(): ReactElement
```

메뉴 정의는 스펙 §4 "메뉴" 표의 값, 아이콘은 `lucide-react`의 `Split`.

정한 것(스펙이 비워 둔 것):
- `resolveUaState`: `preset`이 아는 id이고 `ua`가 `''`이면 그 프리셋이 골라진 것이다(`ua`는 프리셋의 것). `ua`가 있으면 `ua`가 이기고 `preset`은 `null`이다. 터치의 기준은 골라진 프리셋의 `touch`, 없으면 `false`이고, `touch`가 `'1'`이나 `'0'`이면 그 값이 이긴다. 모르는 `preset`은 무시한다.
- `preset`도 `ua`도 없으면 결과 대신 `기기를 고르거나 UA 문자열을 넣어 주세요`를 보인다. 기본 프리셋을 두지 않는다. 두면 UA 칸을 비웠을 때 칸이 기본값으로 되돌아간다.
- 프리셋 버튼을 누르면 `preset`을 쓰고 `ua`를 비우고(`set('')` 뒤 `flush()`) `touch`를 지운다. UA 칸을 고치면 `preset`을 지우고, 그때의 터치 값을 `touchParam(null, touch)`로 `touch`에 쓴다. 터치 체크박스만 바꾸면 프리셋은 그대로이고 `touch`에 `touchParam(preset, 값)`을 쓴다.
- `내 브라우저`는 프리셋이 아니라 채우는 버튼이다. `preset`을 지우고 `ua`에 `navigator.userAgent`를 쓰고(`flush()`) `touch`에 `touchParam(null, navigator.maxTouchPoints > 0)`을 쓴다. `aria-pressed`가 없다. 프리셋으로 두면 이 링크를 받은 사람의 화면에는 받은 사람의 브라우저가 나온다.
- 프리셋 버튼 묶음은 `role="group"`, 이름 `기기`. 각 버튼은 `aria-pressed`를 가진다.
- 랜딩 주소 칸: `url` 파라미터가 없으면 `LANDING_URL`을 보이고, 칸의 값이 `LANDING_URL`과 같으면 파라미터를 지운다. 사용자가 칸을 다 지우면 빈 채로 둔다(페이지가 "비웠음"을 state로 기억한다. 기본값으로 되돌리면 지우고 새로 칠 수 없다). `isLandingAddress`가 `false`면 칸의 `error`는 `https://로 시작하는 주소를 넣어 주세요`이고, 결과의 주소 자리(자동 이동 주소, 버튼의 주소, 캠페인)는 `—`가 되며 그 줄의 복사 버튼은 그리지 않는다. 판정 줄과 버튼 이름은 그대로 보인다.
- 결과의 주소는 모두 글자로만 그린다. `<a href>`로 만들지 않는다. `intent://`와 `kakaotalk://` 주소이고 URL 파라미터에서 온 값으로 만들어진다.
- 결과는 `<dl>`이다. 줄:
  - `판정`: `iOS` / `Android` / `그 밖의 기기`, 그 뒤에 ` · 인앱 브라우저` 또는 ` · 일반 브라우저`, 카카오면 ` · 카카오톡`.
  - `자동 이동`: `Play로 바로 보내요`와 그 주소(복사 버튼 이름 `자동 이동 주소 복사`) / `하지 않아요 (인앱 브라우저라서)` / `하지 않아요 (Android가 아니라서)`.
  - `보이는 버튼`: `view.buttons`마다 `label`과 `href`, 복사 버튼(`label="복사"`, `name={`${label} 주소 복사`}`, `variant="ghost"`).
  - `안내 문구`: `보여요` / `안 보여요`.
  - `Play로 넘기는 캠페인`: `view.referrer`, 비었으면 `없어요`.
- 이 페이지에는 판정 로직이 없다. 값은 모두 `detectPlatform(ua, touch ? 5 : 0)`과 `landingView(platform, 주소)`에서 온다. 결과 영역은 `aria-live`가 아니다.
- UA 칸(이름 `UA 문자열`)과 주소 칸(이름 `랜딩 주소`)에는 `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, 주소 칸에는 `inputMode="url"`도 준다. 체크박스의 이름은 `터치를 지원해요`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// state.test.ts
const KAKAO = UA_PRESETS.find((p) => p.id === 'kakaotalk-android')!
const DESKTOP = UA_PRESETS.find((p) => p.id === 'desktop')!

it('resolves a preset, a custom UA and nothing', () => {
  expect(resolveUaState({ preset: 'kakaotalk-android', ua: '', touch: null })).toEqual({ preset: KAKAO, ua: KAKAO.ua, touch: true })
  expect(resolveUaState({ preset: 'kakaotalk-android', ua: 'X', touch: null })).toEqual({ preset: null, ua: 'X', touch: false })
  expect(resolveUaState({ preset: 'nope', ua: '', touch: null })).toEqual({ preset: null, ua: '', touch: false })
  expect(resolveUaState({ preset: null, ua: '', touch: '1' })).toEqual({ preset: null, ua: '', touch: true })
})
it('lets the touch param override the preset and ignores junk', () => {
  expect(resolveUaState({ preset: 'kakaotalk-android', ua: '', touch: '0' }).touch).toBe(false)
  expect(resolveUaState({ preset: 'desktop', ua: '', touch: '1' }).touch).toBe(true)
  expect(resolveUaState({ preset: 'desktop', ua: '', touch: 'yes' }).touch).toBe(false)
})
it('writes touch only when it differs from the baseline', () => {
  expect(touchParam(KAKAO, true)).toBeNull()
  expect(touchParam(KAKAO, false)).toBe('0')
  expect(touchParam(DESKTOP, true)).toBe('1')
  expect(touchParam(null, false)).toBeNull()
  expect(touchParam(null, true)).toBe('1')
})
it('accepts only https addresses', () => {
  expect(isLandingAddress('https://a.b/')).toBe(true)
  for (const bad of ['', 'https://', 'http://a.b', 'javascript:alert(1)', ' https://a.b', 'a.b']) expect(isLandingAddress(bad)).toBe(false)
})
```

```ts
// UaTesterPage.test.tsx (가짜 타이머)
const UTM = 'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=kakaotalk&utm_medium=social&utm_campaign=c'

it('asks for a device before showing a result', () => {
  // '?menu=ua-tester' → '기기를 고르거나 UA 문자열을 넣어 주세요', '판정' 없음. '랜딩 주소' 칸의 value는 LANDING_URL
})
it('shows the verdict, redirect, buttons, hint and campaign for KakaoTalk on Android', () => {
  // `?menu=ua-tester&preset=kakaotalk-android&url=${encodeURIComponent(UTM)}`
  // 판정 'Android · 인앱 브라우저 · 카카오톡', 자동 이동 '하지 않아요 (인앱 브라우저라서)'
  // 'Google Play에서 다운로드'와 playIntentUrl(R), '외부 브라우저로 열기'와 externalBrowserUrl(UTM, true)
  // 안내 문구 '보여요', 캠페인 'utm_source=kakaotalk&utm_medium=social&utm_campaign=c'
  // '카카오톡 인앱 (Android)' 버튼 aria-pressed 'true', 나머지 'false', 'UA 문자열' 칸의 value는 프리셋의 UA, 터치 체크됨
})
it.each([
  ['iphone-safari', 'iOS · 일반 브라우저', '하지 않아요 (Android가 아니라서)', ['App Store에서 다운로드'], '안 보여요'],
  ['ipad', 'iOS · 일반 브라우저', '하지 않아요 (Android가 아니라서)', ['App Store에서 다운로드'], '안 보여요'],
  ['android-chrome', 'Android · 일반 브라우저', 'Play로 바로 보내요', ['Google Play에서 다운로드'], '안 보여요'],
  ['instagram-android', 'Android · 인앱 브라우저', '하지 않아요 (인앱 브라우저라서)', ['Google Play에서 다운로드', '외부 브라우저로 열기'], '보여요'],
  ['kakaotalk-ios', 'iOS · 인앱 브라우저 · 카카오톡', '하지 않아요 (Android가 아니라서)', ['App Store에서 다운로드'], '안 보여요'],
  ['naver-android', 'Android · 인앱 브라우저', '하지 않아요 (인앱 브라우저라서)', ['Google Play에서 다운로드', '외부 브라우저로 열기'], '보여요'],
  ['desktop', '그 밖의 기기 · 일반 브라우저', '하지 않아요 (Android가 아니라서)', ['Google Play에서 다운로드', 'App Store에서 다운로드'], '안 보여요'],
])('preset %s', (id, verdict, redirect, buttons, hint) => {
  // 그 프리셋의 버튼을 누름 → 네 값이 보이고 URL의 preset === id, ua와 touch는 없다
})
it('releases the preset when the UA is edited and keeps the touch value', () => {
  // 'Android Chrome' → UA 칸을 'X Android'로 → 모든 프리셋 aria-pressed 'false' → 300ms
  // new URLSearchParams(location.search)로 읽어 ua 'X Android', touch '1', preset은 null
})
it('treats the iPad preset as desktop once touch is unchecked', () => {
  // 'iPad' → '터치를 지원해요' 해제 → 판정 '그 밖의 기기 · 일반 브라우저', URL의 touch '0', preset은 그대로 'ipad'이고 pressed
})
it('fills in this browser without selecting a preset', () => {
  // navigator.userAgent와 maxTouchPoints(5)를 defineProperty로 정함 → '내 브라우저' → UA 칸이 그 값, 터치 체크됨
  // URL에 ua와 touch=1이 있고 preset은 없다. '내 브라우저' 버튼에 aria-pressed 속성이 없다
})
it('blanks the addresses for a non-https landing address', () => {
  // 'Android Chrome' 뒤 주소 칸을 'http://a.b'로 → 칸의 설명 'https://로 시작하는 주소를 넣어 주세요'
  // 판정은 그대로, 버튼 이름 'Google Play에서 다운로드'는 있고 그 주소는 '—', '주소 복사' 버튼이 하나도 없다, 캠페인 '—'
})
it('stays empty when the address is cleared, and drops the param for the default address', () => {
  // 주소 칸을 ''로 → value '' (LANDING_URL로 돌아오지 않는다), 오류 문구가 보인다
  // 주소 칸을 LANDING_URL로 → 300ms → URL에 url 파라미터가 없다
})
it('names each copy button after what it copies', async () => {
  // android-chrome → getByRole('button', { name: 'Google Play에서 다운로드 주소 복사' }) → 누름 → writeText(playIntentUrl())
  // '자동 이동 주소 복사'도 있다
})
it('renders result addresses as text, never as links', () => {
  // kakaotalk-android + UTM 주소 → 결과 영역에 a 요소가 없다(container.querySelector('dl a') === null)
})
it('sets the input attributes that keep phones from rewriting the text', () => {
  // 'UA 문자열'과 '랜딩 주소' 칸: autocapitalize 'none', autocorrect 'off', spellcheck 'false'. '랜딩 주소' 칸은 inputmode 'url'도
})
it('does not make the result a live region', () => {
  // 결과 dl과 그 조상에 aria-live 속성이 없다(StatusRegion의 role="status"는 결과를 감싸지 않는다)
})
it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'ua-tester', group: 'devtools', order: 120, label: '랜딩 분기 테스트', description: '기기와 앱마다 랜딩이 어떻게 열리는지 확인해요', keywords: ['UA', 'user agent', '딥링크', '인앱', '랜딩'] })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/ua-tester` Expected: FAIL
- [ ] **Step 3: `state.ts`, 페이지, 메뉴 정의를 구현한다.**
- [ ] **Step 4: `ua-tester.css`를 쓴다.** 클래스는 모두 `adm-ua-tester-`로 시작한다. 프리셋 버튼은 `flex-wrap: wrap`, `min-height: var(--adm-hit)`, `aria-pressed='true'`일 때 `var(--adm-accent-soft)` 바탕에 `var(--adm-accent)` 글자. 결과의 주소는 `overflow-wrap: anywhere`. 960px 이상은 이름과 값이 두 열, 미만은 위아래로 쌓는다.
- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS
- [ ] **Step 6: Commit** — `feat(admin): add the landing branch tester page`

---

### Task 12: 바로가기의 데이터와 검사

스펙 §5의 "팀 링크", "내 링크"를 읽는다.

**Files:**
- Create: `src/admin/pages/ops/link-hub/links.ts`, `personal.ts`, `linkHub.test.ts`

**Interfaces:**
- Consumes: `PLAY_WEB_URL`, `APP_STORE_URL` (`src/landing/ua.ts`), `LANDING_URL` (Task 5), `Parser` (Task 4)
- Produces:

```ts
// links.ts
export type LinkGroupId = 'analytics' | 'store' | 'dev' | 'docs'
export type TeamLink = { id: string; group: LinkGroupId; label: string; description: string; url: string }
export const LINK_GROUPS: readonly { id: LinkGroupId; label: string }[]   // 분석, 스토어, 개발, 디자인·문서 순서
export const TEAM_LINKS: readonly TeamLink[]
// personal.ts
export const PERSONAL_KEY = 'parfait-admin:link-hub:personal'
export const PERSONAL_MAX = 50
export const LABEL_MAX = 40
export type PersonalLink = { id: string; label: string; url: string }
export type PersonalErrors = { label?: string; url?: string }
export function validatePersonal(input: { label: string; url: string }):
  | { ok: true; label: string; url: string } | { ok: false; errors: PersonalErrors }
export const parsePersonal: Parser<PersonalLink[]>
export function matchesQuery(link: { label: string; url: string; description?: string }, q: string): boolean
export function hostOf(url: string): string       // 해석할 수 없으면 ''
```

팀 링크(스펙 표의 순서와 주소). 스펙에 설명이 없어서 여기서 정한다.

| id | 묶음 | 설명 |
|----|------|------|
| `firebase-console` | analytics | 앱 설정과 Remote Config를 봐요 |
| `google-analytics` | analytics | GA 보고서를 직접 열어요 |
| `play-console` | store | Android 출시와 심사를 관리해요 |
| `app-store-connect` | store | iOS 출시와 심사를 관리해요 |
| `play-store-page` | store | 사용자에게 보이는 Android 스토어 화면이에요 |
| `app-store-page` | store | 사용자에게 보이는 iOS 스토어 화면이에요 |
| `github-repo` | dev | 랜딩과 이 대시보드의 코드예요 |
| `gcp-console` | dev | OAuth 클라이언트와 API 설정을 봐요 |
| `landing` | dev | 앱 설치로 보내는 멀티링크 페이지예요 |

규칙:
- `validatePersonal`: 이름과 주소의 앞뒤 공백을 지운다. 이름이 비면 `이름을 넣어 주세요`, `[...이름].length`가 40을 넘으면 `이름은 40자까지 쓸 수 있어요`. 주소가 비면 `주소를 넣어 주세요`, `new URL()`이 던지거나 `protocol`이 `https:`가 아니면 `https://로 시작하는 주소만 넣을 수 있어요`. 통과하면 `url`은 `new URL(주소).href`다(해석한 것을 저장한다).
- `parsePersonal`: 배열이 아니면 `null`. 항목은 `id`가 비지 않은 문자열이고 `validatePersonal`을 통과할 때만 남기며(통과한 `label`과 `url`로 바꿔서), 같은 `id`는 첫 번째만 남긴다. 앞에서 `PERSONAL_MAX`개까지다.
- `matchesQuery`: `q`의 앞뒤 공백을 지우고, 비면 `true`. 이름, 설명, 주소에서 대소문자 없이 글자 그대로 찾는다(정규식이 아니다).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it('lists the team links with unique ids, https urls and the spec addresses', () => {
  expect(new Set(TEAM_LINKS.map((l) => l.id)).size).toBe(TEAM_LINKS.length)
  for (const l of TEAM_LINKS) {
    expect(new URL(l.url).protocol).toBe('https:')
    expect(l.description).toMatch(/요$/)
    expect(LINK_GROUPS.some((g) => g.id === l.group)).toBe(true)
  }
  expect(TEAM_LINKS.map((l) => [l.id, l.group, l.label, l.url])).toEqual([
    ['firebase-console', 'analytics', 'Firebase 콘솔', 'https://console.firebase.google.com/project/parfait-5934b/overview'],
    ['google-analytics', 'analytics', 'Google Analytics', 'https://analytics.google.com/analytics/web/#/p543897329/reports/intelligenthome'],
    ['play-console', 'store', 'Play Console', 'https://play.google.com/console'],
    ['app-store-connect', 'store', 'App Store Connect', 'https://appstoreconnect.apple.com/apps'],
    ['play-store-page', 'store', 'Play 스토어 페이지', PLAY_WEB_URL],
    ['app-store-page', 'store', 'App Store 페이지', APP_STORE_URL],
    ['github-repo', 'dev', '이 레포 (GitHub)', 'https://github.com/citytexi/temp-parfait-multi-link-web'],
    ['gcp-console', 'dev', 'Google Cloud 콘솔', 'https://console.cloud.google.com/apis/credentials?project=parfait-5934b'],
    ['landing', 'dev', '랜딩 페이지', LANDING_URL],
  ])
  expect(LINK_GROUPS.map((g) => [g.id, g.label])).toEqual([['analytics', '분석'], ['store', '스토어'], ['dev', '개발'], ['docs', '디자인·문서']])
})
it('accepts a trimmed name and an https url, and stores the parsed url', () => {
  expect(validatePersonal({ label: '  Figma ', url: ' https://figma.com/file/x?y=1 ' })).toEqual({ ok: true, label: 'Figma', url: 'https://figma.com/file/x?y=1' })
  expect(validatePersonal({ label: '가'.repeat(40), url: 'https://a.b' })).toMatchObject({ ok: true, url: 'https://a.b/' })
})
it.each([
  ['javascript:alert(1)'], ['http://a.b'], ['data:text/html,x'], ['a.b'], ['https://'], ['//a.b'],
])('rejects the url %s', (url) => {
  expect(validatePersonal({ label: 'x', url })).toEqual({ ok: false, errors: { url: 'https://로 시작하는 주소만 넣을 수 있어요' } })
})
it('rejects an empty or long name and an empty url', () => {
  expect(validatePersonal({ label: '  ', url: '' })).toEqual({ ok: false, errors: { label: '이름을 넣어 주세요', url: '주소를 넣어 주세요' } })
  expect(validatePersonal({ label: '가'.repeat(41), url: 'https://a.b' })).toEqual({ ok: false, errors: { label: '이름은 40자까지 쓸 수 있어요' } })
})
it('checks stored links again and keeps the valid ones', () => {
  const good = { id: '1', label: 'Figma', url: 'https://figma.com/' }
  expect(parsePersonal({})).toBeNull()
  expect(parsePersonal([
    good, { id: '2', label: 'x', url: 'javascript:alert(1)' }, { id: '3', label: '', url: 'https://a.b/' },
    { id: '1', label: 'dup', url: 'https://a.b/' }, { label: 'no id', url: 'https://a.b/' }, null, 'x',
  ])).toEqual([good])
  expect(parsePersonal(Array.from({ length: 60 }, (_, i) => ({ id: String(i), label: 'x', url: 'https://a.b/' })))).toHaveLength(50)
})
it('searches name, description and url literally', () => {
  const link = { label: 'Firebase 콘솔', description: '앱 설정을 봐요', url: 'https://console.firebase.google.com/x' }
  expect(matchesQuery(link, '')).toBe(true)
  expect(matchesQuery(link, '  FIREBASE ')).toBe(true)
  expect(matchesQuery(link, '설정')).toBe(true)
  expect(matchesQuery(link, 'google.com')).toBe(true)
  expect(matchesQuery(link, 'figma')).toBe(false)
  expect(() => matchesQuery(link, '([\\.')).not.toThrow()
  expect(matchesQuery(link, '.*')).toBe(false)
})
it('reads the host name', () => {
  expect(hostOf('https://console.firebase.google.com/project/x')).toBe('console.firebase.google.com')
  expect(hostOf('nope')).toBe('')
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/ops/link-hub/linkHub.test.ts` Expected: FAIL
- [ ] **Step 3: `links.ts`와 `personal.ts`를 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): add the team links and the personal link rules`

---

### Task 13: 바로가기 페이지

스펙 §5 전체를 읽는다.

**Files:**
- Create: `src/admin/pages/ops/link-hub/LinkHubPage.tsx`, `LinkHubPage.menu.ts`, `LinkHubPage.test.tsx`, `link-hub.css`

**Interfaces:**
- Consumes: `LINK_GROUPS`, `TEAM_LINKS`, `PERSONAL_KEY`, `PERSONAL_MAX`, `PersonalLink`, `validatePersonal`, `parsePersonal`, `matchesQuery`, `hostOf` (Task 12), `useStored`, `newId` (Task 4), `StatusRegion`, `useAnnounce`, `TextField` (Task 6), `ConfirmButton` (Task 7), `Card`
- Produces: `export function LinkHubPage(): ReactElement`, 메뉴 정의(스펙 §5 "메뉴" 표의 값, 아이콘은 `lucide-react`의 `Bookmark`)

정한 것:
- 검색 칸은 `TextField`(`type="search"`, 이름 `링크 검색`)이고 값은 `useState`다. URL에 쓰지 않는다.
- 묶음마다 `Card`(제목은 묶음 이름) 하나. 검색에 맞는 링크가 없는 묶음은 그리지 않는다. 그래서 링크가 없는 `디자인·문서`는 나오지 않는다.
- 팀 링크 타일은 `<a target="_blank" rel="noopener noreferrer">` 하나이고 안에 이름, `<span className="adm-sr-only"> 새 탭에서 열려요</span>`, 설명, `hostOf(url)`이 있다. 타일은 `<ul>`의 `<li>`다.
- `내 링크` 카드는 맨 아래다. 검색어가 없으면 항상 그리고, 검색어가 있으면 맞는 내 링크가 있을 때만 그린다. 타일은 `<li>` 안에 링크(`<a>`: 이름, 새 탭 안내, 호스트)와 버튼 둘이 형제로 있다: `수정`(`aria-label`은 `` `${이름} 수정` ``)과 `ConfirmButton`(`label="삭제"`, `name={`${이름} 삭제`}`, `confirmLabel="정말 지울까요?"`).
- 카드 안에 `내 링크는 이 브라우저에만 저장돼요. 비밀번호나 토큰이 들어간 주소는 넣지 마세요.`를 적는다. `persisted`가 `false`면 `이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.`도 보인다.
- 추가: 버튼 `내 링크 추가`를 누르면 그 자리에 폼이 열린다(`이름` 칸, `주소` 칸(`inputMode="url"`, `autoCapitalize="none"`, `spellCheck={false}`), `저장`, `취소`). 폼은 `<form>`이고 Enter로 저장된다. 저장하면 `validatePersonal`의 오류를 칸의 `error`로 보이고, 통과하면 `update((list) => list.length >= PERSONAL_MAX ? list : [...list, { id: newId(), label, url }])` 뒤 폼을 닫는다. 폼이 열릴 때 포커스는 `이름` 칸으로 간다.
- 수정: 그 타일 자리에 같은 폼이 값이 채워져 열린다. 한 번에 폼 하나만 열린다.
- 링크가 `PERSONAL_MAX`개면 추가 버튼 자리에 `내 링크는 50개까지 둘 수 있어요`를 보인다.
- 포커스: 추가하거나 고친 뒤에는 그 링크의 `<a>`로, 취소하면 폼을 연 버튼으로, 삭제한 뒤에는 목록에서 그다음 링크의 `<a>`로, 다음이 없으면 `내 링크 추가` 버튼으로 간다. 저장과 삭제는 `추가했어요`, `고쳤어요`, `지웠어요`를 알린다.
- 맞는 링크가 팀과 내 것 모두에 없으면 `찾는 링크가 없어요`와 버튼 `검색 지우기`(검색어를 비우고 포커스를 검색 칸으로)를 보인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`LinkHubPage.test.tsx`. 가짜 타이머)

```ts
it('groups the team links into cards and hides the empty group', () => {
  // 제목(h2) '분석', '스토어', '개발', '내 링크'가 이 순서로 있고 '디자인·문서'는 없다. '분석' 카드 안에 링크 2개
})
it('opens every link in a new tab and says so', () => {
  // 모든 a가 target '_blank', rel 'noopener noreferrer'
  // getByRole('link', { name: /Firebase 콘솔 새 탭에서 열려요/ })의 href가 Firebase 주소이고 안에 'console.firebase.google.com'이 보인다
})
it('filters by name, description and url and hides cards without a match', () => {
  // '링크 검색'에 'play' → 'Play Console', 'Play 스토어 페이지'가 있고 '분석' 카드는 없다. 검색 중 URL은 바뀌지 않는다
  // 저장된 내 링크 'Figma'가 있어도 'play' 검색에는 '내 링크' 카드가 없다
})
it('offers to clear a search with no match', () => {
  // 'zzzz' → '찾는 링크가 없어요' → '검색 지우기' → 카드가 돌아오고 검색 칸이 비고 activeElement가 검색 칸
})
it('adds a personal link, stores it and moves focus to it', () => {
  // '내 링크 추가' → activeElement '이름' 칸 → 이름 'Figma', 주소 'https://figma.com/file/x' → '저장'
  // → getByRole('link', { name: /Figma/ })에 포커스, 호스트 'figma.com', 저장소 items는 [{ id: <문자열>, label: 'Figma', url: 'https://figma.com/file/x' }], status '추가했어요'
})
it('shows validation errors and saves nothing', () => {
  // 이름 '', 주소 'javascript:alert(1)' → '이름을 넣어 주세요', 'https://로 시작하는 주소만 넣을 수 있어요', 폼은 열린 채, 저장소에 키가 없다
})
it('never renders a stored javascript: link', () => {
  // 저장된 items [{ id: '1', label: 'bad', url: 'javascript:alert(1)' }, { id: '2', label: 'ok', url: 'https://a.b/' }] → 'ok'만 보인다
  // container.querySelector('a[href^="javascript"]')는 null
})
it('edits a link in place and returns focus to it', () => {
  // 'Figma 수정' → 칸에 지금 값 → 이름 'Figma 2' → '저장' → 'Figma 2' 링크에 포커스, id는 그대로, status '고쳤어요'
})
it('cancels a form and returns focus to the button that opened it', () => {})
it('deletes after a second press and moves focus to the next link, or to the add button', () => {
  // 링크 A, B → 'A 삭제' → '정말 지울까요?' → 400ms → 누름 → A가 없고 B 링크에 포커스
  // 'B 삭제'도 지움 → activeElement가 '내 링크 추가'
})
it('keeps the link and the buttons as siblings', () => {
  // 내 링크의 a 안에 button이 없다
})
it('replaces the add button with the limit at 50 links', () => {
  // 저장된 50개 → '내 링크는 50개까지 둘 수 있어요', '내 링크 추가' 없음
})
it('keeps the new link on screen and says it was not saved when storage is blocked', () => {
  // setItem이 던짐 → 추가 → 링크가 보이고 '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
})
it('warns about secrets in addresses', () => {
  // '내 링크는 이 브라우저에만 저장돼요. 비밀번호나 토큰이 들어간 주소는 넣지 마세요.'
})
it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'link-hub', group: 'ops', order: 110, label: '바로가기', description: '자주 쓰는 콘솔과 문서를 한곳에서 열어요', keywords: ['링크', 'Firebase', 'Play Console', 'App Store', '콘솔'] })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/ops/link-hub/LinkHubPage.test.tsx` Expected: FAIL
- [ ] **Step 3: 페이지와 메뉴 정의를 구현한다.**
- [ ] **Step 4: `link-hub.css`를 쓴다.** 클래스는 모두 `adm-link-hub-`로 시작한다. 타일 격자는 `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`이고 960px 미만에서는 한 열이다. 타일은 `min-height: var(--adm-hit)`, 테두리 `var(--adm-border)`, 호버와 포커스에서 `var(--adm-surface-muted)`. 내 링크의 `수정`과 `삭제`는 폭과 높이가 `var(--adm-hit)` 이상이고 사이가 `var(--adm-space-2)`(8px) 이상이다. 이름과 호스트는 `overflow-wrap: anywhere`.
- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS
- [ ] **Step 6: Commit** — `feat(admin): add the link hub page`

---

### Task 14: 체크리스트의 항목, 릴리즈, 공유

스펙 §6의 "항목", "릴리즈", "공유"를 읽는다.

**Files:**
- Create: `src/admin/pages/ops/release-checklist/template.ts`, `release.ts`, `share.ts`, `checklist.test.ts`

**Interfaces:**
- Consumes: `Parser` (Task 4)
- Produces:

```ts
// template.ts — 스펙 §6의 ReleasePlatform, ChecklistItem, ChecklistSection 타입 그대로
export const PLATFORMS: readonly ReleasePlatform[]                    // ['android', 'ios']
export const PLATFORM_LABEL: Record<ReleasePlatform, string>          // { android: 'Android', ios: 'iOS' }
export const CHECKLIST: readonly ChecklistSection[]

// release.ts
export const RELEASES_KEY = 'parfait-admin:release-checklist:releases'
export const RELEASES_MAX = 30
export const NAME_MAX = 40
export const LIMIT_MESSAGE = '릴리즈는 30개까지 둘 수 있어요. 지난 릴리즈를 지워 주세요.'
export type Release = { id: string; name: string; platforms: ReleasePlatform[]; checked: Record<string, string>; createdAt: string }
export function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string }
export function normalizePlatforms(raw: unknown): ReleasePlatform[] | null     // PLATFORMS 순서, 중복 없음. 틀리면 null
export function platformsLabel(platforms: readonly ReleasePlatform[]): string  // 'Android, iOS'
export function newRelease(input: { id: string; name: string; platforms: readonly ReleasePlatform[]; now: string; checked?: readonly string[] }): Release
export function toggleItem(release: Release, itemId: string, now: string): Release
export const parseReleases: Parser<Release[]>
export type VisibleSection = { id: string; title: string; items: readonly ChecklistItem[]; done: number }
export function visibleSections(release: Pick<Release, 'platforms' | 'checked'>, template?: readonly ChecklistSection[]): VisibleSection[]
export function progress(sections: readonly VisibleSection[]): { done: number; total: number }
export function isChecked(release: Pick<Release, 'checked'>, itemId: string): boolean
export function releaseText(release: Pick<Release, 'name' | 'platforms' | 'checked'>, template?: readonly ChecklistSection[]): string

// share.ts
export const SHARE_MAX = 4000
export type SharePayload = { name: string; platforms: ReleasePlatform[]; checked: string[] }
export function encodeShare(release: Pick<Release, 'name' | 'platforms' | 'checked'>, template?: readonly ChecklistSection[]): string
export function decodeShare(param: string, template?: readonly ChecklistSection[]): SharePayload | null
export function shareUrl(release: Pick<Release, 'name' | 'platforms' | 'checked'>, loc: { origin: string; pathname: string }): string
```

`template` 인자의 기본값은 모두 `CHECKLIST`다.

규칙:
- 구역 id와 제목: `prepare` 준비, `verify` 확인, `android` Android, `ios` iOS, `after` 출시 후. 항목의 id, 글자, 플랫폼, `menu`는 스펙 표 그대로다. `events-arrive`에는 `menu`를 두지 않는다(묶음 2가 머지된 뒤에 더한다). `help`는 어느 항목에도 두지 않는다.
- `validateName`: 앞뒤 공백을 지운다. 비면 `버전 이름을 넣어 주세요`, `/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/`에 걸리면 `버전 이름에 줄바꿈이나 제어 문자는 쓸 수 없어요`, `[...이름].length`가 40을 넘으면 `버전 이름은 40자까지 쓸 수 있어요`. 제어 문자 검사는 공백을 지우기 전의 값에 한다(끝의 줄바꿈도 거절한다).
- `checked`는 `Object.create(null)`로 만든 객체로 다루고 `Object.hasOwn`으로만 읽는다. `newRelease`의 `checked`(항목 id 배열)는 모두 `now`로 찍는다. `toggleItem`은 새 객체를 돌려준다.
- `parseReleases`: 배열이 아니면 `null`. 항목은 `id`가 비지 않은 문자열, `validateName(name)`이 통과하고 그 결과가 `name`과 같음, `normalizePlatforms(platforms)`가 `null`이 아님, `createdAt`이 문자열일 때만 남긴다. `checked`는 객체가 아니면 빈 것으로, 객체면 자기 속성 가운데 값이 문자열인 것만 옮긴다. 같은 `id`는 첫 번째만. 앞에서 `RELEASES_MAX`개까지다.
- `visibleSections`: 항목은 `platforms`가 없거나 릴리즈의 플랫폼과 겹칠 때 보인다. 보이는 항목이 없는 구역은 빠진다. `done`은 그 구역의 보이는 항목 가운데 체크된 수다. 템플릿에 없는 체크는 세지 않는다.
- `releaseText`: 첫 줄 `` `파르페 ${name} 릴리즈 (${platformsLabel}) ${done} / ${total}` ``, 빈 줄, 그 뒤 구역마다 `` `${title} ${done}/${total}` `` 한 줄과 항목마다 `✅ ` 또는 `⬜ `에 글자를 붙인 줄. 구역 사이에 빈 줄은 없다. 끝에 줄바꿈이 없다.
- `encodeShare`: `{ v: 1, name, platforms, checked }`의 JSON(이 key 순서)을 `TextEncoder`로 바이트로 바꿔 base64url(`+`→`-`, `/`→`_`, `=` 없음)로 적는다. `checked`는 템플릿에 있는 체크된 항목의 id이고 템플릿 순서다. 시각은 담지 않는다.
- `decodeShare`: 스펙 "공유"의 마지막 항목에 적힌 검사를 그 순서로 한다. 길이는 풀기 전 글자 수다. base64url 글자(`/^[A-Za-z0-9_-]+$/`)가 아니면 `null`. UTF-8은 `new TextDecoder('utf-8', { fatal: true })`로 푼다. `name`은 `validateName`을 통과하고 결과가 그대로여야 한다. `platforms`는 `normalizePlatforms`. `checked`는 문자열 배열이어야 하고, 템플릿에 없는 id와 중복은 버린다.
- `shareUrl`: `` `${origin}${pathname}?menu=release-checklist&share=${encodeShare(release)}` ``.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const ALL_IDS = CHECKLIST.flatMap((s) => s.items.map((i) => i.id))
const rel = (o: Partial<Parameters<typeof newRelease>[0]> = {}): Release =>
  newRelease({ id: 'r1', name: '1.5.0', platforms: ['android', 'ios'], now: '2026-10-08T00:00:00.000Z', ...o })
const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

it('has 22 items with unique ids in the spec sections', () => {
  expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length)
  expect(CHECKLIST.map((s) => [s.id, s.title, s.items.length])).toEqual([
    ['prepare', '준비', 4], ['verify', '확인', 4], ['android', 'Android', 5], ['ios', 'iOS', 5], ['after', '출시 후', 4],
  ])
  expect(CHECKLIST.find((s) => s.id === 'android')!.items.every((i) => i.platforms?.join() === 'android')).toBe(true)
  expect(CHECKLIST.find((s) => s.id === 'ios')!.items.every((i) => i.platforms?.join() === 'ios')).toBe(true)
  const withMenu = CHECKLIST.flatMap((s) => s.items).filter((i) => i.menu).map((i) => [i.id, i.menu])
  expect(withMenu).toEqual([['landing-links', 'ua-tester'], ['version-adoption', 'tech']])
  expect(CHECKLIST[0].items[0]).toMatchObject({ id: 'version-bumped', label: '버전 이름과 빌드 번호를 올렸어요' })
})
it('validates a version name', () => {
  expect(validateName('  1.5.0 ')).toEqual({ ok: true, name: '1.5.0' })
  expect(validateName('🍨'.repeat(40))).toMatchObject({ ok: true })
  expect(validateName('  ')).toEqual({ ok: false, error: '버전 이름을 넣어 주세요' })
  expect(validateName('a'.repeat(41))).toEqual({ ok: false, error: '버전 이름은 40자까지 쓸 수 있어요' })
  for (const bad of ['1.5\n.0', '1.5.0\n', 'a\u0007b', 'a\u2028b']) {
    expect(validateName(bad)).toEqual({ ok: false, error: '버전 이름에 줄바꿈이나 제어 문자는 쓸 수 없어요' })
  }
})
it('normalises platforms', () => {
  expect(normalizePlatforms(['ios', 'android', 'ios'])).toEqual(['android', 'ios'])
  for (const bad of [[], ['web'], ['android', 'web'], 'android', null, [1]]) expect(normalizePlatforms(bad)).toBeNull()
  expect(platformsLabel(['android', 'ios'])).toBe('Android, iOS')
  expect(platformsLabel(['ios'])).toBe('iOS')
})
it('shows the sections and items of the release platforms', () => {
  const both = visibleSections(rel())
  expect(both.map((s) => s.id)).toEqual(['prepare', 'verify', 'android', 'ios', 'after'])
  expect(progress(both)).toEqual({ done: 0, total: 22 })
  const android = visibleSections(rel({ platforms: ['android'] }))
  expect(android.map((s) => s.id)).toEqual(['prepare', 'verify', 'android', 'after'])
  expect(progress(android)).toEqual({ done: 0, total: 17 })
  expect(progress(visibleSections(rel({ platforms: ['ios'] })))).toEqual({ done: 0, total: 17 })
})
it('toggles an item and counts progress per section', () => {
  let r = toggleItem(rel(), 'version-bumped', '2026-10-08T01:00:00.000Z')
  expect(r.checked['version-bumped']).toBe('2026-10-08T01:00:00.000Z')
  expect(isChecked(r, 'version-bumped')).toBe(true)
  expect(visibleSections(r)[0].done).toBe(1)
  expect(progress(visibleSections(r))).toEqual({ done: 1, total: 22 })
  r = toggleItem(r, 'version-bumped', '2026-10-08T02:00:00.000Z')
  expect(isChecked(r, 'version-bumped')).toBe(false)
})
it('survives a template change', () => {
  const r = rel({ checked: ['version-bumped', 'removed-item', 'ios-submitted'], platforms: ['android'] })
  // 없어진 항목과 보이지 않는 플랫폼의 체크는 세지 않는다
  expect(progress(visibleSections(r))).toEqual({ done: 1, total: 17 })
  const template: ChecklistSection[] = [{ id: 's', title: 'S', items: [{ id: 'version-bumped', label: 'a' }, { id: 'brand-new', label: 'b' }] }]
  expect(visibleSections(r, template)).toEqual([{ id: 's', title: 'S', items: template[0].items, done: 1 }])
})
it('does not read inherited keys as checks', () => {
  const template: ChecklistSection[] = [{ id: 's', title: 'S', items: [{ id: 'constructor', label: 'a' }, { id: 'toString', label: 'b' }] }]
  expect(visibleSections(rel(), template)[0].done).toBe(0)
  expect(isChecked({ checked: {} }, 'toString')).toBe(false)
})
it('keeps valid stored releases and drops broken ones without throwing', () => {
  const good = { id: 'a', name: '1.5.0', platforms: ['android'], checked: { 'version-bumped': 't' }, createdAt: 't' }
  const junk = JSON.parse('{"id":"p","name":"1.4.0","platforms":["ios"],"checked":{"__proto__":"x","toString":"y","n":3},"createdAt":"t"}')
  const out = parseReleases([
    good, junk,
    { ...good, id: 'b', name: 'a'.repeat(41) }, { ...good, id: 'c', platforms: ['web'] }, { ...good, id: 'd', platforms: [] },
    { ...good, id: 'e', name: '1\n2' }, { ...good, id: 'a', name: 'dup' }, { ...good, id: '' }, { ...good, id: 'f', checked: 'x' }, null, 7,
  ])!
  expect(out.map((r) => r.id)).toEqual(['a', 'p', 'f'])
  expect(isChecked(out[0], 'version-bumped')).toBe(true)
  expect(Object.keys(out[1].checked).sort()).toEqual(['__proto__', 'toString'])
  expect(isChecked(out[1], 'n')).toBe(false)
  expect(progress(visibleSections(out[1]))).toEqual({ done: 0, total: 17 })
  expect(out[2].checked).toEqual({})
  expect(parseReleases({})).toBeNull()
  expect(parseReleases(Array.from({ length: 35 }, (_, i) => ({ ...good, id: `r${i}` })))).toHaveLength(30)
})
it('writes the progress text', () => {
  const r = rel({ platforms: ['android'], checked: ['version-bumped', 'release-notes', 'server-order', 'remote-config', 'core-flows'] })
  const lines = releaseText(r).split('\n')
  expect(lines.slice(0, 8)).toEqual([
    '파르페 1.5.0 릴리즈 (Android) 5 / 17', '',
    '준비 4/4', '✅ 버전 이름과 빌드 번호를 올렸어요', '✅ 릴리즈 노트를 썼어요', '✅ 서버 배포가 먼저 필요한지 확인했어요', '✅ Remote Config 값을 확인했어요',
    '확인 1/4',
  ])
  expect(lines[8]).toBe('✅ 가입, 로그인, 사진 올리기, 캔버스 공유, 알림을 직접 해 봤어요')
  expect(lines[9]).toBe('⬜ 새로 넣은 이벤트가 GA에 들어오는지 봤어요')
  expect(lines).toHaveLength(2 + 4 + 17)
  expect(releaseText(r).endsWith('\n')).toBe(false)
})
it('round-trips a share value, also through URLSearchParams and with Korean and emoji', () => {
  const r = rel({ name: '1.5.0 핫픽스 🍨', platforms: ['ios'], checked: ['ios-testflight', 'version-bumped', 'gone'] })
  const value = encodeShare(r)
  expect(value).toMatch(/^[A-Za-z0-9_-]+$/)
  const viaUrl = new URLSearchParams(new URL(shareUrl(r, { origin: 'https://a.b', pathname: '/admin/' })).search)
  expect(viaUrl.get('menu')).toBe('release-checklist')
  expect(viaUrl.get('share')).toBe(value)
  expect(decodeShare(viaUrl.get('share')!)).toEqual({ name: '1.5.0 핫픽스 🍨', platforms: ['ios'], checked: ['version-bumped', 'ios-testflight'] })
  expect(shareUrl(r, { origin: 'https://a.b', pathname: '/admin/' }).startsWith('https://a.b/admin/?menu=release-checklist&share=')).toBe(true)
})
it('carries no timestamps', () => {
  expect(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodeShare(rel({ checked: ['no-crash'] })).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))))
    .toEqual({ v: 1, name: '1.5.0', platforms: ['android', 'ios'], checked: ['no-crash'] })
})
it('stays under 4,000 characters with every item checked and the longest name', () => {
  for (const name of ['가'.repeat(40), '🍨'.repeat(40)]) {
    const r = rel({ name, checked: ALL_IDS })
    expect(encodeShare(r).length).toBeLessThanOrEqual(4000)
    expect(shareUrl(r, { origin: 'https://citytexi.github.io', pathname: '/temp-parfait-multi-link-web/admin/' }).length).toBeLessThanOrEqual(4000)
    expect(decodeShare(encodeShare(r))?.checked).toEqual(ALL_IDS)
  }
})
it.each([
  ['an empty string', ''],
  ['characters outside base64url', 'a+b/c='],
  ['broken base64', 'a'],
  ['bytes that are not UTF-8', 'wyg'],
  ['text that is not JSON', b64url('hello')],
  ['a JSON array', b64url('[]')],
  ['JSON null', b64url('null')],
  ['another version', b64url(JSON.stringify({ v: 2, name: 'x', platforms: ['ios'], checked: [] }))],
  ['a missing name', b64url(JSON.stringify({ v: 1, platforms: ['ios'], checked: [] }))],
  ['a 41-character name', b64url(JSON.stringify({ v: 1, name: 'a'.repeat(41), platforms: ['ios'], checked: [] }))],
  ['a name with a line break', b64url(JSON.stringify({ v: 1, name: 'a\nb', platforms: ['ios'], checked: [] }))],
  ['a name with outer spaces', b64url(JSON.stringify({ v: 1, name: ' a ', platforms: ['ios'], checked: [] }))],
  ['an unknown platform', b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['web'], checked: [] }))],
  ['no platform', b64url(JSON.stringify({ v: 1, name: 'x', platforms: [], checked: [] }))],
  ['checked that is not an array of strings', b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios'], checked: [1] }))],
])('rejects %s', (_name, param) => {
  expect(decodeShare(param)).toBeNull()
})
it('rejects a well-formed value longer than 4,000 characters before decoding it', () => {
  // 'A'.repeat(4001) 같은 값은 base64가 깨져서 길이 검사 없이도 거절된다. 길이 검사를 묶으려면 풀리는 값을 쓴다
  const long = b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios'], checked: Array(400).fill('no-crash') }))
  expect(long.length).toBeGreaterThan(4000)
  expect(decodeShare(long)).toBeNull()
})
it('merges duplicate platforms and drops unknown and repeated item ids', () => {
  const param = b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios', 'ios', 'android'], checked: ['nope', 'no-crash', 'no-crash', '__proto__'] }))
  expect(decodeShare(param)).toEqual({ name: 'x', platforms: ['android', 'ios'], checked: ['no-crash'] })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/ops/release-checklist/checklist.test.ts` Expected: FAIL
- [ ] **Step 3: `template.ts`, `release.ts`, `share.ts`를 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): add the release checklist template, release model and share codec`

---

### Task 15: 릴리즈 체크리스트 페이지 (내 릴리즈)

스펙 §6의 "메뉴", "화면", "릴리즈", "공유"의 두 복사 버튼, "URL 상태"를 읽는다. 공유 링크로 연 화면(`share` 파라미터)은 Task 16이 만든다. 이 Task는 `share`를 읽지 않는다.

**Files:**
- Create: `src/admin/pages/ops/release-checklist/ReleaseChecklistPage.tsx`, `ReleaseChecklistPage.menu.ts`, `ReleaseChecklistPage.test.tsx`, `release-checklist.css`

**Interfaces:**
- Consumes: Task 14의 `release.ts`, `template.ts` 전부와 `shareUrl`, `useStored`, `newId` (Task 4), `StatusRegion`, `useAnnounce`, `TextField`, `SelectField`, `CheckboxField` (Task 6), `CopyButton`, `ConfirmButton` (Task 7), `usePageParam`, `useNav`, `REGISTRY`(`src/admin/menu/registry.ts`. 읽기만 한다), `Card`
- Produces:

```ts
export function ReleaseChecklistPage(): ReactElement
// Task 16이 이 페이지에 끼워 넣을 때 쓰는 것. 같은 파일에서 내보낸다
export type ReleaseActions = {
  /** 맨 앞에 넣고, 그 릴리즈를 고르고, 다음 렌더 뒤 그 릴리즈의 제목으로 포커스를 보낸다. 돌려주는 값은 "목록에 넣었는지"다(저장에 성공했는지가 아니다). 최신 목록이 이미 RELEASES_MAX개면 아무것도 하지 않고 false. */
  addRelease(release: Release): boolean
  /** 다음 렌더 뒤에 릴리즈 선택 상자로, 릴리즈가 없으면 버전 이름 칸으로 포커스를 보낸다. 부르는 시점에 그 요소가 아직 없어도 된다. */
  focusPicker(): void
}
```

메뉴 정의는 스펙 §6 "메뉴" 표의 값, 아이콘은 `lucide-react`의 `ListChecks`.

정한 것:
- 목록은 `useStored(RELEASES_KEY, parseReleases, [])`, 보고 있는 릴리즈는 `release` 파라미터의 id가 가리키는 것, 없거나 모르는 id면 목록의 첫 번째다.
- 릴리즈가 없으면 `아직 릴리즈가 없어요. 버전 이름을 정해서 시작해 보세요.`와 새 릴리즈 폼을 보인다. 폼: `TextField`(이름 `버전 이름`, 도움말 `예: 1.5.0`), `CheckboxField` 둘(`Android`, `iOS`, 처음에는 둘 다 체크), 버튼 `만들기`. 릴리즈가 있을 때는 버튼 `새 릴리즈`가 같은 폼을 열고 폼에 `취소`가 더 있다. `<form>`이라 Enter로 만들어진다.
- 만들 때 `validateName`의 오류는 이름 칸의 `error`로, 플랫폼이 하나도 없으면 `플랫폼을 하나 이상 골라 주세요`를 폼에 보인다. 릴리즈가 `RELEASES_MAX`개인데 `새 릴리즈`를 누르면 폼 대신 `LIMIT_MESSAGE`를 보인다.
- `addRelease`는 `update((list) => list.length >= RELEASES_MAX ? list : [release, ...list])`이고, 넣었으면 `release` 파라미터를 그 id로 쓰고 제목이 그려진 뒤 거기로 포커스를 보내며 `true`를 돌려준다. 새 릴리즈 폼과 Task 16의 가져오기가 이 함수 하나를 쓴다.
- `addRelease`가 돌려주는 값은 `update`의 반환값이 아니다. `update`는 "저장소에 들어갔는지"를 돌려주고, 저장에 실패해도 화면의 목록에는 들어간다(Task 4). `update`에 넘긴 `fn` 안에서 "넣었다"는 표시를 세우고(`fn`은 `update` 안에서 동기로 정확히 한 번 불린다) 그 표시를 돌려준다. 저장소가 가득 차도 릴리즈는 만들어지고 `true`다.
- `focusPicker()`와 제목으로 가는 포커스는 둘 다 "다음 렌더 뒤"에 옮긴다(옮길 곳을 state나 ref에 적어 두고 effect에서 옮긴다). 지우기, 닫기, 가져오기 모두 부르는 시점에는 옮길 요소가 아직 그려지지 않았다.
- 릴리즈가 있을 때의 화면, 위에서부터: `SelectField`(이름 `릴리즈`, 항목 글자 `` `${name} · ${platformsLabel}` ``, 값은 id)와 `새 릴리즈` → 제목 `<h2 tabIndex={-1}>`(글자 `` `${name} 릴리즈` ``) → `<progress value={done} max={total} aria-label="진행률">`과 글자 `` `${done} / ${total}` ``, 전부 체크했으면 그 옆에 `모두 확인했어요` → `CopyButton` `진행 상황 복사`(`text`는 `releaseText(release)`), `CopyButton` `링크로 공유`(`text`는 `shareUrl(release, window.location)`), `ConfirmButton` `이 릴리즈 지우기`(`confirmLabel="정말 지울까요?"`) → 구역마다 `Card`(`title`은 구역 제목, `subtitle`은 `` `${done} / ${total}` ``) → `체크한 내용은 이 브라우저에만 저장돼요.`
- 항목은 `CheckboxField`다. 체크하면 `update`로 그 릴리즈에 `toggleItem(release, id, new Date().toISOString())`을 적용한다(저장소의 최신 목록에서 id로 찾아 바꾼다). 이 체크로 전부 채워졌으면 `모두 확인했어요`를 알린다. 화면을 열었을 때 이미 다 채워진 릴리즈는 알리지 않는다.
- 항목의 `menu`가 `REGISTRY.findMenu(menu)`로 찾아지면 항목 옆에 버튼 `` `${찾은 메뉴의 label} 열기` ``를 두고 `useNav().setMenu(menu)`를 부른다. 못 찾으면 버튼이 없다.
- 지운 뒤에는 `release` 파라미터를 지우고 `focusPicker()`를 부른다. `지웠어요`를 알린다.
- `persisted`가 `false`면 `이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.`를 보인다.
- 페이지 전체를 `StatusRegion`으로 감싼다. `useAnnounce`를 쓰는 부분은 그 안쪽 컴포넌트에 둔다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`ReleaseChecklistPage.test.tsx`. 가짜 타이머. `vi.mock('../../../menu/registry', …)`로 `REGISTRY.findMenu`가 `'ua-tester'`에만 `{ id: 'ua-tester', label: '랜딩 분기 테스트' }`를 돌려주게 한다. 저장된 릴리즈는 `newRelease`로 만들어 넣는다)

```ts
it('starts empty with the new-release form', () => {
  // '아직 릴리즈가 없어요. 버전 이름을 정해서 시작해 보세요.', '버전 이름' 칸, 'Android'와 'iOS' 체크됨, '릴리즈' 선택 상자와 '취소'는 없다
})
it('creates a release, selects it and moves focus to its heading', () => {
  // 이름 '1.5.0' → '만들기' → h2 '1.5.0 릴리즈'에 포커스, '0 / 22', 선택 상자의 고른 항목 '1.5.0 · Android, iOS'
  // 저장소 items[0]은 { id, name: '1.5.0', platforms: ['android', 'ios'], checked: {}, createdAt }, URL의 release === 그 id
})
it('rejects a bad name and an empty platform set', () => {
  // 이름 '' → '버전 이름을 넣어 주세요'. 두 플랫폼을 다 끔 → '플랫폼을 하나 이상 골라 주세요'. 저장소에 키가 없다
})
it('shows only the sections of the release platforms', () => {
  // Android만 고른 릴리즈 → 카드 '준비', '확인', 'Android', '출시 후', 'iOS' 카드는 없다, '0 / 17'
})
it('checks an item from its label and updates the totals, the section count and storage', () => {
  // '버전 이름과 빌드 번호를 올렸어요' 글자를 누름 → 체크됨, '1 / 22', progress의 value 1 / max 22, '준비' 카드에 '1 / 4'
  // 저장소 그 릴리즈의 checked['version-bumped']가 ISO 문자열. 다시 누르면 '0 / 22'이고 key가 없다
})
it('says 모두 확인했어요 when the last item is checked, and not on load', () => {
  // 하나만 빼고 다 체크된 Android 릴리즈 → status는 비어 있다 → 마지막 항목 체크 → '모두 확인했어요'가 progress 옆과 status에 있다
  // 다 체크된 릴리즈로 새로 그림 → progress 옆에는 있고 status는 비어 있다
})
it('switches releases through the select and the URL, and falls back to the latest', () => {
  // 릴리즈 A(최신), B → 처음은 A → 선택 상자에서 B → h2 'B 릴리즈', URL release === B의 id
  // '?menu=release-checklist&release=nope' → A
})
it('links an item to its admin menu only when that menu exists', () => {
  // '랜딩 분기 테스트 열기' 버튼이 있고 누르면 location.search === '?menu=ua-tester'
  // '새 버전 사용자가 늘고 있어요'(menu 'tech', 가짜 레지스트리에 없음) 줄에는 '열기' 버튼이 없다
})
it('copies the progress text', async () => {
  // '진행 상황 복사' → writeText의 인자가 releaseText(그 릴리즈)와 같고 '파르페 1.5.0 릴리즈 (Android, iOS) 0 / 22'로 시작한다
})
it('copies a share link without the release param', async () => {
  // '?menu=release-checklist&release=<id>'에서 '링크로 공유' → writeText의 인자가 shareUrl(그 릴리즈, window.location)과 같고 'release='가 없다
})
it('shows the text in a box when the clipboard is missing', async () => {
  // clipboard 없음 → '진행 상황 복사' → '복사할 내용' 글상자의 value가 releaseText와 같다
})
it('deletes a release after a second press and moves focus to the select, or to the name field when none is left', () => {
  // A, B → '이 릴리즈 지우기' → '정말 지울까요?' → 400ms → 누름 → A가 없고 h2 'B 릴리즈', activeElement는 '릴리즈' 선택 상자, URL에 release 없음
  // 하나 남은 것도 지움 → 빈 상태, activeElement는 '버전 이름' 칸
})
it('refuses a 31st release and deletes nothing', () => {
  // 저장된 30개 → '새 릴리즈' → LIMIT_MESSAGE, '버전 이름' 칸 없음, 저장소는 여전히 30개
})
it('does not overwrite a check made in another tab', () => {
  // 그린 뒤 저장소에 같은 릴리즈의 'release-notes' 체크를 직접 써 넣는다(이벤트 없이) → 화면에서 'version-bumped' 체크
  // → 저장소에 두 체크가 모두 있다
})
it('creates a release in memory when storage is full', () => {
  // setItem이 던짐 → 이름 '1.5.0' → '만들기' → h2 '1.5.0 릴리즈'에 포커스, '0 / 22', LIMIT_MESSAGE는 없다
  // '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
})
it('keeps checks on screen and says they were not saved when storage is full', () => {
  // setItem이 던짐 → 항목 체크 → 체크됨, '1 / 22', '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
})
it('uses real checkboxes and says where the checks live', () => {
  // getAllByRole('checkbox')가 22개(릴리즈가 있을 때), '체크한 내용은 이 브라우저에만 저장돼요.'
})
it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'release-checklist', group: 'ops', order: 120, label: '릴리즈 체크리스트', description: '배포 전에 확인할 것을 빠짐없이 챙겨요', keywords: ['배포', '출시', '릴리즈', '체크', 'QA'] })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/ops/release-checklist/ReleaseChecklistPage.test.tsx` Expected: FAIL
- [ ] **Step 3: 페이지와 메뉴 정의를 구현한다.**
- [ ] **Step 4: `release-checklist.css`를 쓴다.** 클래스는 모두 `adm-release-checklist-`로 시작한다. `<progress>`는 폭 100%, 높이 8px, 색 `accent-color: var(--adm-accent)`. 항목 줄은 체크박스와 `열기` 버튼이 양 끝에 놓이고 `min-height: var(--adm-hit)`. 960px 미만에서는 선택 상자와 버튼들이 `flex-wrap: wrap`으로 쌓이고 `열기` 버튼은 항목 글자 아래로 내려간다.
- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS
- [ ] **Step 6: Commit** — `feat(admin): add the release checklist page`

---

### Task 16: 공유받은 릴리즈 보기와 가져오기

스펙 §6의 "공유"(링크로 열었을 때, 가져오기, 닫기, 믿을 수 없는 입력)와 "URL 상태"를 읽는다.

**Files:**
- Create: `src/admin/pages/ops/release-checklist/SharedRelease.tsx`, `SharedRelease.test.tsx`
- Modify: `ReleaseChecklistPage.tsx`, `release-checklist.css`

**Interfaces:**
- Consumes: `decodeShare`, `SharePayload` (Task 14), `visibleSections`, `progress`, `platformsLabel`, `newRelease`, `LIMIT_MESSAGE`, `isChecked` (Task 14), `ReleaseActions`, `ReleaseChecklistPage` (Task 15), `newId` (Task 4), `useAnnounce` (Task 6), `usePageParam`, `Card`
- Produces: `export function SharedRelease(props: { payload: SharePayload; actions: ReleaseActions; onClose(): void }): ReactElement`

정한 것:
- `ReleaseChecklistPage`가 `share` 파라미터를 읽는다. 없으면 Task 15의 화면 그대로다. `decodeShare`가 `null`이면 평소 화면 위에 `공유 링크를 읽지 못했어요`를 `role="alert"`로 보인다. 값이 있으면 평소 화면 대신 `SharedRelease`만 그린다. `onClose`는 `share`를 지우고 `actions.focusPicker()`를 부른다. 이때는 아직 `SharedRelease`가 평소 화면 자리에 그려져 있으므로, 포커스는 `focusPicker`가 다음 렌더 뒤에 옮긴다(Task 15).
- `SharedRelease`, 위에서부터: `공유받은 릴리즈예요. 읽기 전용이에요.` → 버튼 `내 브라우저로 가져오기`(`adm-button--primary`)와 `닫기` → 제목 `<h2>`(`` `${name} 릴리즈` ``)와 `` `${platformsLabel}` `` → `<progress>`와 `` `${done} / ${total}` `` → 구역마다 `Card`(제목과 `subtitle`은 Task 15와 같다) 안에 `<ul>`, 항목마다 글자와 `확인함` 또는 `아직`.
- 체크박스를 그리지 않는다. `disabled` 체크박스는 Tab으로 갈 수 없다.
- 진행은 `visibleSections({ platforms, checked: <payload.checked로 만든 객체> })`로 센다. `newRelease({ id: 'shared', … })`로 임시 릴리즈를 만들어 넘겨도 된다.
- `내 브라우저로 가져오기`: `actions.addRelease(newRelease({ id: newId(), name, platforms, now: new Date().toISOString(), checked }))`. `true`면 `가져왔어요`를 알린다. `false`면 `LIMIT_MESSAGE`를 버튼 아래에 `role="alert"`로 보인다. 같은 이름의 릴리즈가 있어도 새로 만든다.
- 페이지는 `SharedRelease`에 넘기는 `actions.addRelease`를 감싼다: 넣기에 성공하면 `share`도 지운다. 그래서 성공하면 평소 화면이 그려지고 포커스는 새 릴리즈의 제목으로 간다(Task 15의 `addRelease`가 한다). 실패하면 `share`는 그대로다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`SharedRelease.test.tsx`. 페이지를 `renderAt`으로 그린다. 공유 값은 `encodeShare`로 만든다)

```ts
const shared = encodeShare(newRelease({ id: 'x', name: '1.5.0 핫픽스 🍨', platforms: ['ios'], now: 't', checked: ['version-bumped', 'ios-testflight'] }))

it('opens a shared release read-only, as text', () => {
  // `?menu=release-checklist&share=${shared}` → '공유받은 릴리즈예요. 읽기 전용이에요.', h2 '1.5.0 핫픽스 🍨 릴리즈', '2 / 17'
  // 카드 'iOS'는 있고 'Android'는 없다. '버전 이름과 빌드 번호를 올렸어요' 줄에 '확인함', '릴리즈 노트를 썼어요' 줄에 '아직'
  // queryAllByRole('checkbox')는 0개, '진행 상황 복사'·'이 릴리즈 지우기'·'릴리즈' 선택 상자는 없다
})
it('shows the shared release instead of my own, without touching storage', () => {
  // 내 릴리즈 A가 저장돼 있어도 A의 제목이 보이지 않고, 저장소 문자열은 그대로다
})
it('imports it as a new release stamped now, clears share and focuses its heading', () => {
  // 가짜 시각 2026-10-08T03:00:00.000Z → '내 브라우저로 가져오기'
  // → 저장소 items[0]은 name '1.5.0 핫픽스 🍨', platforms ['ios'], checked { 'version-bumped': '2026-10-08T03:00:00.000Z', 'ios-testflight': 같은 값 }
  // URL에 share가 없고 release === 새 id, 체크박스가 17개 보이고 그 가운데 2개가 체크됨, h2에 포커스, status '가져왔어요'
})
it('imports next to a release with the same name instead of overwriting it', () => {
  // 같은 이름의 내 릴리즈가 하나 있음 → 가져오기 → 저장소에 2개, 원래 것의 id와 checked는 그대로
})
it('imports in memory when storage is full', () => {
  // setItem이 던짐 → 가져오기 → LIMIT_MESSAGE는 없다, URL에 share가 없다, h2 '1.5.0 핫픽스 🍨 릴리즈'와 체크박스 17개
  // '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
})
it('keeps the share link and shows the limit when 30 releases exist', () => {
  // 저장된 30개 → 가져오기 → LIMIT_MESSAGE(alert), URL의 share는 그대로, 저장소는 30개
})
it('closes back to my releases and focuses the picker', () => {
  // 내 릴리즈 A가 있음 → '닫기' → URL에 share 없음, h2 'A 릴리즈', activeElement는 '릴리즈' 선택 상자
  // 릴리즈가 없으면 activeElement는 '버전 이름' 칸
})
it('falls back to the normal screen for a broken share link', () => {
  // share 값 셋을 차례로: 'not*base64', b64url(JSON.stringify({ v: 2, name: 'x', platforms: ['ios'], checked: [] })), 'A'.repeat(4001)
  // 각각 '공유 링크를 읽지 못했어요'(alert)와 평소 화면(빈 상태 또는 내 릴리즈)이 함께 보인다. 예외 없음
})
it('drops unknown item ids from the link', () => {
  // checked에 'nope'이 섞인 값 → '확인함'의 수는 아는 항목 수와 같다
})
```

`b64url`은 테스트 파일 안에 둔다: `(s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')`.

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/ops/release-checklist/SharedRelease.test.tsx` Expected: FAIL
- [ ] **Step 3: `SharedRelease.tsx`를 만들고 페이지에 잇는다.** `release-checklist.css`에 읽기 전용 목록의 모양을 더한다: 항목 글자와 `확인함`/`아직`이 양 끝에 놓이고, `확인함`은 `adm-tag`, `아직`은 `var(--adm-text-3)` 글자다(색만으로 구분하지 않는다. 글자가 다르다).
- [ ] **Step 4: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS. Task 15의 테스트가 그대로 통과한다.
- [ ] **Step 5: Commit** — `feat(admin): open, import and close a shared release`

---

### Task 17: README와 마무리 확인

스펙 §7의 "고치는 것"(README), §9, §10의 "확인 명령"을 읽는다.

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-08-admin-client-tools-design.md`(상태 줄만)

- [ ] **Step 1: README에 소제목을 더한다.** "어드민 메뉴 추가하기" 안, "### 페이지 모듈 규칙" 절 뒤이고 "### 고치지 않는 파일" 앞이다. 1~4번 항목과 다른 절은 건드리지 않는다(묶음 2가 고친다). 내용:

```markdown
### 브라우저 저장과 입력

- 브라우저에 남길 값은 `src/admin/lib/localStore.ts`의 `useStored(key, parse, fallback)`로 읽고 써요. key는 `parfait-admin:<메뉴 id>:<이름>`으로 짓고, `parse`에서 저장된 값을 다시 검사해요. 저장된 값은 믿을 수 없는 입력이에요. 토큰이나 개인 정보는 넣지 않아요.
- 저장에 실패해도 화면은 계속 동작해요. `persisted`가 `false`면 "이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요."를 보여 줘요.
- 글자를 치는 칸을 URL에 둘 때는 `usePageParam` 대신 `src/admin/lib/useDebouncedPageParam.ts`를 써요. 마지막 입력 뒤 300ms에 한 번만 써요.
- 입력 칸, 복사 버튼, 한 번 더 눌러 확인하는 버튼은 `src/admin/components/form/`의 `TextField`, `SelectField`, `CheckboxField`, `CopyButton`, `ConfirmButton`을 써요. 페이지를 `StatusRegion`으로 감싸면 버튼이 한 일을 스크린 리더에 알려요.
- 랜딩 주소는 `src/admin/lib/siteUrls.ts`의 `LANDING_URL`을 써요.
```

- [ ] **Step 2: 전체 확인.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS

- [ ] **Step 3: 규칙 점검.**
  - `git diff develop --stat`에 Global Constraints의 고치지 않는 파일(7개와 `NavContext.tsx`, `src/admin/ga/`, `csv.ts`, `collapsed.ts`)이 없고, `src/admin/pages/devtools/shared/`, `event-stream/`, `event-dictionary/`가 없다.
  - `git diff develop -- package.json`에서 더해진 의존성이 `uqr` 하나뿐이다(앞 줄에 쉼표가 붙는 것은 괜찮다). 다른 의존성의 버전은 그대로다.
  - `grep -rn "localStorage" src/admin --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v "lib/localStore.ts" | grep -v "menu/collapsed.ts" | grep -v "components/SideMenu.tsx"`의 결과가 없다(`SideMenu.tsx`에는 원래 주석 한 줄이 있고 이 파일은 고치지 않는다).
  - `grep -rn "parfait-admin:" src/admin --include="*.ts" | grep -v "\.test\."`에 나오는 키가 `menu-collapsed`와 Global Constraints의 셋, 그리고 `STORE_PREFIX`뿐이다.
  - `find src/admin -name "*.csp.json"`의 결과가 없다.
  - `grep -rhn "className=" src/admin/pages/devtools/utm-builder src/admin/pages/devtools/ua-tester src/admin/pages/ops src/admin/components/form`에 나오는 새 클래스가 정한 접두사로 시작한다(Global Constraints에 적은 기존 클래스는 예외).
  - `grep -rn "#[0-9a-fA-F]\{6\}" src/admin/pages/devtools src/admin/pages/ops src/admin/components/form --include="*.css" --include="*.tsx" --include="*.ts" | grep -v "\.test\."`의 결과가 `qr.ts`와 `QrCode.tsx`의 `#ffffff`, `#000000`뿐이다.
  - `grep -c "utm_source" dist/index.html`이 1 이상이다.

- [ ] **Step 4: 사용자에게 확인을 요청한다.** 구현자가 혼자 끝낼 수 없다. 아래 목록을 그대로 전하고 답을 기다린다. push와 PR은 하지 않는다.

  `npm run build && npm run preview`로 여는 화면에서:
  1. 네 메뉴(`캠페인 링크 만들기`, `랜딩 분기 테스트`, `바로가기`, `릴리즈 체크리스트`)가 사이드바, 모바일 메뉴, `⌘K`에 나오고, 열었을 때 콘솔에 CSP 위반이 없는지.
  2. `PNG 받기`와 `SVG 받기`가 파일을 내려받는지, `링크 복사`가 되는지.
  3. 화면의 QR과 받은 PNG를 휴대폰 카메라로 찍어 같은 링크가 열리는지.
  4. 960px 아래에서 네 화면이 가로로 넘치지 않는지.
  5. `바로가기`의 주소들이 맞는 곳으로 열리는지(특히 Google Analytics 주소. 스펙 §1에서 확인하지 못한 것이다).

  실제 기기에서(스펙 §9. `main`에 배포된 뒤, 그 전에는 preview 주소로):
  6. 앱이 없는 Android 기기에서 캠페인 링크를 열어 설치하고 앱을 실행한다. 하루 뒤 GA의 사용자 획득 보고서에서 그 캠페인의 `first_open`을 찾는다.
  7. 카카오톡과 인스타그램에서 같은 링크를 열어 `외부 브라우저로 열기`를 거쳐 설치한다.
  8. Android에서 (1) 카메라로 QR 스캔, (2) 메신저에서 링크를 눌러 Chrome이 열림, (3) 주소 직접 입력. 경로마다 Play 앱이 열렸는지 Play 웹이 열렸는지, 캠페인이 GA에 잡혔는지를 적는다.
  9. UTM 없는 랜딩 주소가 전과 같이 동작하는지(Android 일반 브라우저, 인앱, iOS, 데스크톱).

- [ ] **Step 5: 스펙의 상태 줄을 고친다.** `상태: 구현됨(2026-10-XX). 실제 기기 확인(§9)은 사용자가 진행 중`으로 바꾸고, 사용자가 이미 알려 준 결과가 있으면 §9 표 아래에 적는다. Commit — `docs: add the storage and form guide and mark the admin client tools spec as implemented`
