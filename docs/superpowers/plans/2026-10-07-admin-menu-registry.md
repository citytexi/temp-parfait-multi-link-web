# 어드민 메뉴 레지스트리와 셸 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민에 새 메뉴를 추가할 때 공통 파일을 고치지 않아도 되게 메뉴 레지스트리와 셸(그룹 사이드바, 모바일 메뉴, 빠른 이동, 공통 페이지 헤더)을 만든다.

**Architecture:** 메뉴는 페이지 옆 `*.menu.ts` 파일로 정의하고 `import.meta.glob`으로 모은다. 사이드바, 모바일 탭, 빠른 이동, URL 검증, 페이지 렌더가 모두 이 레지스트리에서 나온다. 메뉴와 기간 상태는 `GaProvider`에서 `NavProvider`로 옮기고, 페이지는 `React.lazy`로 나눈다. 페이지별 CSP 조각은 빌드 때 합친다.

**Tech Stack:** Vite 8, React 19, TypeScript 6, TanStack Query v5, Vitest 5, @testing-library/react, jsdom, `cmdk`, `lucide-react`, npm

**Spec:** `docs/superpowers/specs/2026-10-07-admin-menu-registry-design.md`

## Global Constraints

- 기존 6개 페이지의 내용은 바꾸지 않는다. 각 페이지의 `<h1 className="adm-page__title">` 한 줄만 지운다.
- 기존 URL `?menu=<id>&period=<7d|28d|90d>`와 `?menu=<id>&start=YYYY-MM-DD&end=YYYY-MM-DD`는 지금과 같은 화면을 연다. 알 수 없는 `menu`는 `overview`.
- 토큰은 메모리에만 둔다. `localStorage`에는 키 `parfait-admin:menu-collapsed` 하나만 쓰고 UI 상태만 넣는다.
- OAuth scope는 `https://www.googleapis.com/auth/analytics.readonly` 하나 그대로.
- 조각 파일이 없을 때 빌드된 어드민 CSP 문자열은 이 작업 전과 글자 하나 다르지 않다.
- `cmdk`, `@radix-ui/react-dialog`, `lucide-react`는 `src/admin/` 아래에서만 import한다.
- 어드민은 `StrictMode`로 돈다(`src/admin/main.tsx`). effect와 state updater가 두 번 불려도 동작이 같아야 한다.
- `tsconfig.app.json`에 전역 `JSX` 타입이 없다. 반환 타입을 적을 때는 `react`의 `ReactElement`를 쓴다.
- 색은 `src/admin/styles/tokens.css`의 토큰만 쓴다. 새 색 금지. 디자인 기준은 `design-system/parfait-admin/pages/dashboard.md`가 `MASTER.md`보다 우선.
- 데스크톱 기준 폭: `960px`. 터치 영역 `--adm-hit`(44px) 이상. 애니메이션은 `prefers-reduced-motion: reduce`에서 끈다.
- 화면 문구는 해요체. 이 문서에 따옴표로 적은 문구는 그대로 쓴다.
- 스타일 클래스는 `adm-` 접두어, 기존 BEM 표기를 따른다.
- 커밋 메시지는 Conventional Commits, 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- 각 Task 끝에서 `npm run typecheck`와 `npm test`가 통과해야 한다.

## Review Focus

1. 페이지 파라미터 값에 `&`, `=`, 공백, 한글이 들어감 → URL에 인코딩돼 들어가고 다시 읽으면 원래 값과 같다. (Task 2)
2. `localStorage`에 깨진 JSON, 배열이 아닌 값, 문자열이 아닌 원소가 있거나 접근이 예외를 던짐 → 크래시 없이 모두 펼친 상태. (Task 3)
3. 뒤로 가기로 돌아간 URL의 `menu`가 알 수 없는 값이거나, 기간을 안 쓰는 메뉴 URL에 `period`가 붙어 있음 → `overview`로 가고, URL을 다시 쓸 때 기간 파라미터를 뺀다. (Task 2)
4. 입력창(날짜 입력 등)에 포커스가 있을 때 `⌘K`/`Ctrl+K` → 글자가 입력되지 않고 팔레트가 열린다. 이미 열려 있으면 닫힌다. (Task 4)
5. 청크 로딩이 실패한 메뉴에서 다른 메뉴로 갔다가 돌아옴 → 오류 화면에 갇히지 않고 다시 받기를 시도한다. (Task 5)

---

## File Structure

```
build/
├─ adminCsp.ts                 # 새로: CSP 조각 읽기와 합치기 (Task 6)
└─ adminCsp.test.ts
src/admin/
├─ menu/
│  ├─ defineMenu.ts            # 새로: MenuDef, defineMenu (Task 1)
│  ├─ groups.ts                # 새로: GROUPS (Task 1)
│  ├─ registry.ts              # 새로: buildRegistry, 실제 레지스트리 (Task 1)
│  ├─ registry.test.ts
│  ├─ NavContext.tsx           # 새로: NavProvider, useNav, usePageParam (Task 2)
│  ├─ NavContext.test.tsx
│  ├─ collapsed.ts             # 새로: 접힘 상태 저장 (Task 3)
│  ├─ collapsed.test.ts
│  └─ useIsDesktop.ts          # 새로 (Task 3)
├─ components/
│  ├─ SideMenu.tsx             # 다시 씀 (Task 3)
│  ├─ MobileMenu.tsx           # 새로 (Task 3)
│  ├─ menus.test.tsx           # 새로 (Task 3)
│  ├─ CommandMenu.tsx          # 새로 (Task 4)
│  ├─ CommandMenu.test.tsx
│  ├─ PageHeader.tsx           # 새로 (Task 5)
│  ├─ PageOutlet.tsx           # 새로 (Task 5)
│  ├─ shell.test.tsx           # 새로 (Task 5)
│  └─ Shell.tsx                # 고침 (Task 5)
├─ pages/*.menu.ts             # 새로: 6개 (Task 1)
├─ pages/*Page.tsx             # h1 한 줄 삭제 (Task 5)
├─ hooks/useGa.ts              # 고침 (Task 2)
├─ lib/urlState.ts             # 고침 (Task 2)
├─ App.tsx                     # NavProvider 추가 (Task 2)
└─ styles/admin.css            # 셸 스타일 (Task 3, 4, 5)
src/test/setup.ts              # jsdom 대체 구현 (Task 1)
vite.config.ts                 # build/adminCsp.ts 사용 (Task 6)
tsconfig.node.json             # include에 build 추가 (Task 6)
README.md, docs/superpowers/2026-09-29-ga-admin-manual-checklist.md  # (Task 7)
```

---

### Task 1: 의존성, 테스트 환경, 메뉴 레지스트리

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/test/setup.ts`
- Create: `src/admin/menu/defineMenu.ts`, `src/admin/menu/groups.ts`, `src/admin/menu/registry.ts`
- Create: `src/admin/pages/{Overview,Users,Events,Retention,Tech,Realtime}Page.menu.ts`
- Test: `src/admin/menu/registry.test.ts`

**Interfaces:**
- Produces:

```ts
// defineMenu.ts
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
export type GroupId = 'metrics' | 'devtools' | 'ops'
export type MenuDef = {
  id: string
  group: GroupId
  order: number
  label: string
  description: string
  icon: LucideIcon
  keywords?: readonly string[]
  load: () => Promise<{ default: ComponentType }>
  usesPeriod?: boolean
  usesGa?: boolean
  scopes?: readonly string[]
}
export function defineMenu(def: MenuDef): MenuDef

