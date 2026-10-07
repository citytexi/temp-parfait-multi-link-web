# 어드민 QA 도구 (묶음 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 `개발자 도구` 그룹에 실시간 이벤트 스트림(`event-stream`)과 이벤트 사전(`event-dictionary`) 화면을 넣는다.

**Architecture:** 두 화면은 `src/admin/pages/devtools/` 아래 페이지 폴더 두 개로 들어가고, 레지스트리가 `*.menu.ts`를 알아서 모은다. GA 응답 변환과 판정 규칙(`report.ts`, `pollPolicy.ts`, `dictionary.ts`)은 React를 모르는 순수 함수로 두고, 훅이 react-query와 잇고, 페이지가 URL 상태와 컴포넌트를 조립한다. 이벤트 정의는 `src/admin/ga/eventCatalog.ts` 한 곳에 둔다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, TanStack Query v5, Vitest 5, @testing-library/react, jsdom, `lucide-react`, npm

**Spec:** `docs/superpowers/specs/2026-10-08-admin-devtools-qa-design.md`. 화면 문구, 표의 열, 상태 표는 스펙이 원본이다. 이 문서는 파일, 이름, 시그니처, 테스트를 정한다. Task를 맡으면 스펙의 해당 장을 먼저 읽는다.

## Global Constraints

- 아래 7개 파일은 고치지 않는다: `src/admin/components/Shell.tsx`, `src/admin/components/SideMenu.tsx`, `src/admin/menu/registry.ts`, `src/admin/lib/urlState.ts`, `src/admin/styles/admin.css`, `vite.config.ts`, `src/admin/config.ts`.
- `src/admin/hooks/useReports.ts`, `src/admin/components/DataTable.tsx`, `src/admin/components/CardState.tsx`도 고치지 않는다.
- 의존성을 추가하지 않는다. `package.json`과 `package-lock.json`은 바뀌지 않는다.
- OAuth scope는 `https://www.googleapis.com/auth/analytics.readonly` 그대로. CSP 조각(`*.csp.json`)은 만들지 않는다.
- 토큰은 메모리에만 둔다. 이 묶음은 `localStorage`를 쓰지 않는다.
- 메뉴 id와 order: `event-stream` 210, `event-dictionary` 220, 그룹은 둘 다 `devtools`.
- 페이지 모듈의 최상위에는 부수 효과가 없다. 요청, 리스너, 타이머는 컴포넌트와 훅 안에서 시작하고 떠날 때 정리한다.
- 어드민은 `StrictMode`로 돈다. effect가 두 번 불려도 리스너와 타이머가 한 벌만 남아야 한다.
- 페이지 폴더의 query key는 메뉴 id로 시작한다: `['event-stream']`, `['event-dictionary', ...]`.
- CSS 클래스 접두사: `adm-event-stream-`, `adm-event-dictionary-`, 공용 검색창은 `adm-devtools-search`. 표의 기본 모양은 기존 `adm-table`, 태그는 기존 `adm-tag`, 버튼은 기존 `adm-button` 클래스를 그대로 쓴다.
- 색은 `src/admin/styles/tokens.css`의 토큰만 쓴다. 새 색 금지. 색만으로 뜻을 전하지 않는다.
- 데스크톱 기준 폭 `960px`. 누르는 영역은 `--adm-hit`(44px) 이상. 입력 글자 크기는 `--adm-fs-md`(16px) 이상. 애니메이션은 `prefers-reduced-motion: reduce`에서 끈다.
- 화면 문구는 해요체. 스펙에 따옴표나 표로 적힌 문구는 글자 그대로 쓴다.
- `tsconfig.app.json`에 전역 `JSX` 타입이 없다. 반환 타입은 `react`의 `ReactElement`를 쓴다.
- 커밋 메시지는 Conventional Commits, 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- 각 Task 끝에서 `npm run typecheck`와 `npm test`가 통과해야 한다. push는 하지 않는다.

## Review Focus

1. GA 응답에 `rows`, `rowCount`, `propertyQuota`가 없음(이벤트가 0건일 때의 실제 응답) → 크래시 없이 빈 표, 잘림 아님, 남은 한도는 모름으로 처리. (Task 5, Task 10)
2. 검색어에 `(`, `[`, `\`, `.` 같은 정규식 문자가 들어감 → 글자 그대로 찾고 예외가 없다. (Task 5, Task 11)
3. `StrictMode`에서 화면이 두 번 마운트됨 → 조회 타이머와 `document` 리스너가 한 벌만 돌고, 화면을 떠나면 모두 없어진다. (Task 7)
4. URL의 `watch`가 `,a,,a, b` 처럼 빈 조각, 중복, 공백을 가짐 → `['a', 'b']`로 읽고, 별을 누르면 URL에는 정리된 값이 쓰인다. (Task 8)
5. `navigator.clipboard`가 없거나 `writeText`가 거부됨(권한, 비보안 컨텍스트) → 예외 없이 코드를 선택할 수 있는 글상자를 보여 준다. (Task 12)

---

## File Structure

```
src/admin/ga/
├─ eventCatalog.ts              # 새로: 카탈로그, findEvent (Task 1)
├─ eventCatalog.test.ts
├─ eventLabels.ts               # 수정: 카탈로그를 읽음 (Task 1)
├─ types.ts                     # 수정 (Task 2)
├─ client.ts                    # 수정 (Task 2)
└─ client.test.ts               # 수정 (Task 2)
src/admin/menu/
├─ NavContext.tsx               # 수정: setMenu(menu, params?) (Task 3)
└─ NavContext.test.tsx          # 수정 (Task 3)
src/admin/pages/devtools/
├─ shared/
│  ├─ SearchField.tsx           # 새로 (Task 4)
│  ├─ SearchField.test.tsx
│  └─ search-field.css
├─ event-stream/
│  ├─ config.ts                 # 새로: 상수 (Task 5)
│  ├─ report.ts                 # 새로: 요청, 파싱, 합계, 비교, 강조 (Task 5)
│  ├─ report.test.ts
│  ├─ __fixtures__/stream.json, stream-empty.json
│  ├─ pollPolicy.ts             # 새로 (Task 6)
│  ├─ pollPolicy.test.ts
│  ├─ useEventStream.ts         # 새로 (Task 7)
│  ├─ useEventStream.test.tsx
│  ├─ StreamStatus.tsx          # 새로 (Task 8)
│  ├─ StreamTable.tsx           # 새로 (Task 8)
│  ├─ EventStreamPage.tsx       # 새로 (Task 8)
│  ├─ EventStreamPage.menu.ts   # 새로 (Task 8)
│  ├─ EventStreamPage.test.tsx
│  └─ event-stream.css
└─ event-dictionary/
   ├─ report.ts                 # 새로: 기간 관측, 오늘 관측, metadata (Task 10)
   ├─ report.test.ts
   ├─ __fixtures__/observed.json, recent.json, metadata.json
   ├─ dictionary.ts             # 새로: 합치기, 상태, 필터 (Task 11)
   ├─ dictionary.test.ts
   ├─ useEventDictionary.ts     # 새로 (Task 12)
   ├─ DictionaryTable.tsx       # 새로 (Task 12)
   ├─ EventDictionaryPage.tsx   # 새로 (Task 12)
   ├─ EventDictionaryPage.menu.ts
   ├─ EventDictionaryPage.test.tsx
   └─ event-dictionary.css
```

Task 1~4는 서로 독립이다. Task 5~9는 스트림, Task 10~12는 사전이다. 사전은 Task 1, 2, 3, 4에만 기대므로 스트림과 순서를 바꿔도 된다.

페이지 테스트는 `src/admin/pages/pages2.test.tsx`의 방식을 따른다: `vi.hoisted`로 가짜 `client`를 만들고 `vi.mock('../../../hooks/useGa', ...)`로 `useGa`를 바꾼 뒤 `QueryClientProvider`와 `NavProvider`로 감싸 그린다.

---

### Task 1: 이벤트 카탈로그

**Files:**
- Create: `src/admin/ga/eventCatalog.ts`, `src/admin/ga/eventCatalog.test.ts`
- Modify: `src/admin/ga/eventLabels.ts`

**Interfaces:**
- Produces:

```ts
export type EventPlatform = 'Android' | 'iOS'
export type EventParam = { name: string; type: 'string' | 'number' | 'boolean'; description: string }
export type CatalogEvent = {
  name: string
  label: string
  description: string
  kind: 'auto' | 'app'
  params: readonly EventParam[]
  platforms?: readonly EventPlatform[]
}
export const ALL_PLATFORMS: readonly EventPlatform[]        // ['Android', 'iOS']
export const EVENT_CATALOG: readonly CatalogEvent[]
export function findEvent(name: string): CatalogEvent | undefined
export function targetPlatforms(event: CatalogEvent): readonly EventPlatform[]   // platforms ?? ALL_PLATFORMS
// eventLabels.ts (시그니처 그대로)
export function eventLabel(name: string): { label: string; registered: boolean }
```

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`eventCatalog.test.ts`)

```ts
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