// groups.ts
export const GROUPS: readonly { id: GroupId; label: string }[]
// [{metrics,'지표'},{devtools,'개발자 도구'},{ops,'팀 운영'}] 이 순서

// registry.ts
export type MenuGroup = { id: GroupId; label: string; menus: readonly MenuDef[] }
export type MenuLookup = { defaultMenu: string; isMenu(id: string): boolean; usesPeriod(id: string): boolean }
export type Registry = {
  menus: readonly MenuDef[]        // 그룹 순서, order, id 순
  groups: readonly MenuGroup[]     // 메뉴가 있는 그룹만
  findMenu(id: string): MenuDef | undefined
  lookup: MenuLookup
}
export function buildRegistry(defs: readonly MenuDef[], defaultMenu?: string): Registry
export const REGISTRY: Registry    // glob으로 모은 실제 레지스트리, defaultMenu 'overview'
```

- [ ] **Step 1: 의존성 설치**

Run: `npm install cmdk lucide-react`
Expected: `package.json`의 `dependencies`에 두 패키지가 추가된다.

- [ ] **Step 2: `src/test/setup.ts`에 jsdom 대체 구현 추가**

없을 때만 정의한다. 셋 모두 `if (typeof window !== 'undefined')` 안에 둔다. Task 6의 테스트는 `// @vitest-environment node`로 도는데 그때도 이 파일을 불러오고, 거기에는 `window`와 `Element`가 없다.
- `globalThis.ResizeObserver`: `observe`, `unobserve`, `disconnect`가 아무 일도 하지 않는 클래스
- `Element.prototype.scrollIntoView`: 빈 함수
- `window.matchMedia`: `{ matches: true, media, addEventListener, removeEventListener }`를 돌려주는 함수. 기본이 데스크톱이다.

- [ ] **Step 3: 실패하는 테스트 작성 (`registry.test.ts`)**

`const def = (o: Partial<MenuDef>) => defineMenu({ id: 'x', group: 'metrics', order: 10, label: 'X', description: '', icon: Circle, load: async () => ({ default: () => null }), ...o })`를 헬퍼로 둔다.

```ts
it('sorts by group order, then order, then id', () => {
  const r = buildRegistry([
    def({ id: 'b', group: 'ops', order: 100 }),
    def({ id: 'z', group: 'metrics', order: 20 }),
    def({ id: 'c', group: 'metrics', order: 20 }),
    def({ id: 'a', group: 'devtools', order: 100 }),
    def({ id: 'm', group: 'metrics', order: 10 }),
  ])
  expect(r.menus.map((m) => m.id)).toEqual(['m', 'c', 'z', 'a', 'b'])
})
it('omits groups that have no menus', () => {
  const r = buildRegistry([def({ id: 'm' })])
  expect(r.groups.map((g) => g.id)).toEqual(['metrics'])
  expect(r.groups[0].label).toBe('지표')
})
it('throws on a duplicate id and names it', () => {
  expect(() => buildRegistry([def({ id: 'dup' }), def({ id: 'dup', group: 'ops' })])).toThrow(/dup/)
})
it('throws on an unknown group', () => {
  expect(() => buildRegistry([def({ group: 'nope' as GroupId })])).toThrow(/nope/)
})
it('does not throw when two menus share an order', () => {
  expect(() => buildRegistry([def({ id: 'a' }), def({ id: 'b' })])).not.toThrow()
})
it('lookup answers isMenu, usesPeriod and defaultMenu', () => {
  const r = buildRegistry([def({ id: 'p', usesPeriod: true }), def({ id: 'q' })], 'p')
  expect(r.lookup.defaultMenu).toBe('p')
  expect(r.lookup.isMenu('p')).toBe(true)
  expect(r.lookup.isMenu('nope')).toBe(false)
  expect(r.lookup.usesPeriod('p')).toBe(true)
  expect(r.lookup.usesPeriod('q')).toBe(false)
  expect(r.lookup.usesPeriod('nope')).toBe(false)
})
it('the real registry holds the six metrics menus with the spec values', () => {
  expect(REGISTRY.groups.find((g) => g.id === 'metrics')!.menus.map((m) => [m.id, m.label, m.order, !!m.usesPeriod, !!m.usesGa])).toEqual([
    ['overview', '한눈에 보기', 10, true, true],
    ['users', '사용자', 20, true, true],
    ['events', '많이 한 행동', 30, true, true],
    ['retention', '다시 찾아온 사람', 40, true, true],
    ['tech', '기기·지역', 50, true, true],
    ['realtime', '지금 접속 중', 60, false, true],
  ])
  expect(REGISTRY.lookup.defaultMenu).toBe('overview')
})
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run src/admin/menu/registry.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 5: `defineMenu.ts`, `groups.ts`, `registry.ts` 구현**

`REGISTRY`는 `import.meta.glob<MenuDef>('../pages/**/*.menu.ts', { eager: true, import: 'default' })`의 값들로 `buildRegistry(defs, 'overview')`를 부른다.

- [ ] **Step 6: 메뉴 정의 파일 6개 작성**

값은 Step 3의 마지막 테스트 표와 같다. `load`는 named export를 default로 감싼다(예: `() => import('./OverviewPage').then((m) => ({ default: m.OverviewPage }))`).

| id | description | icon | keywords |
|----|-------------|------|----------|
| `overview` | 핵심 지표와 추이를 한 화면에서 봐요 | `LayoutDashboard` | 요약, 대시보드, overview |
| `users` | 새로 온 사람과 다시 온 사람을 봐요 | `Users` | 사용자, 신규, 재방문, users |
| `events` | 앱에서 많이 한 행동을 순서대로 봐요 | `MousePointerClick` | 이벤트, 행동, events |
| `retention` | 처음 온 뒤에 다시 찾아온 비율을 봐요 | `Repeat` | 리텐션, 재방문, retention |
| `tech` | 어떤 기기와 지역에서 쓰는지 봐요 | `Smartphone` | 플랫폼, 국가, 버전, tech |
| `realtime` | 지금 앱을 쓰고 있는 사람을 봐요 | `Activity` | 실시간, realtime |

- [ ] **Step 7: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS. 기존 테스트 수는 그대로이고 새 테스트 7개가 추가된다.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/test/setup.ts src/admin/menu src/admin/pages/*.menu.ts
git commit -m "feat(admin): add menu registry collected from per-page menu files"
```

---

### Task 2: URL 상태, `NavProvider`, 뒤로 가기

**Files:**
- Modify: `src/admin/lib/urlState.ts`, `src/admin/lib/urlState.test.ts`, `src/admin/hooks/useGa.ts`, `src/admin/App.tsx`, `src/admin/components/Shell.tsx`, `src/admin/App.test.tsx`
- Create: `src/admin/menu/NavContext.tsx`
- Test: `src/admin/lib/urlState.test.ts`, `src/admin/menu/NavContext.test.tsx`

**Interfaces:**
- Consumes: `MenuLookup`, `REGISTRY` (Task 1)
- Produces:

```ts
// urlState.ts
export type MenuId = string
export type UrlState = { menu: MenuId; period: Period; pageParams: Readonly<Record<string, string>> }
export const RESERVED_PARAMS: readonly string[] // ['menu', 'period', 'start', 'end']
export function parseUrlState(search: string, lookup: MenuLookup): UrlState
export function toSearch(state: UrlState, lookup: MenuLookup): string

// NavContext.tsx
export type NavValue = {
  menu: MenuId
  period: Period
  setMenu(menu: MenuId): void
  setPeriod(period: Period): void
}
export function NavProvider(props: { lookup?: MenuLookup; children: ReactNode }): ReactElement // 기본 REGISTRY.lookup
export function useNav(): NavValue
export function usePageParam(key: string): [string | null, (value: string | null) => void]
```

`useGa()`의 반환값에서 `menu`, `setMenu`를 뺀다. `period`, `setPeriod`, `today`, `periodError`, `ranges`, `periodLabel`, `client`는 남는다.

**URL 규칙:**
- `toSearch` 순서: `menu`, 기간(`period` 또는 `start`,`end`), 그 뒤 `pageParams`를 넣은 순서대로. 값은 `encodeURIComponent`.
- `lookup.usesPeriod(menu)`가 `false`면 기간 파라미터를 쓰지 않는다.
- `parseUrlState`는 `RESERVED_PARAMS`가 아닌 파라미터를 모두 `pageParams`에 담는다. 같은 이름이 여러 번이면 첫 값.
- `setMenu`: `pageParams`를 비우고 `history.pushState`. 같은 메뉴면 아무 일도 하지 않는다.
- `setPeriod`, 페이지 파라미터 변경: `history.replaceState`.
- `popstate`: `parseUrlState(location.search, lookup)`로 상태를 다시 맞춘다. 단, 돌아간 메뉴가 기간을 안 쓰면 메모리의 기간은 유지한다.
- `usePageParam`의 key가 `RESERVED_PARAMS`에 있으면 `Error`를 던진다.
- 기간 파라미터는 메뉴와 상관없이 `parseUrlState`가 읽는다. 기간을 안 쓰는 메뉴에서 빼는 것은 `toSearch`뿐이다. 처음 열 때는 읽은 값을 메모리 기간으로 쓴다.
- `setMenu`, `setPeriod`, `usePageParam`의 setter는 렌더가 바뀌어도 같은 함수다. 최신 상태는 ref로 읽는다. 페이지가 `useEffect(() => setQ(v), [setQ])`처럼 써도 반복되지 않아야 한다.
- `history` 호출은 state updater 함수 밖에서 한다. StrictMode가 updater를 두 번 불러도 기록이 두 번 쌓이지 않는다.
- 값이 지금과 같으면 setter는 아무 일도 하지 않는다. `history`도 부르지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성 (`urlState.test.ts`)**

기존 테스트는 `lookup`을 넘기도록 고치고 기대값에 `pageParams: {}`를 더한다. 테스트용 lookup:

```ts
const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'users', 'events', 'tech', 'realtime', 'utm'].includes(id),
  usesPeriod: (id) => !['realtime', 'utm'].includes(id),
}
```

추가:

```ts
it('omits period params for a menu that does not use the period', () => {
  expect(toSearch({ menu: 'utm', period: { kind: 'preset', preset: '28d' }, pageParams: {} }, lookup)).toBe('?menu=utm')
})
it('parses period params even for a menu that does not use the period', () => {
  expect(parseUrlState('?menu=utm&period=28d', lookup)).toEqual({ menu: 'utm', period: { kind: 'preset', preset: '28d' }, pageParams: {} })
})
it('keeps page params after the shell params, in insertion order', () => {
  expect(toSearch({ menu: 'events', period: { kind: 'preset', preset: '7d' }, pageParams: { q: 'a', tab: 'b' } }, lookup)).toBe('?menu=events&period=7d&q=a&tab=b')
})
it('round-trips page param values that need encoding', () => {
  const state: UrlState = { menu: 'utm', period: { kind: 'preset', preset: '7d' }, pageParams: { url: 'https://a.b/c?x=1&y=2', name: '가을 이벤트 #1' } }
  expect(parseUrlState(toSearch(state, lookup), lookup)).toEqual(state)
})
it('takes the first value of a repeated page param', () => {
  expect(parseUrlState('?menu=utm&q=1&q=2', lookup).pageParams).toEqual({ q: '1' })
})
it('falls back to the default menu for an unknown id', () => {
  expect(parseUrlState('?menu=nope', lookup).menu).toBe('overview')
})
```

- [ ] **Step 2: 실패하는 테스트 작성 (`NavContext.test.tsx`)**

위 `lookup`으로 `<NavProvider lookup={lookup}>` 안에 `useNav`와 `usePageParam('q')`를 쓰는 작은 컴포넌트를 렌더한다. 각 테스트 전에 `history.replaceState(null, '', '/admin/')`.

```ts
it('pushes history on a menu change and replaces on a period change')
// setMenu('users') → pushState 마지막 호출 인자 URL '/admin/?menu=users&period=7d'
// setPeriod({kind:'preset',preset:'90d'}) → replaceState 마지막 호출 URL '/admin/?menu=users&period=90d'
it('does not push when the menu is unchanged')
// setMenu('overview') → pushState 호출 0번
it('clears page params on a menu change')
// '/admin/?menu=utm&q=hello'로 시작 → setMenu('events') → URL '/admin/?menu=events&period=7d'
it('writes and removes a page param with replaceState, keeping the others')
// '/admin/?menu=utm&a=1'에서 q를 'x'로 → '/admin/?menu=utm&a=1&q=x', q를 null로 → '/admin/?menu=utm&a=1'
it('keeps the chosen period across a visit to a period-less menu')
// setPeriod 28d → setMenu('utm') → setMenu('events') → URL '/admin/?menu=events&period=28d'
it('restores the menu on popstate and falls back to overview for an unknown id')
// history.replaceState(null,'','/admin/?menu=nope'); dispatch PopStateEvent → menu 'overview'
it('throws when usePageParam is given a reserved key')
// usePageParam('menu') 렌더 → toThrow(/menu/)
it('keeps setMenu, setPeriod and the page param setter stable across state changes')
// 처음 렌더에서 잡은 세 함수가 setMenu('users'), setPeriod(90d), q 변경 뒤에도 toBe로 같다
it('does not touch history when a value is unchanged')
// setPeriod(지금과 같은 7d), q를 지금 값으로 다시 설정, 없는 q를 null로 → pushState와 replaceState 호출 0번
it('pushes once per menu change under StrictMode')
// <StrictMode>로 감싸 렌더 → setMenu('users') → pushState 호출 1번
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/admin/lib/urlState.test.ts src/admin/menu/NavContext.test.tsx`
Expected: FAIL

- [ ] **Step 4: `urlState.ts`, `NavContext.tsx` 구현**

- [ ] **Step 5: `useGa.ts`, `App.tsx`, `Shell.tsx` 연결**

- `GaProvider`: URL 상태와 `history` 호출을 지우고 `useNav()`에서 `period`, `setPeriod`를 읽는다.
- `App.tsx`의 `SignedInApp`: `<NavProvider>`를 `<GaProvider>` 바깥에 둔다.
- `Shell.tsx`: `menu`, `setMenu`를 `useNav()`에서 읽는다. 이 Task에서는 그 밖의 모양은 그대로 둔다.