it('has unique, valid event names', () => {
  const names = EVENT_CATALOG.map((e) => e.name)
  expect(new Set(names).size).toBe(names.length)
  for (const n of names) expect(n).toMatch(NAME)
})
it('has unique, valid param names inside each event', () => {
  for (const e of EVENT_CATALOG) {
    const names = e.params.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(NAME)
  }
})
it('carries the ten auto-collected events with a label and a description', () => {
  const auto = EVENT_CATALOG.filter((e) => e.kind === 'auto')
  expect(auto.map((e) => e.name).sort()).toEqual(
    ['app_exception', 'app_remove', 'app_update', 'first_open', 'notification_open',
     'notification_receive', 'os_update', 'screen_view', 'session_start', 'user_engagement'],
  )
  for (const e of auto) {
    expect(e.label).not.toBe('')
    expect(e.description).toMatch(/요\.?$/)
  }
})
it('finds by name and ignores inherited object keys', () => {
  expect(findEvent('first_open')?.label).toBe('처음 앱 열기')
  expect(findEvent('toString')).toBeUndefined()
  expect(findEvent('nope')).toBeUndefined()
})
it('defaults target platforms to both', () => {
  expect(targetPlatforms({ name: 'x', label: '', description: '', kind: 'app', params: [] })).toEqual(['Android', 'iOS'])
  expect(targetPlatforms({ name: 'x', label: '', description: '', kind: 'app', params: [], platforms: ['iOS'] })).toEqual(['iOS'])
})
```

`eventLabels.test.ts`는 그대로 둔다. 거기에 한 가지를 더한다: 라벨이 빈 카탈로그 항목은 등록되지 않은 것으로 돌려준다. `eventLabel`이 카탈로그 배열을 인자로 받지 않으므로, `eventLabels.ts`에 `labelFrom(event: CatalogEvent | undefined, name: string)`를 내보내고 그것을 테스트한다.

```ts
it('treats an empty label as unregistered', () => {
  expect(labelFrom({ name: 'x_y', label: '', description: '', kind: 'app', params: [] }, 'x_y'))
    .toEqual({ label: 'x_y', registered: false })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/ga/eventCatalog.test.ts src/admin/ga/eventLabels.test.ts` Expected: FAIL (모듈 없음)

- [ ] **Step 3: `eventCatalog.ts`를 만든다.** 자동 수집 10개의 `label`은 지금 `eventLabels.ts`의 값을 그대로 옮긴다. `description`은 Firebase 자동 수집 이벤트 문서의 뜻을 해요체 한 문장으로 쓴다(예: `first_open` → "앱을 설치하거나 다시 설치한 뒤 처음 열 때 기록돼요."). `params`는 빈 배열, `platforms`는 생략한다. 앱 정의 이벤트는 넣지 않는다. `findEvent`는 `Map`으로 찾는다.

- [ ] **Step 4: `eventLabels.ts`를 고친다.** `EVENT_LABELS` 맵을 지우고 `eventLabel(name)`이 `labelFrom(findEvent(name), name)`을 돌려준다.

- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS. `events.test.ts`와 페이지 테스트가 그대로 통과해야 한다.

- [ ] **Step 6: Commit** — `feat(admin): add the event catalog and read event labels from it`

---

### Task 2: GA 클라이언트와 타입

**Files:**
- Modify: `src/admin/ga/types.ts`, `src/admin/ga/client.ts`, `src/admin/ga/client.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
type QuotaStatus = { consumed: number; remaining: number }
export type PropertyQuota = {
  tokensPerDay?: QuotaStatus
  tokensPerHour?: QuotaStatus
  tokensPerProjectPerHour?: QuotaStatus
  concurrentRequests?: QuotaStatus
  serverErrorsPerProjectPerHour?: QuotaStatus
}
export type RunRealtimeReportRequest = { /* 기존 필드 */ orderBys?: OrderBy[]; returnPropertyQuota?: boolean }
export type DimensionMetadata = { apiName: string; uiName?: string; description?: string; customDefinition?: boolean }
export type MetricMetadata = DimensionMetadata
export type Metadata = { dimensions?: DimensionMetadata[]; metrics?: MetricMetadata[] }
// client.ts
runRealtimeReport(body: RunRealtimeReportRequest): Promise<RunReportResponse>   // returnPropertyQuota: true를 붙임
getMetadata(): Promise<Metadata>
```

- [ ] **Step 1: 테스트를 고치고 더한다** (`client.test.ts`). 기존 "runRealtimeReport does not add returnPropertyQuota"를 아래로 바꾼다.

```ts
it('runRealtimeReport asks for quota but does not report it to onQuota', async () => {
  const onQuota = vi.fn()
  const quota = { tokensPerHour: { consumed: 3, remaining: 39997 } }
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { propertyQuota: quota }))
  const res = await setup(fetchImpl, { onQuota }).runRealtimeReport({ metrics: [{ name: 'activeUsers' }] })
  const [url, init] = fetchImpl.mock.calls[0]
  expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:runRealtimeReport')
  expect(JSON.parse(init.body)).toEqual({ metrics: [{ name: 'activeUsers' }], returnPropertyQuota: true })
  expect(res.propertyQuota).toEqual(quota)
  expect(onQuota).not.toHaveBeenCalled()
})
it('getMetadata sends GET without a body', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { dimensions: [{ apiName: 'customEvent:item_id' }] }))
  const res = await setup(fetchImpl).getMetadata()
  const [url, init] = fetchImpl.mock.calls[0]
  expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123/metadata')
  expect(init.method).toBe('GET')
  expect(init.body).toBeUndefined()
  expect(init.headers.Authorization).toBe('Bearer tok')
  expect(res.dimensions).toEqual([{ apiName: 'customEvent:item_id' }])
})
it('getMetadata classifies errors like POST', async () => {
  const e403 = await kindOf(setup(vi.fn().mockResolvedValue(jsonResponse(403, {}))).getMetadata())
  expect(e403.kind).toBe('forbidden')
  const eNet = await kindOf(setup(vi.fn().mockRejectedValue(new Error('offline'))).getMetadata())
  expect(eNet.kind).toBe('network')
  const eAuth = await kindOf(setup(vi.fn(), { token: null }).getMetadata())
  expect(eAuth.kind).toBe('auth')
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/ga/client.test.ts` Expected: FAIL

- [ ] **Step 3: `types.ts`를 Interfaces대로 고친다.**

- [ ] **Step 4: `client.ts`를 고친다.** `post`를 `request<T>(method: 'GET' | 'POST', path: string, body?: unknown)`로 일반화한다. `path`는 `:runReport`나 `/metadata`처럼 `properties/{id}` 뒤에 붙는 부분이다. GET일 때는 `body`와 `Content-Type`을 보내지 않는다. 토큰 확인, 네트워크 오류, 오류 응답 분류는 한 벌만 둔다.

- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS

- [ ] **Step 6: Commit** — `feat(admin): return realtime quota and add getMetadata to the GA client`

---

### Task 3: `setMenu`에 페이지 파라미터

**Files:**
- Modify: `src/admin/menu/NavContext.tsx`, `src/admin/menu/NavContext.test.tsx`, `README.md`("어드민 메뉴 추가하기"의 3번 항목)

**Interfaces:**
- Produces: `setMenu(menu: MenuId, params?: Readonly<Record<string, string>>): void`

- [ ] **Step 1: 실패하는 테스트를 더한다** (`NavContext.test.tsx`, 기존 `setup`과 `lookup`을 쓴다)

```ts
it('opens a menu with page params in one history entry', () => {
  const { result, pushSpy } = setup()
  act(() => result.current.nav.setMenu('utm', { q: 'a b&c=한' }))
  expect(pushSpy).toHaveBeenCalledTimes(1)
  expect(new URLSearchParams(window.location.search).get('q')).toBe('a b&c=한')
  expect(result.current.nav.menu).toBe('utm')
  expect(result.current.param[0]).toBe('a b&c=한')
})
it('drops reserved keys from params', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { result } = setup()
  act(() => result.current.nav.setMenu('users', { menu: 'tech', period: '90d', q: 'x' }))
  expect(result.current.nav.menu).toBe('users')
  expect(window.location.search).toBe('?menu=users&period=7d&q=x')
  expect(warn).toHaveBeenCalled()
})
it('replaces page params without a history entry when already on the menu', () => {
  const { result, pushSpy, replaceSpy } = setup('/admin/?menu=utm&q=old&z=1')
  pushSpy.mockClear()
  act(() => result.current.nav.setMenu('utm', { q: 'new' }))
  expect(pushSpy).not.toHaveBeenCalled()
  expect(replaceSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=utm&q=new')
})
it('still ignores the same menu without params and clears params on a plain change', () => {
  const { result, pushSpy } = setup('/admin/?menu=utm&q=old')
  pushSpy.mockClear()
  act(() => result.current.nav.setMenu('utm'))
  expect(pushSpy).not.toHaveBeenCalled()
  expect(result.current.param[0]).toBe('old')
  act(() => result.current.nav.setMenu('users'))
  expect(window.location.search).toBe('?menu=users&period=7d')
})
it('ignores an unknown menu even with params', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { result, pushSpy } = setup()
  pushSpy.mockClear()
  act(() => result.current.nav.setMenu('nope', { q: 'x' }))
  expect(pushSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/menu/NavContext.test.tsx` Expected: FAIL

- [ ] **Step 3: `NavValue.setMenu`와 구현을 고친다.** 예약어는 `RESERVED_PARAMS`로 거른다. 같은 메뉴 + `params` 있음은 `commit(..., 'replace')`, 다른 메뉴는 `commit(..., 'push')`. `setMenu`는 계속 안정된 참조여야 한다.

- [ ] **Step 4: README 3번 항목에 한 문장을 더한다.** "다른 메뉴를 페이지 상태와 함께 열려면 `useNav().setMenu(id, { key: 값 })`을 써요."

- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS

- [ ] **Step 6: Commit** — `feat(admin): let setMenu open a menu with page params`

---

### Task 4: 공용 검색창

**Files:**
- Create: `src/admin/pages/devtools/shared/SearchField.tsx`, `SearchField.test.tsx`, `search-field.css`

**Interfaces:**
- Produces:

```ts
export const SEARCH_COMMIT_DELAY_MS = 300
type SearchFieldProps = {
  label: string                 // 보이는 라벨
  placeholder?: string
  value: string | null          // URL 파라미터의 지금 값
  onCommit(value: string | null): void   // 빈 문자열은 null로 넘긴다
}
export function SearchField(props: SearchFieldProps): ReactElement
```

동작: 입력은 컴포넌트가 들고 있다. 마지막 입력 뒤 300ms, 포커스를 잃을 때, Enter에서 `onCommit`을 부른다. 한글 조합 중(`compositionstart`~`compositionend`)에는 부르지 않고, 조합이 끝나면 300ms를 다시 잰다. 이미 넘긴 값과 같으면 부르지 않는다. `value`가 바깥에서 바뀌어 마지막으로 넘긴 값과 다르면 입력을 그 값으로 바꾼다. 화면을 떠날 때 남은 타이머를 지운다(이때는 넘기지 않는다). `<input type="search">`이고 `<label>`로 감싼다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (가짜 타이머, `fireEvent`)

```ts
it('commits 300ms after the last keystroke, once', () => {
  // 'a','ab','abc'를 100ms 간격으로 입력 → 299ms까지 호출 없음 → 300ms에 onCommit('abc') 1회
})
it('commits at once on Enter and on blur, and not again when the timer fires', () => {})
it('commits null for an empty box', () => {})
it('does not commit during IME composition, then commits after it ends', () => {
  // compositionStart → change('ㅎ') → 500ms 경과: 호출 없음 → compositionEnd + change('한') → 300ms: onCommit('한')
})
it('takes an external value change', () => {
  // value='a'로 그림 → rerender(value='b') → input.value === 'b', onCommit 호출 없음
})
it('keeps what the user is typing when the parent echoes the committed value', () => {
  // 'ab' 입력 → commit → rerender(value='ab') → 그 사이 'abc'까지 쳤다면 input.value === 'abc'
})
it('clears its timer on unmount', () => {
  // 입력 뒤 unmount → 타이머를 다 돌려도 onCommit 호출 없음
})
it('has a visible label', () => {
  expect(screen.getByLabelText('이벤트 검색')).toHaveAttribute('type', 'search')
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/shared` Expected: FAIL

- [ ] **Step 3: 구현한다.** CSS 클래스는 `adm-devtools-search`, `adm-devtools-search__label`, `adm-devtools-search__input`. 입력의 `font-size: var(--adm-fs-md)`, `min-height: var(--adm-hit)`, 테두리와 포커스 모양은 `admin.css`의 `.adm-period__date`와 같은 토큰을 쓴다.

- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS

- [ ] **Step 5: Commit** — `feat(admin): add a debounced search field for devtools pages`

---

### Task 5: 스트림 상수와 응답 처리

스펙 §2의 "조회", "필터", "표", "변화 강조"를 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/event-stream/config.ts`, `report.ts`, `report.test.ts`, `__fixtures__/stream.json`, `__fixtures__/stream-empty.json`

**Interfaces:**
- Consumes: `eventLabel` (Task 1), `PropertyQuota`, `RunRealtimeReportRequest`, `RunReportResponse` (Task 2), `toRows` (`ga/reports/common.ts`)
- Produces:

```ts
// config.ts
export const BASE_INTERVAL_MS = 5_000
export const SAVING_INTERVAL_MS = 15_000
export const SLOW_INTERVAL_MS = 60_000
export const MAX_BACKOFF_MS = 60_000
export const IDLE_AFTER_MS = 10 * 60_000
export const SHARE_SAVING = 0.5
export const SHARE_SLOW = 0.2
export const SHARE_STOP = 0.05
export const REALTIME_LIMITS = { tokensPerHour: 40_000, tokensPerProjectPerHour: 14_000, tokensPerDay: 200_000 } as const
export const HIGHLIGHT_TTL_MS = 60_000
export const BASELINE_MAX_AGE_MS = 90_000
export const ROW_LIMIT = 250_000

// report.ts
export const NOT_SET = '(not set)'
export type StreamRow = { event: string; minutesAgo: number; platform: string; version: string; count: number }
export type StreamSnapshot = { rows: StreamRow[]; truncated: boolean; fetchedAt: number; quota: PropertyQuota | null }
export type DimFilter = { platform: string | null; version: string | null }
export type EventLine = {
  name: string; label: string; registered: boolean; watched: boolean
  now: number; last5: number; total: number
  perMinute: number[]            // 길이 30, 오래된 분이 먼저 (index 0 = 29분 전)
}
export type Change = { kind: 'new' | 'up'; delta: number }
export type Highlight = Change & { at: number }

export function buildStreamRequest(): RunRealtimeReportRequest
export function parseStream(res: RunReportResponse, fetchedAt: number): StreamSnapshot
export function filterOptions(s: StreamSnapshot, selected: DimFilter): { platforms: string[]; versions: string[] }
export function toLines(s: StreamSnapshot, dim: DimFilter, q: string, watch: readonly string[]): EventLine[]
export function diffSnapshots(prev: StreamSnapshot | null, next: StreamSnapshot, dim: DimFilter): Map<string, Change>
export function mergeHighlights(current: ReadonlyMap<string, Highlight>, changes: ReadonlyMap<string, Change>, now: number): Map<string, Highlight>
export function parseWatch(param: string | null): string[]
export function toggleWatch(watch: readonly string[], name: string): string | null   // URL에 쓸 값, 비면 null
```

규칙:
- `buildStreamRequest`: 스펙 "조회"의 값 그대로. `orderBys: [{ dimension: { dimensionName: 'minutesAgo', orderType: 'NUMERIC' } }]`, `limit: ROW_LIMIT`.
- `parseStream`: 빈 값과 `(not set)`인 `platform`, `appVersion`은 `NOT_SET`으로 합친다. `truncated`는 `(res.rowCount ?? 0) > rows.length`. `quota`는 `res.propertyQuota ?? null`.
- `filterOptions`: 스냅샷에 나온 값을 정렬해 돌려주고, `selected`의 값이 목록에 없으면 더한다.
- `toLines`: `dim`으로 거른 행을 이벤트별로 합친다. 정렬은 지켜보는 것 먼저, 그다음 `total` 내림차순, 같으면 이름 순. `q`는 이름과 라벨에서 대소문자 없이 **글자 그대로** 찾는다(정규식 아님). 지켜보는 이벤트는 `q`와 상관없이 포함하고, 스냅샷에 없으면 0으로 채운 줄을 만든다.
- `diffSnapshots`: `prev`가 `null`이거나 `next.fetchedAt - prev.fetchedAt > BASELINE_MAX_AGE_MS`이면 빈 맵. 그 밖에는 두 스냅샷을 같은 `dim`으로 합쳐서 비교한다. `prev`에 없던 이벤트는 `{ kind: 'new', delta: last5 }`, `last5`가 늘어난 이벤트는 `{ kind: 'up', delta: 늘어난 양 }`. 줄어든 것과 그대로인 것은 넣지 않는다.
- `mergeHighlights`: `now - at >= HIGHLIGHT_TTL_MS`인 것을 버린다. 남은 것에 `changes`를 더한다: 이미 있으면 `delta`를 더하고 `at`을 `now`로 바꾸며 `kind`는 기존 것이 `'new'`면 `'new'`로 둔다.
- `parseWatch`: 쉼표로 나누고 앞뒤 공백을 지우고 빈 조각과 중복을 버린다. 순서는 처음 나온 순서.

- [ ] **Step 1: fixture를 만든다.** `stream.json`은 `runRealtimeReport` 응답 모양(`dimensionHeaders`, `metricHeaders`, `rows`, `rowCount`, `propertyQuota`)이다. 내용: `screen_view`가 Android `1.4.0`에서 0분 전 3, 2분 전 4, 10분 전 5 / iOS `1.4.0`에서 1분 전 2 / `purchase_done`이 Android `1.5.0`에서 0분 전 1 / `session_start`가 iOS 빈 버전(`""`)에서 20분 전 1, Android `(not set)`에서 20분 전 2. `rowCount`는 행 수와 같게. `propertyQuota.tokensPerHour`는 `{ consumed: 3, remaining: 39000 }`. `stream-empty.json`은 `{}`.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```ts
it('builds the request', () => {
  expect(buildStreamRequest()).toEqual({
    dimensions: [{ name: 'eventName' }, { name: 'minutesAgo' }, { name: 'platform' }, { name: 'appVersion' }],
    metrics: [{ name: 'eventCount' }],
    minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
    orderBys: [{ dimension: { dimensionName: 'minutesAgo', orderType: 'NUMERIC' } }],
    limit: 250000,
  })
})
it('parses rows, merges empty and (not set), and reads quota', () => {
  const s = parseStream(stream, 1000)
  expect(s.fetchedAt).toBe(1000)
  expect(s.truncated).toBe(false)
  expect(s.quota?.tokensPerHour?.remaining).toBe(39000)
  expect(s.rows.filter((r) => r.event === 'session_start').map((r) => r.version)).toEqual(['(not set)', '(not set)'])
})
it('survives a response without rows, rowCount or quota', () => {
  expect(parseStream(empty, 5)).toEqual({ rows: [], truncated: false, fetchedAt: 5, quota: null })
})
it('flags truncation when rowCount exceeds the rows received', () => {
  expect(parseStream({ ...stream, rowCount: 999 }, 0).truncated).toBe(true)
})
it('lists filter options and keeps a selected value that is absent', () => {
  const s = parseStream(stream, 0)
  expect(filterOptions(s, { platform: null, version: null })).toEqual({
    platforms: ['Android', 'iOS'], versions: ['(not set)', '1.4.0', '1.5.0'],
  })
  expect(filterOptions(s, { platform: 'web', version: '9.9' }).platforms).toContain('web')
  expect(filterOptions(s, { platform: 'web', version: '9.9' }).versions).toContain('9.9')
})
it('sums now, last 5 minutes, 30 minutes and fills 30 buckets oldest first', () => {
  const [first] = toLines(parseStream(stream, 0), { platform: null, version: null }, '', [])
  expect(first).toMatchObject({ name: 'screen_view', label: '화면 조회', registered: true, now: 3, last5: 9, total: 14 })
  expect(first.perMinute).toHaveLength(30)
  expect(first.perMinute[29]).toBe(3)   // 0분 전
  expect(first.perMinute[28]).toBe(2)   // 1분 전
  expect(first.perMinute[19]).toBe(5)   // 10분 전
})
it('applies platform and version filters to the sums', () => {
  const lines = toLines(parseStream(stream, 0), { platform: 'iOS', version: null }, '', [])
  expect(lines.map((l) => [l.name, l.total])).toEqual([['screen_view', 2], ['session_start', 1]])
})
it('sorts watched first, then by 30-minute total, then by name', () => {
  const names = toLines(parseStream(stream, 0), { platform: null, version: null }, '', ['purchase_done']).map((l) => l.name)
  expect(names).toEqual(['purchase_done', 'screen_view', 'session_start'])
})
it('searches name and label literally and case-insensitively', () => {
  const s = parseStream(stream, 0)
  const dim = { platform: null, version: null }
  expect(toLines(s, dim, 'PURCHASE', []).map((l) => l.name)).toEqual(['purchase_done'])
  expect(toLines(s, dim, '화면', []).map((l) => l.name)).toEqual(['screen_view'])
  expect(() => toLines(s, dim, '([\\.', [])).not.toThrow()
  expect(toLines(s, dim, '([\\.', [])).toEqual([])
})
it('keeps watched events regardless of the search and adds a zero row when absent', () => {
  const lines = toLines(parseStream(stream, 0), { platform: null, version: null }, 'purchase', ['screen_view', 'not_yet'])
  expect(lines.map((l) => l.name)).toEqual(['screen_view', 'not_yet', 'purchase_done'])
  expect(lines[1]).toMatchObject({ watched: true, registered: false, now: 0, last5: 0, total: 0 })
  expect(lines[1].perMinute).toEqual(Array(30).fill(0))
})
it('diffs against the previous snapshot under the current filter', () => {
  const prev = parseStream(stream, 0)
  const next = parseStream(withExtra(stream, [['screen_view', 0, 'iOS', '1.4.0', 2], ['new_event', 0, 'Android', '1.5.0', 1]]), 5000)
  const all = diffSnapshots(prev, next, { platform: null, version: null })
  expect(all.get('screen_view')).toEqual({ kind: 'up', delta: 2 })
  expect(all.get('new_event')).toEqual({ kind: 'new', delta: 1 })
  expect(all.has('purchase_done')).toBe(false)
  // Android만 보면 screen_view는 그대로다
  expect(diffSnapshots(prev, next, { platform: 'Android', version: null }).has('screen_view')).toBe(false)
})
it('reports nothing without a baseline or with a stale one', () => {
  const next = parseStream(stream, 100_000)
  expect(diffSnapshots(null, next, { platform: null, version: null }).size).toBe(0)
  expect(diffSnapshots(parseStream(empty, 9_999), next, { platform: null, version: null }).size).toBe(0)   // 90,001ms 차이
  expect(diffSnapshots(parseStream(empty, 10_000), next, { platform: null, version: null }).size).toBe(3)  // 정확히 90,000ms
})
it('keeps highlights for 60 seconds and accumulates repeats', () => {
  let h = mergeHighlights(new Map(), new Map([['a', { kind: 'new', delta: 1 }]]), 1000)
  h = mergeHighlights(h, new Map([['a', { kind: 'up', delta: 2 }]]), 31_000)
  expect(h.get('a')).toEqual({ kind: 'new', delta: 3, at: 31_000 })
  expect(mergeHighlights(h, new Map(), 90_999).has('a')).toBe(true)
  expect(mergeHighlights(h, new Map(), 91_000).has('a')).toBe(false)
})
it('parses and toggles the watch param', () => {
  expect(parseWatch(null)).toEqual([])
  expect(parseWatch(',a,,a, b')).toEqual(['a', 'b'])
  expect(toggleWatch(['a', 'b'], 'a')).toBe('b')
  expect(toggleWatch(['a'], 'c')).toBe('a,c')
  expect(toggleWatch(['a'], 'a')).toBeNull()
})
```

`withExtra(res, rows)`는 테스트 파일 안의 도우미다. fixture의 `rows`에 `[event, minutesAgo, platform, version, count]` 행을 더하고 `rowCount`를 맞춘다.

- [ ] **Step 3: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-stream/report.test.ts` Expected: FAIL

- [ ] **Step 4: `config.ts`와 `report.ts`를 구현한다.**

- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS

- [ ] **Step 6: Commit** — `feat(admin): parse, aggregate and diff the realtime event stream`

---

### Task 6: 주기 정책

스펙 §2의 "주기 정책"을 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/event-stream/pollPolicy.ts`, `pollPolicy.test.ts`

**Interfaces:**
- Consumes: `config.ts` 상수 (Task 5), `PropertyQuota` (Task 2)
- Produces:

```ts
export type PollReason =
  | 'paused' | 'hidden' | 'quota_exhausted' | 'bad_request' | 'quota_stop'
  | 'retrying' | 'quota_slow' | 'idle' | 'quota_saving' | 'normal'
export type PollInput = {
  quotaShare: number | null
  visible: boolean
  paused: boolean
  idleMs: number
  failures: number
  blocked: 'quota' | 'bad_request' | null
}
export type PollDecision = { intervalMs: number | null; reason: PollReason }
export function quotaShare(q: PropertyQuota | null): number | null
export function decidePoll(input: PollInput): PollDecision
export function reasonText(d: PollDecision): string
```

- `quotaShare`: `q`가 `null`이면 `null`. 세 항목 각각 `remaining / REALTIME_LIMITS[항목]`을 0~1로 자른 값 중 최소. 세 항목이 다 없으면 `1`.
- `decidePoll`: 스펙의 멈춤 표(위에서부터) → 평소 주기 표(위에서부터) → 실패가 있으면 `min(MAX_BACKOFF_MS, max(평소 주기, BASE_INTERVAL_MS × 2^failures))`에 `reason: 'retrying'`. `quotaShare`가 `null`이면 한도 조건은 모두 건너뛴다.
- `reasonText`: 스펙 표의 문구. `'normal'`은 `` `${intervalMs / 1000}초마다 갱신 중` ``, `'hidden'`은 빈 문자열.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const ok: PollInput = { quotaShare: 1, visible: true, paused: false, idleMs: 0, failures: 0, blocked: null }

it.each<[string, Partial<PollInput>, number | null, PollReason]>([
  ['normal', {}, 5000, 'normal'],
  ['unknown quota', { quotaShare: null }, 5000, 'normal'],
  ['paused', { paused: true }, null, 'paused'],
  ['paused beats hidden', { paused: true, visible: false }, null, 'paused'],
  ['hidden', { visible: false }, null, 'hidden'],
  ['quota error', { blocked: 'quota' }, null, 'quota_exhausted'],
  ['bad request', { blocked: 'bad_request' }, null, 'bad_request'],
  ['below 5%', { quotaShare: 0.049 }, null, 'quota_stop'],
  ['exactly 5%', { quotaShare: 0.05 }, 60000, 'quota_slow'],
  ['below 20%', { quotaShare: 0.199 }, 60000, 'quota_slow'],
  ['exactly 20%', { quotaShare: 0.2 }, 15000, 'quota_saving'],
  ['below 50%', { quotaShare: 0.499 }, 15000, 'quota_saving'],
  ['exactly 50%', { quotaShare: 0.5 }, 5000, 'normal'],
  ['idle for 10 minutes exactly', { idleMs: 600_000 }, 5000, 'normal'],
  ['idle beyond 10 minutes', { idleMs: 600_001 }, 60000, 'idle'],
  ['low quota beats idle', { quotaShare: 0.1, idleMs: 700_000 }, 60000, 'quota_slow'],
  ['idle beats saving', { quotaShare: 0.4, idleMs: 700_000 }, 60000, 'idle'],
  ['one failure', { failures: 1 }, 10000, 'retrying'],
  ['three failures', { failures: 3 }, 40000, 'retrying'],
  ['backoff is capped', { failures: 9 }, 60000, 'retrying'],
  ['a failure never speeds up a slow interval', { failures: 1, quotaShare: 0.1 }, 60000, 'retrying'],
  ['a failure while saving', { failures: 1, quotaShare: 0.4 }, 15000, 'retrying'],
  ['stop beats failures', { failures: 2, quotaShare: 0.01 }, null, 'quota_stop'],
])('%s', (_name, patch, intervalMs, reason) => {
  expect(decidePoll({ ...ok, ...patch })).toEqual({ intervalMs, reason })
})

it('takes the tightest of the three limits', () => {
  expect(quotaShare(null)).toBeNull()
  expect(quotaShare({})).toBe(1)
  expect(quotaShare({ tokensPerHour: { consumed: 3, remaining: 20_000 } })).toBe(0.5)
  expect(quotaShare({
    tokensPerHour: { consumed: 3, remaining: 36_000 },          // 0.9
    tokensPerProjectPerHour: { consumed: 3, remaining: 1_400 }, // 0.1
    tokensPerDay: { consumed: 3, remaining: 100_000 },          // 0.5
  })).toBeCloseTo(0.1)
  // consumed는 요청 하나가 쓴 양이라 계산에 쓰지 않는다
  expect(quotaShare({ tokensPerDay: { consumed: 50_000, remaining: 150_000 } })).toBe(0.75)
  expect(quotaShare({ tokensPerDay: { consumed: 0, remaining: 999_999 } })).toBe(1)
})

it('words every reason', () => {
  expect(reasonText({ intervalMs: 5000, reason: 'normal' })).toBe('5초마다 갱신 중')
  expect(reasonText({ intervalMs: null, reason: 'paused' })).toBe('일시정지했어요')
  expect(reasonText({ intervalMs: null, reason: 'hidden' })).toBe('')
  expect(reasonText({ intervalMs: null, reason: 'quota_exhausted' })).toBe('실시간 조회 한도를 다 써서 자동 갱신을 멈췄어요. 한 시간쯤 뒤에 다시 시도해 주세요.')
  expect(reasonText({ intervalMs: null, reason: 'bad_request' })).toBe('불러오지 못했어요. 자동 갱신을 멈췄어요.')
  expect(reasonText({ intervalMs: null, reason: 'quota_stop' })).toBe('실시간 조회 한도가 거의 남지 않아서 자동 갱신을 멈췄어요')
  expect(reasonText({ intervalMs: 10000, reason: 'retrying' })).toBe('불러오지 못해서 다시 시도하고 있어요')
  expect(reasonText({ intervalMs: 60000, reason: 'quota_slow' })).toBe('실시간 조회 한도가 얼마 남지 않아서 1분마다 갱신해요')
  expect(reasonText({ intervalMs: 60000, reason: 'idle' })).toBe('한동안 조작이 없어서 1분마다 갱신해요')
  expect(reasonText({ intervalMs: 15000, reason: 'quota_saving' })).toBe('실시간 조회 한도를 아끼려고 15초마다 갱신해요')
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-stream/pollPolicy.test.ts` Expected: FAIL

- [ ] **Step 3: 구현한다.**

- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS

- [ ] **Step 5: Commit** — `feat(admin): add the quota-aware polling policy for the event stream`

---

### Task 7: 스트림 훅

스펙 §2의 "조회"(react-query 설정), "주기 정책"(세부 규칙), "변화 강조"를 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/event-stream/useEventStream.ts`, `useEventStream.test.tsx`

**Interfaces:**
- Consumes: `useGa().client.runRealtimeReport` (Task 2), `buildStreamRequest`, `parseStream`, `diffSnapshots`, `mergeHighlights`, `StreamSnapshot`, `Highlight`, `DimFilter` (Task 5), `decidePoll`, `quotaShare`, `PollDecision` (Task 6), `GaError` (`ga/errors.ts`)
- Produces:

```ts
export type EventStream = {
  snapshot: StreamSnapshot | undefined
  highlights: ReadonlyMap<string, Highlight>
  decision: PollDecision
  isPending: boolean            // 첫 응답 전
  error: unknown                // 보여 줄 표가 없을 때만 값이 있다. 표가 있으면 null
  paused: boolean
  setPaused(paused: boolean): void
  refreshNow(): void
}
export function useEventStream(dim: DimFilter): EventStream
```

정한 것:
- `useQuery({ queryKey: ['event-stream'], staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false, refetchIntervalInBackground: false, refetchInterval: decision.intervalMs ?? false })`.
- `queryFn`은 `parseStream(await client.runRealtimeReport(buildStreamRequest()), Date.now())`를 돌려준다.
- 성공하면: 연속 실패를 0으로, `blocked`를 `null`로 돌리고, `diffSnapshots(직전 스냅샷, 새 스냅샷, 지금 dim)`의 결과를 `mergeHighlights`로 합친다. 직전 스냅샷은 이 훅이 마운트된 뒤 받은 것만 쓴다.
- 실패하면 `GaError.kind`로 가른다: `network`/`server`는 연속 실패 +1, `quota`는 `blocked: 'quota'`, `bad_request`는 `blocked: 'bad_request'`, `auth`/`forbidden`과 그 밖은 아무것도 바꾸지 않는다.
- `visible`은 `document.visibilityState`와 `visibilitychange`로 따른다. 다시 보이게 됐을 때 `decidePoll`의 결과가 멈춤이 아니면 바로 한 번 조회한다.
- 조작은 `document`의 `pointerdown`, `keydown`, `wheel`, `scroll`(모두 `passive`, `scroll`은 `capture`)이다. 마지막 조작 뒤 `IDLE_AFTER_MS`가 지나면 다시 그려서 주기가 느려지게 한다(조작마다 다시 그리지 않는다. 타이머 하나를 다시 건다). 느려진 상태에서 조작이 생기면 원래 주기로 돌아오고, 스냅샷이 `BASE_INTERVAL_MS`보다 오래됐으면 바로 한 번 조회한다.
- `refreshNow`는 일시정지와 멈춤 상태에서도 조회한다.
- 만료된 강조를 지우기 위한 타이머는 두지 않는다. 강조는 조회가 성공할 때 정리되고, 표가 그릴 때 `at`으로 한 번 더 거른다(Task 8).
- `StrictMode`에서 리스너와 타이머가 한 벌만 남는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `renderHook`, 가짜 타이머(`vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })`), `useGa`를 mock해서 `client.runRealtimeReport`를 `vi.fn()`으로 둔다. `document.visibilityState`는 `Object.defineProperty`로 바꾸고 `visibilitychange`를 직접 보낸다. fixture는 Task 5의 것을 쓴다.

```ts
it('fetches on mount and then every 5 seconds', async () => {
  // 마운트 → 호출 1회 → 5초 뒤 2회 → 5초 뒤 3회. decision은 { intervalMs: 5000, reason: 'normal' }
})
it('slows to 15 seconds when under half the hourly quota is left', async () => {
  // 응답의 tokensPerHour.remaining = 19_000 → decision.reason 'quota_saving' → 5초 뒤 호출 없음, 15초 뒤 호출
})
it('stops when paused, still fetches on refreshNow, resumes on unpause', async () => {})
it('stops while hidden and fetches at once when visible again', async () => {})
it('does not fetch on becoming visible while paused', async () => {})
it('backs off after network errors and recovers after a success', async () => {
  // GaError('network') 2번 → decision { intervalMs: 20000, reason: 'retrying' }, error는 null(표가 이미 있음)
  // 성공 → decision.reason 'normal'
})
it('exposes the error only when there is no snapshot yet', async () => {
  // 첫 조회가 GaError('server') → error가 그 오류, isPending false
})
it('stops on a quota error until a manual refresh succeeds', async () => {
  // GaError('quota') → decision { intervalMs: null, reason: 'quota_exhausted' } → 60초 지나도 호출 없음
  // refreshNow() 성공 → decision.reason 'normal'
})
it('stops on bad_request', async () => {})
it('does not count auth errors as failures', async () => {
  // GaError('auth') → decision.reason은 'retrying'이 아니다
})
it('slows down after 10 idle minutes and catches up on activity', async () => {
  // 10분 + 1ms 경과 → decision.reason 'idle' → pointerdown → decision.reason 'normal'이고 호출이 즉시 1회 늘어난다
})
it('highlights events that appear or grow between polls, under the current filter', async () => {
  // 1번째 응답 stream, 2번째 응답 withExtra(...) → highlights.get('new_event') 는 { kind: 'new', delta: 1, at: <2번째 fetchedAt> }
  // 1번째 조회 뒤에는 highlights.size === 0
})
it('runs one timer and one set of listeners under StrictMode and cleans up on unmount', async () => {
  // StrictMode wrapper로 마운트 → 5초에 호출이 정확히 1회 늘어난다
  // unmount 뒤 document.removeEventListener가 붙인 종류마다 불렸고, 60초를 돌려도 호출이 늘지 않는다
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-stream/useEventStream.test.tsx` Expected: FAIL

- [ ] **Step 3: 구현한다.**

- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS

- [ ] **Step 5: Commit** — `feat(admin): poll the realtime event stream with the adaptive policy`

---

### Task 8: 스트림 화면

스펙 §2 전체를 읽는다. 문구, 표의 열, 상태별 화면, "모바일과 접근성"은 스펙을 그대로 따른다.

**Files:**
- Create: `src/admin/pages/devtools/event-stream/StreamStatus.tsx`, `StreamTable.tsx`, `EventStreamPage.tsx`, `EventStreamPage.menu.ts`, `EventStreamPage.test.tsx`, `event-stream.css`

**Interfaces:**
- Consumes: `useEventStream`, `EventStream` (Task 7), `toLines`, `filterOptions`, `parseWatch`, `toggleWatch`, `EventLine`, `Highlight`, `NOT_SET` (Task 5), `reasonText` (Task 6), `SearchField` (Task 4), `usePageParam`, `useNav` (Task 3), `Card`, `CardState`, `displayDim`, `formatNumber`
- Produces: `export function EventStreamPage(): ReactElement`, 메뉴 정의(스펙 §2 "메뉴" 표의 값, 아이콘은 `lucide-react`의 `Radio`)

컴포넌트 경계:
- `StreamStatus({ decision, updatedAt, paused, onPause, onRefresh, snapshot })`: 상태 줄. 주기 문장은 `role="status"` 안에, "마지막 갱신 HH:mm:ss"(서울 시간)는 그 밖에 둔다. `import.meta.env.DEV`일 때만 진단 줄을 그린다: 직전 요청이 쓴 토큰(`quota.tokensPerHour.consumed`), 세 한도의 `remaining`, 받은 행 수.
- `StreamTable({ lines, highlights, onToggleWatch, onOpenDictionary })`: 표. `<tr key={line.name}>`. 1초마다 다시 그려서 "n초 전"을 갱신하고 `HIGHLIGHT_TTL_MS`가 지난 강조를 숨긴다(타이머는 보이는 강조가 있을 때만 돈다). 추이 막대는 `aria-hidden`인 인라인 SVG이고 막대 30개, 높이는 그 줄의 최댓값 대비다.
- `EventStreamPage`: `usePageParam`으로 `q`, `platform`, `ver`, `watch`를 읽고 쓴다. 빈 상태와 안내 문구를 그린다. 지켜보는 이벤트에 변화가 있을 때만 `aria-live="polite"` 영역에 "<라벨> n번 더 들어왔어요"(`'new'`면 "<라벨> 새로 들어왔어요")를 쓴다.

정한 것:
- 플랫폼과 앱 버전 선택 상자의 첫 항목은 `전체`(값 `''` → 파라미터 `null`)다. `NOT_SET`은 `알 수 없음`으로 보인다.
- 별 버튼의 이름은 `` `${line.name} 지켜보기` ``, `aria-pressed`를 쓴다. 아이콘은 `lucide-react`의 `Star`이고 켜졌을 때 `fill="currentColor"`다.
- 강조 문구: `'new'`는 태그 `새로 들어옴 · n초 전`, `'up'`은 텍스트 `▲ +n · m초 전`.
- `사전에서 보기`는 `registered`가 `false`인 줄에만 있고 `setMenu('event-dictionary', { event: line.name })`을 부른다.
- 첫 조회 실패가 `GaError`의 `quota`면 `CardState` 대신 `reasonText({ intervalMs: null, reason: 'quota_exhausted' })`와 `다시 시도` 버튼을 그린다. 그 밖의 첫 조회 중과 실패는 `CardState`(`isEmpty={false}`)에 맡긴다.
- 카드 제목은 `최근 30분 이벤트`.
- 이 메뉴는 `usesGa: false`지만 `useGa()`를 쓴다. 구현 전에 `src/admin/App.tsx`에서 `GaProvider`가 `usesGa`와 상관없이 모든 페이지를 감싸는지 확인한다. 감싸지 않으면 멈추고 보고한다(셸을 고쳐야 한다는 뜻이다).

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`EventStreamPage.test.tsx`). `NavProvider`에 두 메뉴를 아는 `lookup`을 넘기고 `window.history.replaceState`로 URL을 정한다.

```ts
it('lists events with now, 5-minute and 30-minute counts', async () => {
  // 행 이름 '화면 조회' 안에 'screen_view', 셀 3 / 9 / 14
})
it('shows the status line and the last update outside the live region', async () => {
  // getByRole('status')에 '5초마다 갱신 중', 그 안에 '마지막 갱신'은 없다
})
it('filters by platform without another request', async () => {
  // 플랫폼을 iOS로 → screen_view 30분 값 2, runRealtimeReport 호출 수 그대로, URL에 platform=iOS
})
it('reads filters from the URL and keeps an absent selected value in the list', async () => {
  // /admin/?menu=event-stream&platform=web → 플랫폼 선택 값 'web', '조건에 맞는 이벤트가 없어요'
})
it('clears q, platform and ver but keeps watch', async () => {
  // '필터 지우기' → URL은 ?menu=event-stream&watch=screen_view
})
it('pins watched events, shows a zero row for one that has not arrived, and ignores the search for them', async () => {
  // ?watch=not_yet&q=purchase → 첫 행 not_yet(0, 0, 0), 다음 purchase_done
})
it('normalises a messy watch param when a star is pressed', async () => {
  // ?watch=,a,,a, b → 'screen_view 지켜보기' 누름 → URL의 watch 값은 'a,b,screen_view'
})
it('keeps focus on the star after the row moves to the top', async () => {})
it('tags new and grown events and announces only watched ones', async () => {
  // 2번째 응답에 new_event와 screen_view +2, watch=screen_view
  // '새로 들어옴' 태그, '▲ +2' 텍스트, live 영역에는 '화면 조회 2번 더 들어왔어요'만
})
it('drops a highlight 60 seconds after it appeared', async () => {})
it('pauses and resumes', async () => {
  // '일시정지' → 버튼이 '다시 시작', 상태 '일시정지했어요', 10초 지나도 호출 없음
})
it('keeps the table when a refresh fails', async () => {
  // 2번째 조회 GaError('network') → 표는 그대로, 상태 '불러오지 못해서 다시 시도하고 있어요'
})
it('shows the realtime quota message when the first load hits the quota', async () => {
  // '실시간 조회 한도를 다 써서 …'가 보이고 '오늘 조회 한도'는 없다
})
it('shows the empty state when nothing arrived in 30 minutes', async () => {
  // '최근 30분 동안 들어온 이벤트가 없어요. 앱에서 이벤트를 보내면 여기에 나타나요.'
})
it('warns when rows were truncated', async () => {
  // '이벤트가 많아서 오래된 기록 일부가 빠졌어요. 30분 횟수가 실제보다 적을 수 있어요.'
})
it('opens the dictionary on the event', async () => {
  // purchase_done의 '사전에서 보기' → URL은 ?menu=event-dictionary&period=7d&event=purchase_done
})
it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'event-stream', group: 'devtools', order: 210, label: '실시간 이벤트', usesPeriod: false, usesGa: false })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-stream/EventStreamPage.test.tsx` Expected: FAIL

- [ ] **Step 3: 컴포넌트와 메뉴 정의를 구현한다.**

- [ ] **Step 4: `event-stream.css`를 쓴다.** 클래스는 모두 `adm-event-stream-`으로 시작한다. 960px 미만: 추이 열을 숨기고, 이벤트 칸은 `white-space: normal`, 태그와 강조는 이름 아래 줄. 별 버튼과 `사전에서 보기`는 `min-width`/`min-height: var(--adm-hit)`. 선택 상자의 글자 크기는 `var(--adm-fs-md)`. 강조된 줄의 배경은 `var(--adm-accent-soft)`에서 투명으로 가는 애니메이션이고 `prefers-reduced-motion: reduce`에서 끈다. 추이 막대의 색은 `var(--adm-accent)`.

- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS. 레지스트리 테스트(`src/admin/menu/registry.test.ts`)가 새 메뉴와 함께 통과한다.

- [ ] **Step 6: Commit** — `feat(admin): add the realtime event stream page`

---

### Task 9: 실제 호출로 확인 (사람이 한다)

스펙 §8. 구현자가 혼자 끝낼 수 없다. 사용자에게 요청하고 답을 기다린다.

- [ ] **Step 1: 사용자에게 요청한다.** `npm run dev`로 어드민을 열고 `실시간 이벤트` 메뉴에서 아래를 확인해 달라고 한다.
  1. 앱에서 이벤트를 보낸 뒤 화면에 나타날 때까지 걸린 시간(초)
  2. 진단 줄의 "직전 요청이 쓴 토큰" 값(여러 번 본 값의 범위)과 받은 행 수
  3. 세 한도의 남은 양
- [ ] **Step 2: 결과로 `config.ts`를 정한다.** 스펙 §8의 표대로다. 반영 지연이 10초를 넘으면 `BASE_INTERVAL_MS`를 그 값으로 올린다. `(3600_000 / BASE_INTERVAL_MS) × 요청당 토큰`이 7,000을 넘으면 넘지 않을 때까지 `BASE_INTERVAL_MS`를 올린다. `SAVING_INTERVAL_MS`가 `BASE_INTERVAL_MS`보다 작아지면 같은 값으로 맞춘다. 상수를 바꾸면 `pollPolicy.test.ts`와 페이지 테스트의 숫자도 같이 바꾼다.
- [ ] **Step 3: 스펙 §8에 측정값과 정한 상수를 적는다.**
- [ ] **Step 4: 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `chore(admin): set the event stream intervals from measured quota cost`

사용자가 바로 확인할 수 없으면 이 Task를 건너뛰고 Task 10으로 간다. 건너뛴 사실은 마지막 보고에 적는다.

---

### Task 10: 사전의 응답 처리

스펙 §3의 "원본 네 가지"를 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/event-dictionary/report.ts`, `report.test.ts`, `__fixtures__/observed.json`, `recent.json`, `metadata.json`

**Interfaces:**
- Consumes: 타입 (Task 2), `toRows`, `DateRange` (`lib/period.ts`)
- Produces:

```ts
export type PlatformCount = { platform: string; count: number; users: number }
export type Observed = ReadonlyMap<string, { count: number; users: number; byPlatform: PlatformCount[] }>
export type Recent = ReadonlyMap<string, { platform: string; count: number }[]>
export type GaParam = { name: string; uiName: string; description: string; kind: 'dimension' | 'metric' }

export function buildObservedRequest(current: DateRange): RunReportRequest
export function parseObserved(res: RunReportResponse): Observed
export function buildRecentRequest(): RunRealtimeReportRequest
export function parseRecent(res: RunReportResponse): Recent
export function parseMetadata(meta: Metadata): GaParam[]
```

- `parseObserved`: 이벤트별 `count`와 `users`는 플랫폼별 값을 더한 것이다. `byPlatform`은 `count` 내림차순.
- `parseMetadata`: `dimensions`와 `metrics`에서 `apiName`이 `customEvent:`로 시작하는 것만 고르고 접두사를 뗀 이름으로 돌려준다. 이름 순 정렬. `uiName`, `description`이 없으면 빈 문자열.

- [ ] **Step 1: fixture를 만든다.** `observed.json`: `screen_view` Android 100/40, iOS 60/25, `purchase_done` Android 30/10, iOS 11/5, `only_android` Android 7/3, `typo_evnt` Android 2/1 (횟수/사람 수). `recent.json`: `screen_view` Android 3, `today_only` iOS 1. `metadata.json`: `dimensions`에 `customEvent:item_id`(uiName `상품 ID`, customDefinition true)와 `eventName`, `metrics`에 `customEvent:price`(uiName `가격`)와 `eventCount`.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```ts
it('builds the observed request for the current range only', () => {
  expect(buildObservedRequest({ startDate: '2026-10-01', endDate: '2026-10-07' })).toEqual({
    dateRanges: [{ startDate: '2026-10-01', endDate: '2026-10-07' }],
    dimensions: [{ name: 'eventName' }, { name: 'platform' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    limit: 10000,
  })
})
it('sums platforms per event', () => {
  const o = parseObserved(observed)
  expect(o.get('screen_view')).toEqual({
    count: 160, users: 65,
    byPlatform: [{ platform: 'Android', count: 100, users: 40 }, { platform: 'iOS', count: 60, users: 25 }],
  })
  expect(o.size).toBe(4)
})
it('builds the recent request', () => {
  expect(buildRecentRequest()).toEqual({
    dimensions: [{ name: 'eventName' }, { name: 'platform' }],
    metrics: [{ name: 'eventCount' }],
    minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
    limit: 10000,
  })
})
it('parses recent events by platform', () => {
  expect(parseRecent(recent).get('today_only')).toEqual([{ platform: 'iOS', count: 1 }])
})
it('survives empty responses', () => {
  expect(parseObserved({}).size).toBe(0)
  expect(parseRecent({}).size).toBe(0)
  expect(parseMetadata({})).toEqual([])
})
it('picks customEvent params from both dimensions and metrics', () => {
  expect(parseMetadata(metadata)).toEqual([
    { name: 'item_id', uiName: '상품 ID', description: '', kind: 'dimension' },
    { name: 'price', uiName: '가격', description: '', kind: 'metric' },
  ])
})
```

- [ ] **Step 3: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-dictionary/report.test.ts` Expected: FAIL
- [ ] **Step 4: 구현한다.**
- [ ] **Step 5: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 6: Commit** — `feat(admin): parse observed events and GA metadata for the event dictionary`

---

### Task 11: 사전 판정

스펙 §3의 "이벤트 상태", "상태 버튼", "검색", "이벤트 표"(정렬), "CSV"를 읽는다.

**Files:**
- Create: `src/admin/pages/devtools/event-dictionary/dictionary.ts`, `dictionary.test.ts`

**Interfaces:**
- Consumes: `CatalogEvent`, `EventPlatform`, `targetPlatforms` (Task 1), `Observed`, `Recent`, `PlatformCount`, `GaParam` (Task 10)
- Produces:

```ts
export type EventStatus = 'unknown' | 'missing' | 'partial' | 'undocumented' | 'ok'
export type ProblemStatus = Exclude<EventStatus, 'ok'>
export const STATUS_LABEL: Record<EventStatus, string>
// { unknown: '사전에 없음', missing: '안 들어옴', partial: '일부 플랫폼만', undocumented: '설명 없음', ok: '정상' }

export type DictionaryEntry = {
  name: string
  label: string                  // 카탈로그 라벨, 없거나 비면 name
  catalog: CatalogEvent | null
  status: EventStatus
  count: number | null           // 기간 횟수. 기간 관측이 없으면 null
  users: number | null
  byPlatform: PlatformCount[]
  recent: { platform: string; count: number }[]
  recentOnly: boolean            // 기간에는 없고 최근 30분에만 있다
  missingPlatforms: EventPlatform[]
}
export function buildDictionary(input: {
  catalog: readonly CatalogEvent[]
  observed: Observed | null      // null: 조회 중이거나 실패했거나 기간이 잘못됨
  recent: Recent | null          // null: 조회 중이거나 실패
}): DictionaryEntry[]
export function statusCounts(entries: readonly DictionaryEntry[], observedKnown: boolean):
  { all: number } & Record<ProblemStatus, number | null>
export function parseStatus(param: string | null): ProblemStatus | null
export function filterEntries(entries: readonly DictionaryEntry[], f: { q: string; status: ProblemStatus | null }): DictionaryEntry[]
export function catalogSnippet(name: string): string
export function unlistedParams(params: readonly GaParam[], catalog: readonly CatalogEvent[]): Set<string>
export function toCsvRows(entries: readonly DictionaryEntry[]): (string | number)[][]
export const CSV_HEADERS: string[]
// ['이벤트 이름', '한글 라벨', '구분', '상태', '횟수', '사람 수', '설명', '파라미터']
```

규칙:
- `observed`가 `null`이면 항목은 카탈로그의 이벤트뿐이고, 상태는 `undocumented`나 `ok`만 나온다. `recent`는 `recent` 필드를 채우는 데만 쓴다.
- `observed`가 있으면 카탈로그, `observed`, `recent`의 이름을 합친다. "들어옴"은 `observed`나 `recent`에 있다는 뜻이다. 플랫폼별 "들어옴"도 둘을 합쳐 본다.
- 상태는 스펙 표의 순서대로 매긴다. `kind: 'auto'`는 `missing`과 `partial`이 되지 않는다.
- 정렬: 문제 상태(`unknown`, `missing`, `partial`, `undocumented` 순서가 아니라 "문제가 있다/없다"만 본다)가 먼저, 그 안에서 `count` 내림차순(`null`은 0), 같으면 이름 순.
- `statusCounts`: `observedKnown`이 `false`면 `unknown`, `missing`, `partial`은 `null`.
- `filterEntries`의 `q`: 이름, 라벨, 설명, 파라미터 이름에서 대소문자 없이 글자 그대로 찾는다.
- `catalogSnippet('purchase_done')`은 정확히 `{ name: 'purchase_done', label: '', description: '', kind: 'app', params: [] },`.
- `unlistedParams`: 카탈로그의 어느 이벤트에도 없는 GA 파라미터 이름.
- `toCsvRows`의 구분 칸: `자동 수집`, `앱 정의`, 카탈로그에 없으면 빈 문자열. 횟수와 사람 수가 `null`이면 빈 문자열. 파라미터는 이름을 `, `로 잇는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 테스트 안에서 작은 카탈로그를 만든다.

```ts
const cat: CatalogEvent[] = [
  { name: 'screen_view', label: '화면 조회', description: '화면을 볼 때 기록돼요.', kind: 'auto', params: [] },
  { name: 'app_remove', label: '앱 삭제', description: '앱을 지울 때 기록돼요.', kind: 'auto', params: [] },
  { name: 'purchase_done', label: '구매 완료', description: '구매가 끝나면 기록돼요.', kind: 'app',
    params: [{ name: 'item_id', type: 'string', description: '상품 ID' }] },
  { name: 'only_android', label: '안드로이드 전용', description: '', kind: 'app', params: [], platforms: ['Android'] },
  { name: 'both_needed', label: '둘 다', description: '둘 다 보내요.', kind: 'app', params: [] },
  { name: 'never_sent', label: '', description: '설명이 있어요.', kind: 'app', params: [] },
]
// observed: screen_view(A 100/40, i 60/25), purchase_done(A 30/10, i 11/5), only_android(A 7/3), both_needed(A 5/2), typo_evnt(A 2/1)
// recent:   today_only(iOS), both_needed(iOS)

it('assigns one status per event in the spec order', () => {
  const byName = Object.fromEntries(buildDictionary({ catalog: cat, observed, recent }).map((e) => [e.name, e.status]))
  expect(byName).toEqual({
    typo_evnt: 'unknown',
    today_only: 'unknown',
    never_sent: 'missing',
    only_android: 'undocumented',   // 대상 플랫폼은 Android뿐이라 partial이 아니다
    both_needed: 'ok',              // iOS는 최근 30분에 들어왔다
    purchase_done: 'ok',
    screen_view: 'ok',
    app_remove: 'ok',               // 자동 수집은 안 들어와도 missing이 아니다
  })
})
it('marks a partial platform and lists what is missing', () => {
  const e = buildDictionary({ catalog: cat, observed, recent: new Map() }).find((x) => x.name === 'both_needed')!
  expect(e.status).toBe('partial')
  expect(e.missingPlatforms).toEqual(['iOS'])
})
it('flags events seen only in the last 30 minutes', () => {
  const e = buildDictionary({ catalog: cat, observed, recent }).find((x) => x.name === 'today_only')!
  expect(e).toMatchObject({ recentOnly: true, count: 0, catalog: null, label: 'today_only' })
})
it('does not judge arrival without period observation', () => {
  const entries = buildDictionary({ catalog: cat, observed: null, recent })
  expect(entries.map((e) => e.name).sort()).toEqual(cat.map((e) => e.name).sort())
  expect(new Set(entries.map((e) => e.status))).toEqual(new Set(['undocumented', 'ok']))
  expect(entries.every((e) => e.count === null)).toBe(true)
})
it('judges with period data alone when recent is missing', () => {
  const e = buildDictionary({ catalog: cat, observed, recent: null }).find((x) => x.name === 'both_needed')!
  expect(e.status).toBe('partial')
})
it('uses the name when the label is empty', () => {
  expect(buildDictionary({ catalog: cat, observed, recent }).find((x) => x.name === 'never_sent')!.label).toBe('never_sent')
})
it('sorts problems first, then by count, then by name', () => {
  const names = buildDictionary({ catalog: cat, observed, recent }).map((e) => e.name)
  // 문제 있는 것들이 정상인 것들보다 앞이고, 각 묶음 안에서는 횟수 내림차순, 같으면 이름 순
  expect(names.indexOf('typo_evnt')).toBeLessThan(names.indexOf('screen_view'))
  expect(names.slice(-1)).toEqual(['app_remove'])
})
it('counts statuses and hides the unknowable ones before observation', () => {
  const entries = buildDictionary({ catalog: cat, observed, recent })
  expect(statusCounts(entries, true)).toEqual({ all: 8, unknown: 2, missing: 1, partial: 0, undocumented: 1 })
  expect(statusCounts(buildDictionary({ catalog: cat, observed: null, recent: null }), false))
    .toEqual({ all: 6, unknown: null, missing: null, partial: null, undocumented: 1 })
})
it('parses the status param', () => {
  expect(parseStatus('unknown')).toBe('unknown')
  expect(parseStatus('ok')).toBeNull()
  expect(parseStatus('nope')).toBeNull()
  expect(parseStatus(null)).toBeNull()
})
it('filters by status and searches name, label, description and param names literally', () => {
  const entries = buildDictionary({ catalog: cat, observed, recent })
  expect(filterEntries(entries, { q: '', status: 'unknown' }).map((e) => e.name).sort()).toEqual(['today_only', 'typo_evnt'])
  expect(filterEntries(entries, { q: 'ITEM_ID', status: null }).map((e) => e.name)).toEqual(['purchase_done'])
  expect(filterEntries(entries, { q: '구매가', status: null }).map((e) => e.name)).toEqual(['purchase_done'])
  expect(() => filterEntries(entries, { q: '([\\.', status: null })).not.toThrow()
})
it('handles event names that collide with object keys', () => {
  const o: Observed = new Map([['toString', { count: 1, users: 1, byPlatform: [{ platform: 'Android', count: 1, users: 1 }] }]])
  const e = buildDictionary({ catalog: [], observed: o, recent: null })
  expect(e).toHaveLength(1)
  expect(e[0]).toMatchObject({ name: 'toString', status: 'unknown' })
})
it('writes the catalog snippet', () => {
  expect(catalogSnippet('purchase_done')).toBe("{ name: 'purchase_done', label: '', description: '', kind: 'app', params: [] },")
})
it('finds GA params that no catalog event lists', () => {
  const ga: GaParam[] = [
    { name: 'item_id', uiName: '', description: '', kind: 'dimension' },
    { name: 'price', uiName: '', description: '', kind: 'metric' },
  ]
  expect(unlistedParams(ga, cat)).toEqual(new Set(['price']))
})
it('builds CSV rows', () => {
  const rows = toCsvRows(buildDictionary({ catalog: cat, observed, recent }))
  expect(rows.find((r) => r[0] === 'purchase_done')).toEqual(
    ['purchase_done', '구매 완료', '앱 정의', '정상', 41, 15, '구매가 끝나면 기록돼요.', 'item_id'],
  )
  expect(rows.find((r) => r[0] === 'typo_evnt')!.slice(1, 4)).toEqual(['typo_evnt', '', '사전에 없음'])
})
```

테스트의 `observed`와 `recent`는 위 주석대로 `Map`으로 직접 만든다(`purchase_done`은 Android 30/10, iOS 11/5).

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-dictionary/dictionary.test.ts` Expected: FAIL
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** Run: `npm run typecheck && npm test` Expected: PASS
- [ ] **Step 5: Commit** — `feat(admin): merge the catalog with observed events and judge their status`

---

### Task 12: 사전 화면

스펙 §3 전체를 읽는다. 문구, 표의 열, 상태별 화면, `event` 파라미터의 처리, "모바일과 접근성"은 스펙을 그대로 따른다.

**Files:**
- Create: `src/admin/pages/devtools/event-dictionary/useEventDictionary.ts`, `DictionaryTable.tsx`, `EventDictionaryPage.tsx`, `EventDictionaryPage.menu.ts`, `EventDictionaryPage.test.tsx`, `event-dictionary.css`

**Interfaces:**
- Consumes: Task 10과 11의 모든 것, `EVENT_CATALOG` (Task 1), `client.runReport`/`runRealtimeReport`/`getMetadata` (Task 2), `SearchField` (Task 4), `usePageParam`, `useGa`, `Card`, `CardState`, `CsvButton`, `formatNumber`, `displayDim`
- Produces:

```ts
export type EventDictionary = {
  entries: DictionaryEntry[]
  observed: 'pending' | 'error' | 'ready' | 'invalid-period'
  recentFailed: boolean
  retryObserved(): void
  params: { data: GaParam[] | undefined; isPending: boolean; error: unknown; refetch(): void }
  registeredParams: ReadonlySet<string>     // metadata에 있는 파라미터 이름. 못 받았으면 빈 집합
}
export function useEventDictionary(): EventDictionary
export function EventDictionaryPage(): ReactElement
```

정한 것:
- query: `['event-dictionary', 'observed', ranges]`(기본 설정, `enabled: ranges !== null`), `['event-dictionary', 'recent']`(`staleTime: 60_000`), `['event-dictionary', 'metadata']`(`staleTime: Infinity`, `gcTime: Infinity`).
- `observed`가 `'ready'`가 아니면 `buildDictionary`에 `observed: null`을 넘긴다. `ranges === null`이면 `'invalid-period'`다.
- 메뉴 정의는 스펙 §3 "메뉴" 표의 값이고 아이콘은 `lucide-react`의 `BookOpenText`다.
- 판정 기준 줄: `` `${startDate} ~ ${endDate}과 최근 30분을 기준으로 판정했어요` ``. `recentFailed`면 그 아래에 "오늘 들어온 이벤트는 확인하지 못했어요".
- 상태 버튼의 글자는 `` `${STATUS_LABEL} ${개수}` ``, `전체`는 `` `전체 ${all}` ``, 개수를 모르면 `—`. `aria-pressed`. 고른 버튼을 다시 누르면 `status`를 지운다.
- 상태 버튼이나 검색어를 사용자가 바꾸면 `event` 파라미터를 지운다. 행의 펼치기 버튼은 `event`를 그 이름으로 쓰고, 펼친 행을 다시 누르면 지운다.
- `event`가 지금 목록에 없는 이름일 때의 두 경우(걸러진 이벤트, 기록이 없는 이름)는 스펙 "URL 상태"대로 목록 맨 위에 그린다. 이 줄은 CSV와 개수에 넣지 않는다.
- 펼치기 버튼은 `aria-expanded`, `aria-controls`를 가진다. 이름은 `` `${entry.name} 자세히 보기` ``.
- 복사: `navigator.clipboard?.writeText`를 `try`/`catch`로 감싼다. 성공하면 버튼 글자를 2초 동안 `복사했어요`로 바꾸고 `role="status"`로 알린다. 없거나 실패하면 `readOnly`인 `<textarea>`에 코드를 넣어 보여 주고 내용을 선택한다.
- CSV 파일 이름: `` `parfait-event-dictionary-${startDate}_${endDate}.csv` ``. 기간이 잘못됐으면 CSV 버튼을 그리지 않는다.
- 파라미터 카드 제목은 `GA에 등록된 파라미터`. 종류 칸은 `측정기준` 또는 `측정항목`.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`EventDictionaryPage.test.tsx`). 카탈로그는 `vi.mock('../../../ga/eventCatalog', ...)`로 Task 11 테스트와 같은 작은 카탈로그로 바꾼다(`findEvent`, `targetPlatforms`, `ALL_PLATFORMS`는 실제 구현을 쓴다). fixture는 Task 10의 것을 쓴다.

```ts
it('shows the catalog at once and fills counts when observation arrives', async () => {
  // 응답 전: '화면 조회'가 보이고 횟수 칸은 스켈레톤, 상태 버튼 '사전에 없음 —'
  // 응답 뒤: '160번', '사전에 없음 2'
})
it('states the period it judged by', async () => {
  // '2026-09-22 ~ 2026-09-28과 최근 30분을 기준으로 판정했어요'
})
it('filters by a status button and toggles back to all', async () => {
  // '사전에 없음' 누름 → URL status=unknown, 행은 today_only와 사전에 없는 것만 → 다시 누름 → status 없음
})
it('keeps zero-count status buttons', async () => {
  // '일부 플랫폼만 0' 버튼이 있다
})
it('searches through SearchField and writes q', async () => {})
it('expands one event at a time and mirrors it in the URL', async () => {
  // 'purchase_done 자세히 보기' → aria-expanded true, URL event=purchase_done, 파라미터 표에 item_id와 'GA 등록됨'
  // 다른 행을 펼치면 앞의 것은 접힌다
})
it('tags events seen only today', async () => {
  // today_only 행에 '오늘 들어옴'
})
it('shows a filtered-out event from the URL on top with a note, outside the counts', async () => {
  // ?status=unknown&event=screen_view → 첫 행 screen_view와 '필터와 상관없이 보여요', '사전에 없음 2'는 그대로
})
it('shows a placeholder row for a name with no record', async () => {
  // ?event=ghost_event → '이 기간과 최근 30분에 들어온 기록이 없어요'와 '카탈로그 항목 복사'
})
it('drops the event param when a filter changes', async () => {})
it('copies the catalog snippet and confirms for 2 seconds', async () => {
  // navigator.clipboard.writeText가 "{ name: 'today_only', label: '', description: '', kind: 'app', params: [] }," 로 불림
  // 버튼 글자 '복사했어요' → 2초 뒤 '카탈로그 항목 복사'
})
it('falls back to a selectable text box when the clipboard is missing or rejects', async () => {
  // clipboard 없음 / writeText reject 두 경우 모두 textarea에 코드가 있고 예외가 없다
})
it('exports the filtered rows as CSV', async () => {
  // downloadCsv를 mock → 파일 이름 'parfait-event-dictionary-2026-09-22_2026-09-28.csv', 헤더는 CSV_HEADERS
})
it('keeps the catalog and offers a retry when observation fails', async () => {
  // runReport가 GaError('server') → '수집 현황을 불러오지 못했어요', '다시 시도', 횟수 칸 '—', '화면 조회' 행은 있다
})
it('shows the unknown-status list as an error while observation has failed', async () => {
  // ?status=unknown + 실패 → 목록 자리에 오류와 '다시 시도', '조건에 맞는 이벤트가 없어요'는 없다
})
it('notes when only the recent check failed', async () => {
  // '오늘 들어온 이벤트는 확인하지 못했어요'
})
it('asks for a new period when the period is invalid', async () => {
  // useGa의 ranges가 null → '기간을 다시 골라 주세요', runReport 호출 없음, CSV 버튼 없음
})
it('lists GA params with their kind and flags unlisted ones', async () => {
  // 'item_id' 행 '측정기준', 'price' 행 '측정항목'과 '사전에 없음'
})
it('confines a metadata failure to its card', async () => {
  // getMetadata가 GaError('server') → 파라미터 카드에만 '불러오지 못했어요', 이벤트 표는 정상, 'GA 등록됨' 태그 없음
})
it('says so when GA has no registered params', async () => {
  // 'GA에 등록된 파라미터가 없어요'
})
it('clears q, status and event', async () => {})
it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'event-dictionary', group: 'devtools', order: 220, label: '이벤트 사전', usesPeriod: true, usesGa: true })
})
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/admin/pages/devtools/event-dictionary/EventDictionaryPage.test.tsx` Expected: FAIL

- [ ] **Step 3: 훅, 컴포넌트, 메뉴 정의를 구현한다.**

- [ ] **Step 4: `event-dictionary.css`를 쓴다.** 클래스는 모두 `adm-event-dictionary-`로 시작한다. 상태 버튼 묶음은 `flex-wrap: wrap`이고 모양은 `admin.css`의 `.adm-period__preset`과 같은 토큰을 쓴다(`aria-pressed='true'`일 때 강조). 960px 미만: `구분` 열을 숨기고 펼친 내용에서 보여 주며, 이벤트 칸은 `white-space: normal`. 펼치기 버튼, 상태 버튼, 복사 버튼은 `min-height: var(--adm-hit)`.

- [ ] **Step 5: 통과와 빌드를 확인한다.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS

- [ ] **Step 6: Commit** — `feat(admin): add the event dictionary page`

---

### Task 13: 마무리 확인

- [ ] **Step 1: 전체 확인.** Run: `npm run typecheck && npm test && npm run build` Expected: PASS
- [ ] **Step 2: 규칙 점검.**
  - `git diff develop --stat`에 Global Constraints의 고치지 않는 파일 10개와 `package.json`, `package-lock.json`이 없다.
  - `grep -rn "localStorage" src/admin/pages/devtools`의 결과가 없다.
  - `grep -rhn "className=" src/admin/pages/devtools/event-stream src/admin/pages/devtools/event-dictionary`에 나오는 새 클래스가 정한 접두사로 시작한다(기존 `adm-table`, `adm-tag`, `adm-button`, `adm-card`, `adm-state`, `adm-num`, `adm-skeleton`, `adm-grid`, `adm-page__note`는 예외).
  - 빌드 결과에 진단 줄이 없다: `grep -rl "직전 요청" dist`의 결과가 없다.
- [ ] **Step 3: 사용자에게 화면 확인을 요청한다.** `npm run build && npm run preview`로 두 화면을 열어 달라고 한다. 볼 것: 콘솔에 CSP 위반이 없는지, 사이드바·모바일 메뉴·`⌘K`에 두 메뉴가 나오는지, 960px 아래에서 표가 가로로 넘치지 않는지, `사전에서 보기`가 그 이벤트를 펼친 채 여는지.
- [ ] **Step 4: 스펙의 상태 줄을 고친다.** `상태: 구현됨(2026-10-XX)`으로 바꾸고 Task 9를 건너뛰었으면 그 사실을 적는다. Commit — `docs: mark the admin QA tools spec as implemented`