- [ ] **Step 6: `App.test.tsx` 고치기**

'restores menu and period from the URL...' 테스트에서 메뉴 클릭 뒤 기대를 `pushState` 스파이의 `toHaveBeenLastCalledWith(null, '', '/admin/?menu=retention&period=28d')`로 바꾼다. 기간 클릭 뒤 기대는 `replaceState` 그대로다.

- [ ] **Step 7: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/admin
git commit -m "feat(admin): move nav state to NavProvider with page params and back-button history"
```

---

### Task 3: 사이드바와 모바일 메뉴

**Files:**
- Create: `src/admin/menu/collapsed.ts`, `src/admin/menu/useIsDesktop.ts`, `src/admin/components/MobileMenu.tsx`
- Modify: `src/admin/components/SideMenu.tsx`, `src/admin/components/Shell.tsx`, `src/admin/App.test.tsx`, `src/admin/styles/admin.css`
- Test: `src/admin/menu/collapsed.test.ts`, `src/admin/components/menus.test.tsx`

**Interfaces:**
- Consumes: `MenuGroup`, `MenuDef` (Task 1)
- Produces:

```ts
// collapsed.ts
export const COLLAPSED_KEY = 'parfait-admin:menu-collapsed'
export function readCollapsed(): string[]         // 실패하거나 형식이 틀리면 []
export function writeCollapsed(ids: readonly string[]): void  // 실패는 삼킨다

// useIsDesktop.ts
export function useIsDesktop(): boolean // matchMedia('(min-width: 960px)') 구독, matchMedia 없으면 true

// SideMenu.tsx, MobileMenu.tsx — 같은 props
type MenuProps = { groups: readonly MenuGroup[]; active: string; onSelect(id: string): void }
export function SideMenu(props: MenuProps): ReactElement
export function MobileMenu(props: MenuProps): ReactElement
```

`SideMenu.tsx`에 있던 `MENU_ITEMS` export는 지운다.

**마크업 규칙 (테스트가 기대는 것):**
- 둘 다 최상위는 `<nav aria-label="메뉴">`.
- `SideMenu`: 그룹마다 제목 `<button aria-expanded aria-controls>`(이름은 그룹 라벨)과 `<ul aria-label={그룹 라벨}>`. 접힌 그룹의 `<ul>`은 렌더하지 않는다. 메뉴 항목은 아이콘(`aria-hidden`)과 라벨을 가진 `<button>`, 현재 메뉴에 `aria-current="page"`.
- `MobileMenu`: 그룹이 둘 이상이면 세그먼트 `<div role="group" aria-label="메뉴 그룹">` 안에 그룹마다 `<button aria-pressed aria-controls="adm-mobile-tabs">`. 탭 목록은 `<ul id="adm-mobile-tabs" aria-label={고른 그룹 라벨}>`, 항목은 `SideMenu`와 같다.

**동작:**
- `SideMenu`는 처음 렌더할 때 `readCollapsed()`를 읽는다. `active`가 바뀌거나 처음 렌더될 때 `active`의 그룹을 접힘 목록에서 빼고 저장한다. 그룹 제목을 누르면 그 그룹을 접힘 목록에 넣거나 빼고 저장한다. 현재 메뉴의 그룹도 눌러서 접을 수 있다. 저장은 접힘 목록이 실제로 바뀔 때만 한다.
- `MobileMenu`는 고른 그룹을 자체 상태로 가진다. 초기값과 `active`가 바뀔 때의 값은 `active`의 그룹이다. 세그먼트를 눌러도 `onSelect`는 부르지 않는다. `active`의 탭에 `scrollIntoView({ inline: 'nearest', block: 'nearest' })`를 부른다.

- [ ] **Step 1: 실패하는 테스트 작성 (`collapsed.test.ts`)**

```ts
beforeEach(() => localStorage.clear())
it('returns [] when nothing is stored', () => expect(readCollapsed()).toEqual([]))
it('round-trips ids', () => { writeCollapsed(['ops', 'devtools']); expect(readCollapsed()).toEqual(['ops', 'devtools']) })
it.each(['{not json', '"ops"', '{"a":1}', 'null'])('returns [] for malformed value %s', (raw) => {
  localStorage.setItem(COLLAPSED_KEY, raw)
  expect(readCollapsed()).toEqual([])
})
it('drops non-string entries', () => {
  localStorage.setItem(COLLAPSED_KEY, '["ops", 3, null]')
  expect(readCollapsed()).toEqual(['ops'])
})
it('returns [] and does not throw when storage access throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
  expect(readCollapsed()).toEqual([])
  expect(() => writeCollapsed(['ops'])).not.toThrow()
})
```

- [ ] **Step 2: 실패하는 테스트 작성 (`menus.test.tsx`)**

`buildRegistry`로 만든 테스트용 그룹을 쓴다: `metrics`에 `overview`(한눈에 보기), `users`(사용자), `devtools`에 `dict`(이벤트 사전), `ops`에 `links`(링크 허브). 매 테스트 전 `localStorage.clear()`.

SideMenu:

```ts
it('lists every group with its menus and marks the active one')
// nav 안 list '지표'의 버튼 텍스트 ['한눈에 보기','사용자'], list '개발자 도구' ['이벤트 사전'], list '팀 운영' ['링크 허브']
// '사용자' 버튼 aria-current="page"
it('calls onSelect with the menu id') // '링크 허브' 클릭 → onSelect('links')
it('collapses and expands a group and persists it')
// '개발자 도구' 제목 클릭 → aria-expanded="false", list '개발자 도구' 없음, readCollapsed() == ['devtools']
// 다시 클릭 → aria-expanded="true", readCollapsed() == []
it('restores the collapsed state on mount')
// writeCollapsed(['ops']) 뒤 active='overview'로 렌더 → list '팀 운영' 없음
it('expands the active group on mount and on navigation, and removes it from storage')
// writeCollapsed(['ops','devtools']), active='links' 렌더 → list '팀 운영' 있음, readCollapsed() == ['devtools']
// rerender active='dict' → list '개발자 도구' 있음, readCollapsed() == []
it('lets the user collapse the active group')
// active='overview', '지표' 제목 클릭 → list '지표' 없음
it('renders only groups that have menus') // metrics만 있는 그룹 목록 → '개발자 도구' 버튼 없음
it('does not write storage when the collapsed list does not change')
// Storage.prototype.setItem 스파이, active='overview'로 렌더(저장된 것 없음) → 호출 0번
```

MobileMenu:

```ts
it('shows the tabs of the active group only') // active='dict' → list '개발자 도구' ['이벤트 사전'], '한눈에 보기' 없음
it('switches the tab list without navigating when a group is pressed')
// '지표' 세그먼트 클릭 → list '지표' ['한눈에 보기','사용자'], onSelect 호출 0번, '지표' aria-pressed="true"
it('follows the active menu to its group') // rerender active='links' → list '팀 운영', '팀 운영' aria-pressed="true"
it('hides the group switch when there is one group') // queryByRole('group', {name:'메뉴 그룹'}) == null
it('scrolls the active tab into view') // Element.prototype.scrollIntoView 스파이가 호출됨
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/admin/menu/collapsed.test.ts src/admin/components/menus.test.tsx`
Expected: FAIL

- [ ] **Step 4: `collapsed.ts`, `useIsDesktop.ts`, `SideMenu.tsx`, `MobileMenu.tsx` 구현**

`Shell.tsx`는 이 Task에서 `SideMenu`에 `groups={REGISTRY.groups}`만 넘기도록 고쳐 빌드가 깨지지 않게 한다. 화면 폭에 따른 선택은 Task 5에서 한다.

- [ ] **Step 5: 스타일 작성 (`admin.css`)**

기존 `.adm-menu*` 규칙을 아래로 바꾼다.

- 사이드바(`.adm-menu--side`): 폭 `240px`, 오른쪽 테두리, `position: sticky; top: 0; max-height: 100dvh; overflow-y: auto`.
- 그룹 제목(`.adm-menu__group`): `--adm-fs-xs`, `--adm-fw-bold`, `--adm-text-3`, 높이 `--adm-hit`, 오른쪽에 `ChevronDown` 아이콘(접히면 -90도 회전, `--adm-duration`).
- 항목(`.adm-menu__item`): 아이콘 18px과 라벨 사이 `--adm-space-3`, 지금의 hover와 `aria-current` 색을 유지한다.
- 모바일(`.adm-menu--mobile`): 세그먼트는 `--adm-surface-muted` 바탕의 pill 묶음, 눌린 버튼은 `--adm-surface` 바탕에 `--adm-shadow-card`. 탭 목록은 가로 스크롤, 스크롤바 숨김.
- `prefers-reduced-motion: reduce`에서 회전과 배경 전환을 끈다.

- [ ] **Step 6: `App.test.tsx` 고치기**

'lists all six menus'는 `within(nav).getByRole('list', { name: '지표' })` 안의 버튼만 보도록 바꾼다. 다른 그룹에 메뉴가 생겨도 깨지지 않는다. 'restores menu and period…'의 `within(nav).getByRole('button', { name: … })` 기대는 그대로 통과해야 한다.

- [ ] **Step 7: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/admin
git commit -m "feat(admin): add grouped side menu and mobile group menu"
```

---

### Task 4: 빠른 이동

**Files:**
- Create: `src/admin/components/CommandMenu.tsx`
- Modify: `src/admin/styles/admin.css`, `package.json`, `package-lock.json`
- Test: `src/admin/components/CommandMenu.test.tsx`

**Interfaces:**
- Consumes: `MenuGroup`, `MenuDef` (Task 1)
- Produces:

```ts
export function matchesQuery(menu: MenuDef, query: string): boolean
export function CommandMenu(props: {
  groups: readonly MenuGroup[]
  open: boolean
  onOpenChange(open: boolean): void
  onSelect(id: string): void
}): ReactElement
```

**규칙:**
- `matchesQuery`: `label`, `description`, `keywords`를 공백으로 이은 글자를 소문자로 바꾼 것에, 앞뒤 공백을 뺀 소문자 검색어가 들어 있으면 `true`. 빈 검색어는 `true`.
- `npm install @radix-ui/react-dialog`로 직접 의존성에 넣는다. `cmdk`가 이미 쓰는 패키지다.
- `Dialog.Root`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content` 안에 `<Command label="빠른 이동" shouldFilter={false}>`를 둔다. `cmdk`의 `Command.Dialog`는 `onCloseAutoFocus`를 넘길 수 없어서 쓰지 않는다.
- `Dialog.Content` 안에 화면에는 안 보이는 `<Dialog.Title>빠른 이동</Dialog.Title>`을 둔다. dialog의 이름이 된다.
- 목록은 `matchesQuery`로 직접 거른다.
- 항목을 골라서 닫힐 때는 `onCloseAutoFocus`에서 `preventDefault()`를 부른다. 포커스가 검색 버튼으로 돌아가면 셸이 새 페이지 `<h1>`에 준 포커스를 덮어쓴다. Esc나 바깥을 눌러 닫힐 때는 기본 동작(연 곳으로 포커스 복귀)을 둔다.
- 입력창 placeholder `메뉴 이름으로 찾기`. 결과는 그룹 라벨을 heading으로 묶고 항목에 아이콘, 라벨, 설명을 보여 준다. 결과가 없으면 `찾는 메뉴가 없어요`.
- 항목을 고르면 `onSelect(id)` 뒤 `onOpenChange(false)`. 닫힐 때 검색어를 비운다.
- 컴포넌트가 `window`의 `keydown`을 듣는다. `(metaKey || ctrlKey) && (key.toLowerCase() === 'k' || code === 'KeyK')`이면(한글 입력 상태에서는 `key`가 `k`가 아닐 수 있다) `preventDefault()` 뒤 `onOpenChange(!open)`. 다른 조합은 건드리지 않는다.
- 한글 조합 중(`isComposing`)의 Enter는 항목 선택으로 이어지지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

Task 3과 같은 테스트용 그룹을 쓴다. `dict`의 `keywords`는 `['event', 'GA']`, `description`은 `'이벤트 이름과 뜻을 찾아요'`.

```ts
describe('matchesQuery', () => {
  it.each([
    ['', true], ['  ', true], ['이벤', true], ['사전', true], ['EVENT', true], ['ga', true], ['뜻을', true], ['링크', false],
  ])('query %j → %s', (q, expected) => expect(matchesQuery(dict, q)).toBe(expected))
})

it('opens on Cmd+K and Ctrl+K, prevents the default, and closes on a second press')
// open=false에서 fireEvent.keyDown(window,{key:'k',metaKey:true}) → onOpenChange(true), 이벤트 defaultPrevented
// {key:'K',ctrlKey:true}도 같음. open=true에서 누르면 onOpenChange(false)
it('ignores K without a modifier') // onOpenChange 호출 0번, defaultPrevented false
it('opens when the key is a Hangul jamo but the code is KeyK') // {key:'ㅏ', code:'KeyK', metaKey:true} → onOpenChange(true)
it('opens from a focused text input without typing into it')
// 바깥 <input>에 포커스 후 user.keyboard('{Meta>}k{/Meta}') → onOpenChange(true), input 값 ''
it('lists menus under their group headings when open')
// dialog '빠른 이동' 안에 '지표', '개발자 도구', '팀 운영' 텍스트와 option 4개
it('filters by partial Korean input and by keyword') // '이벤' 입력 → option ['이벤트 사전'], 'ga' 입력도 같음
it('shows the empty message') // '없는메뉴' 입력 → '찾는 메뉴가 없어요'
it('selects with Enter and closes') // '링크' 입력 후 Enter → onSelect('links'), onOpenChange(false)
it('does not select on Enter during IME composition')
// 입력창에 fireEvent.keyDown({key:'Enter', isComposing:true}) → onSelect 호출 0번
it('closes on Escape and returns focus to the opener') // onOpenChange(false), 열기 전에 포커스가 있던 버튼에 다시 포커스
it('does not return focus to the opener after a selection')
// 바깥 버튼에 포커스 → 열기 → 항목 선택 → waitFor 뒤에도 그 버튼에 포커스가 없다
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/admin/components/CommandMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: 의존성 설치, `CommandMenu.tsx` 구현과 스타일**

스타일: 화면 위쪽 20% 지점의 가운데 패널, 최대 폭 `560px`, `--adm-surface` 바탕, `--adm-radius-lg`, `--adm-shadow-pop`. 뒤 배경은 반투명 어둡게(토큰 `--adm-text-1`에 투명도). 고른 항목은 `--adm-accent-soft` 바탕. 항목 높이 `--adm-hit` 이상. 열릴 때 살짝 올라오며 나타나는 전환(`--adm-duration`)은 `prefers-reduced-motion: reduce`에서 끈다.

- [ ] **Step 4: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/admin
git commit -m "feat(admin): add command menu for quick navigation"
```

---

### Task 5: 페이지 헤더, 페이지 영역, 셸 조립

**Files:**
- Create: `src/admin/components/PageHeader.tsx`, `src/admin/components/PageOutlet.tsx`
- Modify: `src/admin/components/Shell.tsx`, `src/admin/styles/admin.css`, `src/admin/pages/{Overview,Users,Events,Retention,Tech,Realtime}Page.tsx`, `src/admin/App.test.tsx`, `src/admin/pages/pages.test.tsx`, `src/admin/pages/pages2.test.tsx`
- Test: `src/admin/components/shell.test.tsx`

**Interfaces:**
- Consumes: `REGISTRY`, `Registry`, `MenuDef` (Task 1), `useNav` (Task 2), `SideMenu`, `MobileMenu`, `useIsDesktop` (Task 3), `CommandMenu` (Task 4), `useGa`, `PeriodFilter`, `QuotaBadge`
- Produces:

```ts
// PageHeader.tsx
export function PageHeader(props: { menu: MenuDef }): ReactElement
// PageOutlet.tsx
export function PageOutlet(props: { menu: MenuDef }): ReactElement
export function prefetchPages(menus: readonly MenuDef[]): () => void // 돌려주는 함수가 예약을 취소한다
// Shell.tsx
export function Shell(props: { registry?: Registry }): ReactElement // 기본 REGISTRY
```

테스트에서 메뉴를 바꿔 넣을 때는 `<NavProvider lookup={registry.lookup}>`과 `<Shell registry={registry} />`에 같은 레지스트리를 넘긴다.

**`PageHeader` 규칙:**
- `<header className="adm-page-header">` 안에 `<h1 className="adm-page__title" tabIndex={-1}>{label}</h1>`과 `<p className="adm-page-header__desc">{description}</p>`.
- `menu.usesPeriod`가 참이면 도구 자리에 `PeriodFilter`(값은 `useGa()`의 `period`, `today`, `periodError`, `setPeriod`)와 `기준: 어제까지, 한국 시간`.
- `menu.id`가 바뀌면 `<h1>`에 포커스를 준다. 처음 렌더할 때는 주지 않는다. 판단은 `menu.id`로 초기화한 이전 id ref와 비교해서 한다. "처음 실행인지" 플래그는 StrictMode의 effect 재실행에서 틀린다.
- `menu.id`가 바뀌거나 처음 렌더될 때 `document.title`을 `` `${label} · 파르페 대시보드` ``로 바꾼다.

**`PageOutlet` 규칙:**
- lazy 컴포넌트는 모듈 수준 `WeakMap<MenuDef, LazyExoticComponent<ComponentType>>`에 캐시한다. 키는 id가 아니라 `MenuDef` 객체다. 테스트마다 새로 만든 메뉴 정의가 앞 테스트의 캐시를 물려받지 않는다.
- `PageOutlet`이 `attempt` 상태(다시 시도한 횟수)를 가진다. `menu.id`가 바뀌면 0으로 되돌린다. lazy 컴포넌트는 `PageOutlet`의 렌더에서 캐시를 조회해 얻는다.
- `<Suspense>` fallback: `<p role="status">불러오는 중이에요</p>`.
- 오류 경계의 key는 `` `${menu.id}:${attempt}` ``. 오류 화면: `화면을 불러오지 못했어요`와 `다시 시도` 버튼.
- `다시 시도`: 그 메뉴 정의의 캐시를 지우고 `attempt`를 1 올린다. key가 바뀌어 경계가 새로 만들어지고 새 lazy 컴포넌트를 받는다.
- `attempt`가 1 이상인데 또 실패하면 `다시 시도` 옆에 `새로고침` 버튼과 `새로고침하면 다시 로그인해야 해요.`를 함께 보여 준다. `다시 시도`는 계속 보인다. `새로고침`은 `window.location.reload()`.
- 오류 경계가 오류를 잡으면 그때 그 메뉴 정의의 캐시를 지운다. 다른 메뉴로 갔다가 돌아오면 다시 받는다.
- `prefetchPages`: `requestIdleCallback`이 있으면 그것으로, 없으면 `setTimeout(…, 1500)`으로 각 메뉴의 `load()`를 부른다. 각 호출에 `.catch(() => {})`를 붙여 실패를 무시한다. 돌려주는 함수는 아직 실행되지 않은 예약을 취소한다.

**`Shell` 규칙:**
- 현재 메뉴는 `registry.findMenu(useNav().menu)`. 없으면 `registry.findMenu(registry.lookup.defaultMenu)`.
- 상단 바: 브랜드, 빠른 이동 버튼(`<button aria-label="메뉴 검색">`에 `Search` 아이콘, 글자 `검색`, 데스크톱에서만 `<kbd>`. `<kbd>` 글자는 `navigator.platform`이 `Mac`으로 시작하면 `⌘K`, 아니면 `Ctrl K`), 로그아웃. 기간 필터는 여기서 뺀다.
- `useIsDesktop()`이 참이면 `SideMenu`, 아니면 `MobileMenu`. 둘 중 하나만 렌더한다.
- `<main className="adm-page">` 안에 `PageHeader`와 `PageOutlet`.
- 푸터의 `QuotaBadge`는 현재 메뉴의 `usesGa`가 참일 때만.
- 마운트 effect에서 `prefetchPages(registry.menus)`를 부르고, 돌려받은 취소 함수를 effect의 cleanup으로 돌려준다. 로그아웃이나 StrictMode 재실행 뒤에 예약이 남지 않는다.
- `CommandMenu`의 `onSelect`는 `setMenu`.

**스타일:**
- `.adm-page-header`: 제목과 설명은 왼쪽, 도구 자리는 오른쪽, 아래 여백 `--adm-space-6`. `960px` 미만에서는 도구 자리가 설명 아래로 내려가 폭 전체를 쓴다.
- `.adm-page__title`의 아래 여백을 `--adm-space-1`로, 설명은 `--adm-fs-sm`, `--adm-text-2`.
- `.adm-page__title:focus`는 outline을 없앤다(`:focus-visible`은 기존 포커스 표시).
- `.adm-page__lead`의 위쪽 여백을 `0`으로 바꾼다.
- `.adm-topbar__filter`, `.adm-topbar__basis` 규칙은 `.adm-page-header__tools`, `.adm-page-header__basis`로 옮긴다.
- 푸터의 왼쪽 여백 계산에 있는 `220px`을 사이드바 폭 `240px`에 맞춘다.

- [ ] **Step 1: 실패하는 테스트 작성 (`shell.test.tsx`)**

`App.test.tsx`의 `useAuth`, `createGaClient` mock 방식을 그대로 쓰고, `QueryClientProvider > NavProvider > GaProvider > Shell`을 테스트용 레지스트리로 렌더한다. 테스트용 메뉴: `metrics`의 `a`(라벨 `에이`, 설명 `에이 설명`, `usesPeriod: true`, `usesGa: true`), `devtools`의 `b`(라벨 `비`, 설명 `비 설명`). 각 `load`는 `vi.fn`으로 `<p>에이 내용</p>`, `<p>비 내용</p>`을 주는 컴포넌트를 돌려준다. 기본 메뉴는 `a`. 메뉴 정의와 레지스트리는 `beforeEach`에서 새로 만든다.

```ts
it('renders the header from the menu and the lazy page')
// heading level 1 '에이', '에이 설명', await findByText('에이 내용')
it('shows the period filter and the basis note only for usesPeriod menus')
// a: 버튼 '최근 7일'과 '기준: 어제까지, 한국 시간' 있음. '비'로 이동 → 둘 다 없음
it('shows the quota badge only for usesGa menus')
// act(() => h.onQuota({tokensPerDay:{consumed:500,remaining:24500}})) → a에서 '오늘 조회 가능량 98% 남음', b에서 없음
it('moves focus to the heading and updates the title after a menu change, not on first render')
// <StrictMode>로 감싸 렌더한다. 처음: document.activeElement가 h1이 아님, document.title '에이 · 파르페 대시보드'
// '비' 클릭 → heading '비'에 포커스, document.title '비 · 파르페 대시보드'
it('shows a loading status while the page chunk is pending')
// load가 풀리지 않는 Promise → getByRole('status') '불러오는 중이에요', heading '비'와 nav는 보임
it('shows a retry button when the chunk fails and recovers on retry')
// b.load: 첫 호출 reject, 둘째 resolve → '화면을 불러오지 못했어요', '다시 시도' 클릭 → findByText('비 내용')
it('offers a reload with a re-login warning after a failed retry')
// b.load 항상 reject → 처음 오류 화면에는 '새로고침' 없음 → '다시 시도' 클릭 뒤 버튼 '새로고침', '다시 시도', 문구 '새로고침하면 다시 로그인해야 해요.'
it('tries again after leaving a failed menu and coming back')
// b.load: 첫 reject, 둘째 resolve → 오류 화면 → '에이' 클릭 → '비' 클릭 → findByText('비 내용')
it('renders the mobile menu instead of the side menu below 960px')
// matchMedia를 matches:false로 stub → getAllByRole('navigation',{name:'메뉴'}) 길이 1, role group '메뉴 그룹' 있음
it('opens the command menu from the top bar and navigates')
// 버튼 '메뉴 검색' 클릭 → dialog '빠른 이동' → '비' option 선택 → heading '비', URL '/admin/?menu=b'
// await waitFor(() => expect(heading '비').toHaveFocus())
it('labels the shortcut by platform')
// navigator.platform을 'MacIntel'로 stub → '⌘K', 'Win32'로 stub → 'Ctrl K'
it('prefetches the other page chunks when idle')
// vi.useFakeTimers → 1500ms 뒤 b.load 호출됨. finally에서 vi.useRealTimers()
it('cancels the scheduled prefetch on unmount')
// 렌더 직후 unmount → 가짜 타이머 1500ms 진행 → b.load 호출 0번
```

console.error는 오류 경계 테스트에서 `vi.spyOn(console, 'error').mockImplementation(() => {})`으로 막는다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/admin/components/shell.test.tsx`
Expected: FAIL

- [ ] **Step 3: `PageHeader.tsx`, `PageOutlet.tsx` 구현, `Shell.tsx` 조립, 스타일**

- [ ] **Step 4: 기존 6개 페이지에서 `<h1 className="adm-page__title">…</h1>` 한 줄씩 삭제**

- [ ] **Step 5: 기존 테스트 고치기**

- `App.test.tsx`: 페이지가 lazy가 됐으므로 페이지 내용에 대한 기대는 `findBy*`/`waitFor`로 바꾼다. `vi.mock('./pages/OverviewPage', …)`는 그대로 동작한다(메뉴 정의의 `load`가 같은 모듈을 import한다). 'restores menu and period…'의 `heading level 1 '많이 한 행동'` 기대는 그대로 통과해야 한다.
- `pages.test.tsx`, `pages2.test.tsx`: 페이지를 직접 렌더하므로 제목 `<h1>`을 찾는 기대가 있으면 지운다. 그 밖의 기대는 건드리지 않는다.

- [ ] **Step 6: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/admin
git commit -m "feat(admin): add shared page header, lazy page outlet, and new shell layout"
```

---

### Task 6: 페이지별 CSP 조각

**Files:**
- Create: `build/adminCsp.ts`
- Modify: `vite.config.ts`, `tsconfig.node.json`
- Test: `build/adminCsp.test.ts`

**Interfaces:**
- Produces:

```ts
export type CspFragment = { file: string; directives: Record<string, string[]> }
export const FRAGMENT_DIRECTIVES: readonly string[] // ['connect-src', 'img-src', 'frame-src']
export function readCspFragments(pagesDir: string): CspFragment[] // **/*.csp.json, file 경로 순 정렬
export function buildAdminCsp(fragments: readonly CspFragment[]): string
```

**규칙:**
- 기본 지시어 목록(지금 `vite.config.ts`의 `ADMIN_CSP` 배열과 주석)을 `build/adminCsp.ts`로 옮긴다.
- `buildAdminCsp([])`는 지금의 `ADMIN_CSP` 문자열과 같다.
- 조각의 주소는 해당 지시어 끝에 붙인다. 이미 있는 주소는 다시 붙이지 않는다.
- 아래는 `Error`를 던지고, 메시지에 조각 파일 경로를 넣는다.
  - `FRAGMENT_DIRECTIVES`에 없는 키
  - 값이 문자열 배열이 아님
  - `https://`로 시작하지 않는 주소
  - `*`가 들어간 주소
  - 공백, `;`, `,`, 따옴표가 들어간 주소
- `readCspFragments`는 `fs.readdirSync(pagesDir, { recursive: true })`로 찾는다. JSON 파싱 실패도 파일 경로를 넣어 던진다. 폴더가 없으면 `[]`.
- `vite.config.ts`의 `adminCsp()` 플러그인은 `buildAdminCsp(readCspFragments('src/admin/pages'))`를 쓴다.
- `tsconfig.node.json`의 `include`를 `["vite.config.ts", "build"]`로 바꾼다.

- [ ] **Step 1: 실패하는 테스트 작성**

먼저 고치기 전의 CSP를 파일로 남긴다.

Run: `npm run build && mkdir -p node_modules/.tmp && grep -o 'Content-Security-Policy" content="[^"]*"' dist/admin/index.html > node_modules/.tmp/csp-before.txt && cat node_modules/.tmp/csp-before.txt`

테스트 파일 맨 위에 `// @vitest-environment node`. `EXPECTED_BASE`는 위 출력의 `content="…"` 안 문자열을 그대로 옮겨 적은 리터럴이다. `tsconfig.node.json`이 `module: nodenext`라서 상대 import에는 확장자를 붙인다: 테스트에서 `./adminCsp.ts`, `vite.config.ts`에서 `./build/adminCsp.ts`.

```ts
it('equals the current CSP when there are no fragments', () => expect(buildAdminCsp([])).toBe(EXPECTED_BASE))
it('appends fragment sources to the matching directive', () => {
  const csp = buildAdminCsp([{ file: 'a.csp.json', directives: { 'connect-src': ['https://api.github.com'] } }])
  expect(csp).toContain("connect-src 'self' https://analyticsdata.googleapis.com https://accounts.google.com/gsi/ https://oauth2.googleapis.com https://api.github.com")
  expect(csp.replace(' https://api.github.com', '')).toBe(EXPECTED_BASE)
})
it('does not repeat a source that is already allowed', () => {
  const f = { file: 'a.csp.json', directives: { 'connect-src': ['https://oauth2.googleapis.com'] } }
  expect(buildAdminCsp([f, f])).toBe(EXPECTED_BASE)
})
it.each([
  ['script-src', ['https://evil.example']],
  ['default-src', ['https://a.example']],
  ['connect-src', ['http://a.example']],
  ['connect-src', ['https://*.example.com']],
  ['connect-src', ['*']],
  ['connect-src', ["'unsafe-inline'"]],
  ['connect-src', ['https://a.example; script-src *']],
  ['connect-src', ['https://a.example https://b.example']],
  ['img-src', 'https://a.example'],
])('rejects %s %j and names the file', (directive, value) => {
  expect(() => buildAdminCsp([{ file: 'pages/x/x.csp.json', directives: { [directive]: value as string[] } }])).toThrow(/x\.csp\.json/)
})
it('reads fragments recursively, sorted by path, and ignores other files')
// os.tmpdir()에 b/x.csp.json, a/deep/y.csp.json, a/z.json을 만들고 → file이 ['a/deep/y.csp.json','b/x.csp.json']로 끝남
it('names the file when a fragment is not valid JSON') // toThrow(/bad\.csp\.json/)
it('returns [] when the directory does not exist')
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run build/adminCsp.test.ts`
Expected: FAIL

- [ ] **Step 3: `build/adminCsp.ts` 구현, `vite.config.ts`와 `tsconfig.node.json` 고치기**

- [ ] **Step 4: 통과와 빌드 결과 확인**

Run: `npm run typecheck && npm test && npm run build && grep -o 'Content-Security-Policy" content="[^"]*"' dist/admin/index.html | diff - node_modules/.tmp/csp-before.txt && echo SAME`
Expected: PASS, 마지막 줄에 `SAME`. `diff` 출력이 없다.

- [ ] **Step 5: Commit**

```bash
git add build vite.config.ts tsconfig.node.json
git commit -m "feat(admin): merge per-page CSP fragments into the admin CSP at build time"
```

---

### Task 7: 문서와 완료 기준 확인

**Files:**
- Modify: `README.md`, `docs/superpowers/2026-09-29-ga-admin-manual-checklist.md`

- [ ] **Step 1: README에 "어드민 메뉴 추가하기" 절 추가**

"어드민 대시보드 설정" 절 뒤에 둔다. 해요체로 아래를 적는다.
- 페이지 컴포넌트와 `<이름>.menu.ts`를 `src/admin/pages/<그룹>/` 아래에 만든다. `*.menu.ts` 예시는 스펙 §2의 코드 블록을 쓴다.
- 필요하면 같은 폴더에 `<이름>.css`(클래스는 `adm-<메뉴 id>-`로 시작), `config.ts`, `<이름>.csp.json`을 둔다. CSP 조각은 `connect-src`, `img-src`, `frame-src`만, `https://` 주소만 된다.
- URL에 상태를 두려면 `usePageParam`을 쓴다.
- `Shell.tsx`, `SideMenu.tsx`, `registry.ts`, `urlState.ts`, `admin.css`, `vite.config.ts`, `src/admin/config.ts`는 고치지 않는다.
- `order` 예약 범위는 스펙 §2 표를 가리킨다.

- [ ] **Step 2: 개수 표현 고치기**

- `README.md`의 "메뉴 6개에 데이터 표시 확인" → "지표 메뉴마다 데이터 표시 확인"
- 체크리스트 18번째 줄의 "메뉴 6개(…)" → "지표 메뉴(…)". 괄호 안 목록은 그대로 둔다.
- 체크리스트에 항목을 더한다: 그룹 접기와 새로고침 뒤 유지, `⌘K` 빠른 이동, 메뉴 이동 뒤 브라우저 뒤로 가기, 모바일 폭에서 그룹 전환, 다크 모드, 예전 링크 `?menu=events&period=28d`로 들어가 같은 화면이 나오는지.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/2026-09-29-ga-admin-manual-checklist.md
git commit -m "docs: describe how to add an admin menu and update the manual checklist"
```

- [ ] **Step 4: 완료 기준 확인 — 폴더 하나만으로 메뉴가 생기는지**

임시 폴더 `src/admin/pages/devtools/probe/`에 아래 다섯을 만든다. 이 폴더는 커밋하지 않는다.
- `ProbePage.tsx`: `<p className="adm-probe-text">probe</p>`를 그리고 `./probe.css`를 import
- `probe.css`: `.adm-probe-text { color: var(--adm-text-2); }`
- `probe.menu.ts`: `id: 'probe'`, `group: 'devtools'`, `order: 100`, `label: '프로브'`, `description: '임시 확인용'`, 아이콘 `FlaskConical`
- `probe.csp.json`: `{ "connect-src": ["https://api.github.com"] }`
- `probe.test.tsx`: `src/admin/App.test.tsx`와 같은 mock(`../../../config`, `../../../auth/AuthContext`, `../../../ga/client`)을 쓰고 `/admin/?menu=probe`에서 `<App />`을 렌더한다. 실제 레지스트리를 쓴다.

```ts
it('shows the probe menu in the side menu, header, page and URL')
// nav 안 list '개발자 도구'에 버튼 '프로브'(aria-current="page"), heading level 1 '프로브', await findByText('probe')
// location.search == '?menu=probe'
it('lists the probe menu in the command menu')
// 버튼 '메뉴 검색' 클릭 → dialog '빠른 이동' 안에 option '프로브'
it('shows the probe group in the mobile menu')
// matchMedia를 matches:false로 stub → role group '메뉴 그룹' 안에 버튼 '개발자 도구', list '개발자 도구'에 '프로브'
```

Run: `git status --short && npm run typecheck && npm test && npm run build && grep -c 'https://api.github.com' dist/admin/index.html && grep -l 'adm-probe-text' dist/assets/*.css`
Expected:
- `git status --short`에 `?? src/admin/pages/devtools/` 한 줄만 나온다.
- typecheck, test, build 통과. 기존 테스트가 하나도 깨지지 않고 `probe.test.tsx`의 3개가 통과한다.
- `grep -c` 출력이 `1`.
- 마지막 `grep -l`이 CSS 파일 하나를 출력한다.

- [ ] **Step 5: 임시 폴더 삭제와 번들 확인**

Run: `rm -r src/admin/pages/devtools && git status --short && npm run build && grep -c 'api.github.com' dist/admin/index.html; for f in $(grep -oE 'assets/[^"]+\.js' dist/index.html); do grep -lE 'cmdk|lucide|radix' "dist/$f"; done; echo DONE`
Expected:
- `git status --short` 출력이 없다.
- `grep -c` 출력이 `0`.
- 그 뒤로 `DONE`만 나온다. 멀티링크 페이지가 불러오는 스크립트에 `cmdk`, `lucide`, `radix`가 없다는 뜻이다.

`npm run typecheck && npm test`를 한 번 더 돌려 통과를 확인한다. 이 Step은 커밋할 것이 없다.
