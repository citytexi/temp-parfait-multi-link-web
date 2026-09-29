# GA 어드민 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정적 멀티링크 페이지를 Vite + React로 옮기고, `/admin/`에 비개발 직군도 읽기 쉬운 GA4 대시보드를 추가한다.

**Architecture:** Vite multi-page 빌드로 `index.html`(멀티링크)과 `admin/index.html`(대시보드)을 별도 엔트리로 만든다. 대시보드는 Google Identity Services로 브라우저에서 `analytics.readonly` 토큰을 받고 GA4 Data API REST를 직접 호출한다. 요청 생성과 응답 변환은 순수 함수로 분리하고, 화면은 TanStack Query 훅 위에 올린다. GitHub Actions가 테스트 후 GitHub Pages로 배포한다.

**Tech Stack:** Vite (react-ts 템플릿 최신 안정판), React, TypeScript, TanStack Query v5, Recharts, Vitest, @testing-library/react, jsdom, npm

**Spec:** `docs/superpowers/specs/2026-09-29-ga-admin-dashboard-design.md`

## Global Constraints

- repo는 public. 비밀값(service account 키, client secret)을 repo와 빌드 결과물에 넣지 않는다.
- 유료 서비스 금지: BigQuery, Cloud Functions, Firebase Blaze 사용 안 함.
- Vite `base`: `'/temp-parfait-multi-link-web/'`
- OAuth scope: `https://www.googleapis.com/auth/analytics.readonly` 하나만.
- 토큰은 메모리에만 둔다. `localStorage`, `sessionStorage`, cookie 저장 금지.
- GA Data API base URL: `https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}`
- TanStack Query `staleTime`: `10 * 60 * 1000`. 실시간 `refetchInterval`: `60 * 1000`, 백그라운드 탭에서는 멈춤.
- 기본 기간 종료일은 어제. 시간대는 `Asia/Seoul`.
- 화면 문구는 해요체. 증감 표시는 `▲ 12%` / `▼ 3%`처럼 기호와 텍스트를 같이 쓴다.
- 폰트는 Pretendard(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`).
- 접근성: 대비 4.5:1 이상, 키보드 이동, 보이는 focus 표시.
- 커밋 메시지는 Conventional Commits, 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. 직접 선택 기간에서 시작일 > 종료일, 종료일이 오늘 이후, 기간이 366일 초과 → 잘못된 값은 조회하지 않고 필터 옆에 이유를 보여준다. (Task 4 테스트)
2. GA 응답에 `rows`가 없음(데이터 0건) → 크래시 없이 빈 상태 문구. (Task 6 테스트)
3. 실시간 자동 새로고침 중 토큰 만료 → 인증 만료 화면으로 바뀌고 polling이 멈춘다. (Task 9 테스트)
4. CSV 값에 쉼표, 큰따옴표, 줄바꿈, 한글 포함 → 올바르게 escape되고 BOM이 붙는다. (Task 4 테스트)
5. 국가/앱 버전 값 `(not set)`, `(other)` → "알 수 없음", "기타"로 보인다. (Task 6 테스트)

---

## File Structure

```
index.html                         멀티링크 엔트리. OG meta, <head> 인라인 리다이렉트
admin/index.html                   어드민 엔트리. noindex, referrer, GIS 스크립트
public/icon-512.png                (이동) 기존 root 파일
public/assets/dot.svg, hero.jpg    (이동) 기존 assets/
vite.config.ts                     base, multi-page input, build 전용 CSP 플러그인, vitest 설정
src/test/setup.ts                  jest-dom 등록
src/landing/
  main.tsx                         createRoot
  Landing.tsx                      버튼 노출 분기 UI
  landing.css                      기존 <style> 이식
  ua.ts                            UA 판정, 링크 생성 (순수)
src/admin/
  main.tsx                         createRoot + QueryClientProvider + AuthProvider
  App.tsx                          게이트(설정 누락 / 로그인 / 인증 에러) + Shell
  config.ts                        GA_PROPERTY_ID, OAUTH_CLIENT_ID (공개값)
  lib/format.ts                    숫자, 시간, 증감 포맷
  lib/csv.ts                       CSV 생성, 다운로드
  lib/period.ts                    기간 모델, 날짜 범위 계산, 검증
  lib/urlState.ts                  메뉴/기간 ↔ URL query
  ga/types.ts                      GA 요청/응답 타입
  ga/errors.ts                     GaError, 분류 함수
  ga/client.ts                     fetch 래퍼, quota 콜백
  ga/eventLabels.ts                이벤트 한글 이름 사전
  ga/reports/common.ts             delta 계산, row 변환, dateRange 분리
  ga/reports/{overview,users,events,retention,tech,realtime}.ts
  auth/gis.ts                      GIS 로드, token client 생성, revoke
  auth/AuthContext.tsx             토큰 상태, login/logout, 만료 처리
  hooks/useGa.ts                   client 생성, 공통 query 옵션, quota 상태
  hooks/useReports.ts              메뉴별 훅 6개
  styles/tokens.css                색, 간격, 반경, 타이포 토큰 (light/dark)
  styles/admin.css                 레이아웃, 컴포넌트 스타일
  components/                      Shell, SideMenu, PeriodFilter, Card, StatCard,
                                   InfoTip, Delta, CardState, DataTable, CsvButton,
                                   FullScreenState, QuotaBadge
  pages/{Overview,Users,Events,Retention,Tech,Realtime}Page.tsx
.github/workflows/deploy.yml
```

---

### Task 1: Vite 프로젝트 골격과 multi-page 빌드

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `src/test/setup.ts`, `admin/index.html`, `src/admin/main.tsx`(임시 "관리자 페이지" 텍스트), `src/landing/main.tsx`(임시)
- Move: `icon-512.png` → `public/icon-512.png`, `assets/` → `public/assets/`
- Modify: `index.html` (임시로 `<script type="module" src="/src/landing/main.tsx">` 추가. 기존 마크업 유지)
- Modify: `.gitignore` (생성: `node_modules`, `dist`)

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test`(= `vitest run`), `npm run typecheck`(= `tsc -b --noEmit`) 스크립트.

- [ ] **Step 1:** 빈 임시 디렉터리에서 `npm create vite@latest scaffold -- --template react-ts`로 템플릿을 만든 뒤 설정 파일만 repo로 복사한다. 데모 파일(`App.tsx`, `App.css`, `assets/react.svg`, `public/vite.svg`)은 가져오지 않는다.
- [ ] **Step 2:** 의존성 설치: `npm i @tanstack/react-query recharts`, `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`.
- [ ] **Step 3:** `vite.config.ts`: `base: '/temp-parfait-multi-link-web/'`, `build.rollupOptions.input = { main: 'index.html', admin: 'admin/index.html' }`, `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] }`.
- [ ] **Step 4:** `git mv`로 이미지 파일을 `public/`으로 옮긴다.
- [ ] **Step 5:** 빌드 확인. Run: `npm run build && ls dist dist/admin dist/assets`. Expected: `dist/index.html`, `dist/admin/index.html`, `dist/icon-512.png`, `dist/assets/dot.svg`, `dist/assets/hero.jpg` 존재.
- [ ] **Step 6:** `npm run dev` 후 `curl -s localhost:5173/temp-parfait-multi-link-web/admin/ | grep main.tsx`로 어드민 엔트리가 서빙되는지 확인.
- [ ] **Step 7:** Commit: `chore: scaffold vite react multi-page project`

### Task 2: 멀티링크 React 이식

**Files:**
- Create: `src/landing/ua.ts`, `src/landing/ua.test.ts`, `src/landing/Landing.tsx`, `src/landing/Landing.test.tsx`, `src/landing/landing.css`
- Modify: `src/landing/main.tsx`, `index.html`

**Interfaces:**
- Produces:
  - `type Platform = { os: 'ios' | 'android' | 'other'; inApp: boolean; kakao: boolean }`
  - `detectPlatform(ua: string, maxTouchPoints: number): Platform`
  - `PACKAGE = 'com.teamyg.parfait'`, `PLAY_WEB_URL`, `APP_STORE_URL` (현재 `index.html` 값 그대로)
  - `playIntentUrl(): string` — `intent://details?id=...#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=<encoded PLAY_WEB_URL>;end`
  - `externalBrowserUrl(pageUrl: string, kakao: boolean): string` — `#` 이후 제거, 카카오는 `kakaotalk://web/openExternal?url=`, 그 외 Chrome intent

- [ ] **Step 1: 실패 테스트 작성** `ua.test.ts`. 실제 UA 문자열로 다음을 단언한다.
  - iPhone Safari → `{ os: 'ios', inApp: false, kakao: false }`
  - `Macintosh` UA + `maxTouchPoints 5` → `os: 'ios'`; 같은 UA + `0` → `os: 'other'`
  - Android Chrome → `{ os: 'android', inApp: false }`
  - Android + `KAKAOTALK` → `{ inApp: true, kakao: true }`; `Instagram`, `NAVER`, `FBAV`, `Line/`, `Threads` 각각 `inApp: true`
  - Windows Chrome → `os: 'other'`
  - `externalBrowserUrl('https://a.b/c?x=1#frag', false)`가 `intent://a.b/c?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fa.b%2Fc%3Fx%3D1;end`와 같음
  - `externalBrowserUrl('https://a.b/c', true)` === `'kakaotalk://web/openExternal?url=https%3A%2F%2Fa.b%2Fc'`
- [ ] **Step 2:** Run `npx vitest run src/landing/ua.test.ts`. Expected: FAIL (모듈 없음).
- [ ] **Step 3:** `ua.ts` 구현. 정규식은 현재 `index.html` 스크립트의 것을 그대로 쓴다.
- [ ] **Step 4:** Run 같은 명령. Expected: PASS.
- [ ] **Step 5: 실패 테스트 작성** `Landing.test.tsx`. `<Landing platform={...} pageUrl="https://x/y" />`를 렌더하고 단언한다.
  - ios: "App Store에서 다운로드"만 보임, "Google Play에서 다운로드" 없음
  - other: 두 버튼 모두 보임, 외부 브라우저 버튼과 안내 문구 없음
  - android + inApp: Google Play 버튼 href가 `playIntentUrl()`, "외부 브라우저로 열기" 버튼과 `⋮` 안내 문구 보임, App Store 버튼 없음
- [ ] **Step 6:** Run `npx vitest run src/landing`. Expected: FAIL.
- [ ] **Step 7:** `Landing.tsx` 구현. 마크업(class 이름, 문구, alt, width/height)은 현재 `index.html` `<main>`과 같게 둔다. 이미지 경로는 `${import.meta.env.BASE_URL}assets/...`. `landing.css`는 현재 `<style>` 내용을 그대로 옮긴다. `main.tsx`는 `detectPlatform(navigator.userAgent, navigator.maxTouchPoints)`와 `location.href`를 넘긴다.
- [ ] **Step 8:** `index.html` 정리: `<head>`의 meta, Pretendard link는 유지하고 `<style>`와 `<main>`, 기존 `<script>`는 제거한다. `<body>`에는 `<div id="root"></div>`만 둔다. `<head>` 끝에 인라인 스크립트를 넣는다. 이 스크립트는 Android이고 인앱이 아니면 `location.replace(playIntentUrl)`만 한다. 판정 정규식은 `ua.ts`와 같은 값을 쓰고, 두 곳이 같아야 한다는 주석을 양쪽에 단다.
- [ ] **Step 9:** Run `npx vitest run src/landing && npm run build`. Expected: PASS, build 성공.
- [ ] **Step 10:** 수동 비교: `npm run preview`로 연 페이지와 `git show develop:index.html`을 브라우저에서 연 페이지를 데스크톱 폭과 모바일 폭(DevTools iPhone, Android UA)에서 비교. 레이아웃이 같아야 함.
- [ ] **Step 11:** Commit: `feat: port multi-link landing page to react`

### Task 3: GitHub Actions 배포

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1:** `deploy.yml` 작성. `on: push: branches: [main]`과 `workflow_dispatch`. `permissions: { contents: read, pages: write, id-token: write }`. `concurrency: { group: pages, cancel-in-progress: false }`. build job: `actions/checkout@v4` → `actions/setup-node@v4`(`node-version: 22`, `cache: npm`) → `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3`(`path: dist`). deploy job: `needs: build`, `environment: github-pages`, `actions/deploy-pages@v4`. secret은 쓰지 않는다.
- [ ] **Step 2:** YAML 문법 확인. Run: `npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo ok`. Expected: `ok`.
- [ ] **Step 3:** `README.md`에 추가: 로컬 실행(`npm ci`, `npm run dev`, 두 URL), 테스트, 배포 방식, 스펙 7장의 "1회 수동 세팅" 6단계, `src/admin/config.ts` 값 채우는 방법.
- [ ] **Step 4:** Commit: `ci: deploy to github pages via actions`

### Task 4: 어드민 순수 유틸 (포맷, CSV, 기간, URL 상태, 이벤트 이름)

**Files:**
- Create: `src/admin/lib/format.ts`, `csv.ts`, `period.ts`, `urlState.ts`, `src/admin/ga/eventLabels.ts` 와 각 `*.test.ts`

**Interfaces:**
- Produces:
  - `formatNumber(n: number): string` — `1234` → `'1,234'`
  - `formatDuration(sec: number): string` — `0` → `'0초'`, `45` → `'45초'`, `192` → `'3분 12초'`, `3725` → `'1시간 2분'`
  - `type Delta = { ratio: number | null; text: string; tone: 'up' | 'down' | 'flat' | 'none' }`
  - `computeDelta(current: number, previous: number): Delta` — previous 0이면 `{ ratio: null, text: '비교 불가', tone: 'none' }`; 같으면 `'변화 없음'`, `'flat'`; 그 외 소수점 없이 반올림 `'▲ 12%'` / `'▼ 3%'`
  - `toCsv(headers: string[], rows: (string | number)[][]): string` — `'﻿'` 시작, CRLF 줄바꿈, `,` `"` `\n` 포함 값은 큰따옴표로 감싸고 `"`는 `""`
  - `downloadCsv(filename: string, csv: string): void` — Blob + 임시 `<a download>`
  - `type PresetId = '7d' | '28d' | '90d'`
  - `type Period = { kind: 'preset'; preset: PresetId } | { kind: 'custom'; start: string; end: string }` (날짜는 `YYYY-MM-DD`)
  - `type DateRange = { startDate: string; endDate: string }`
  - `seoulToday(now: Date): string` — `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })`
  - `resolveRanges(period: Period, today: string): { current: DateRange; previous: DateRange; days: number }` — preset은 종료일 = 어제, 시작일 = 종료일 − (n−1). previous는 current 바로 앞 같은 길이.
  - `validatePeriod(period: Period, today: string): string | null` — 에러 문구 또는 null. 문구: `'시작일이 종료일보다 늦어요'`, `'종료일은 어제까지 고를 수 있어요'`, `'최대 366일까지 볼 수 있어요'`
  - `periodLabel(period: Period): string` — `'최근 7일'`, `'최근 28일'`, `'최근 90일'`, custom은 `'2026.09.01 ~ 2026.09.28'`
  - `type MenuId = 'overview' | 'users' | 'events' | 'retention' | 'tech' | 'realtime'`
  - `type UrlState = { menu: MenuId; period: Period }`
  - `parseUrlState(search: string): UrlState` — 기본 `{ menu: 'overview', period: preset '7d' }`. 모르는 menu, 모르는 period, 형식이 틀린 날짜는 기본값으로.
  - `toSearch(state: UrlState): string` — `?menu=events&period=28d` 또는 `?menu=events&start=2026-09-01&end=2026-09-28`
  - `eventLabel(name: string): { label: string; registered: boolean }`. 초기 사전: `first_open: '처음 앱 열기'`, `session_start: '앱 실행'`, `screen_view: '화면 조회'`, `user_engagement: '앱 사용'`, `app_update: '앱 업데이트'`, `app_remove: '앱 삭제'`, `os_update: 'OS 업데이트'`, `notification_receive: '알림 받음'`, `notification_open: '알림 열기'`, `app_exception: '앱 오류'`. 미등록은 `{ label: name, registered: false }`.

- [ ] **Step 1:** 위 Interfaces의 모든 예시 값과 아래 경계값을 단언하는 테스트 작성.
  - `computeDelta(0, 0)` → `'비교 불가'`; `computeDelta(112, 100)` → `'▲ 12%'`, `'up'`; `computeDelta(97, 100)` → `'▼ 3%'`, `'down'`
  - `toCsv(['이름','값'], [['a,b', 'say "hi"'], ['줄\n바꿈', 3]])` === `'﻿이름,값\r\n"a,b","say ""hi"""\r\n"줄\n바꿈",3'`
  - `resolveRanges({kind:'preset',preset:'7d'}, '2026-09-29')` → current `2026-09-22 ~ 2026-09-28`, previous `2026-09-15 ~ 2026-09-21`, days 7. 월 경계: today `'2026-03-01'`, 7d → current `2026-02-22 ~ 2026-02-28`
  - `validatePeriod` 세 가지 에러와 정상(null). `end === today`면 에러.
  - `seoulToday(new Date('2026-09-28T16:30:00Z'))` === `'2026-09-29'`
  - `parseUrlState('?menu=nope&period=5d')` → 기본값; `parseUrlState(toSearch(x))`가 x와 같음(preset, custom 각각)
- [ ] **Step 2:** Run `npx vitest run src/admin/lib src/admin/ga/eventLabels.test.ts`. Expected: FAIL.
- [ ] **Step 3:** 구현. 날짜 연산은 UTC 기준 `Date`로 `YYYY-MM-DD`를 다룬다(시간대 흔들림 방지). 외부 날짜 라이브러리는 쓰지 않는다.
- [ ] **Step 4:** Run 같은 명령. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): add format, csv, period and url state utils`

### Task 5: GA 클라이언트와 에러 분류

**Files:**
- Create: `src/admin/ga/types.ts`, `errors.ts`, `client.ts`, `client.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `RunReportRequest`, `RunRealtimeReportRequest`, `RunReportResponse = { dimensionHeaders?: {name:string}[]; metricHeaders?: {name:string; type?:string}[]; rows?: { dimensionValues: {value:string}[]; metricValues: {value:string}[] }[]; rowCount?: number; propertyQuota?: PropertyQuota }`, `PropertyQuota = { tokensPerDay?: { consumed: number; remaining: number } }`, `BatchRunReportsResponse = { reports: RunReportResponse[] }`
  - `type GaErrorKind = 'auth' | 'forbidden' | 'quota' | 'network' | 'server' | 'bad_request'`
  - `class GaError extends Error { kind: GaErrorKind; status?: number }`
  - `isRetryable(e: unknown): boolean` — `network`, `server`만 true
  - `createGaClient(opts: { propertyId: string; getToken: () => string | null; onQuota?: (q: PropertyQuota) => void; fetchImpl?: typeof fetch })` → `{ runReport(body: RunReportRequest): Promise<RunReportResponse>; batchRunReports(requests: RunReportRequest[]): Promise<BatchRunReportsResponse>; runRealtimeReport(body: RunRealtimeReportRequest): Promise<RunReportResponse> }`
- 규칙: `runReport`/`batchRunReports` 요청에 `returnPropertyQuota: true`를 자동 추가(batch는 각 request에). 응답의 `propertyQuota`가 있으면 `onQuota` 호출(batch는 마지막 report 기준). 토큰이 null이면 요청 없이 `GaError('auth')`.

- [ ] **Step 1:** 테스트 작성(`fetchImpl` mock).
  - 요청 URL `https://analyticsdata.googleapis.com/v1beta/properties/123:runReport`, method POST, 헤더 `Authorization: Bearer tok`, body에 `returnPropertyQuota: true`
  - 상태 401 → kind `auth`; 403 → `forbidden`; 429 → `quota`; 응답 body `error.status === 'RESOURCE_EXHAUSTED'`(상태 코드 무관) → `quota`; 400 → `bad_request`; 503 → `server`; fetch reject(TypeError) → `network`
  - `getToken` null → fetch 호출 0회, kind `auth`
  - `onQuota`가 `{ tokensPerDay: { consumed: 10, remaining: 199990 } }`로 호출됨
  - `isRetryable` 표
- [ ] **Step 2:** Run `npx vitest run src/admin/ga/client.test.ts`. Expected: FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** Run 같은 명령. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): add ga data api client with error classification`

### Task 6: 리포트 요청 생성과 응답 변환

**Files:**
- Create: `src/admin/ga/reports/common.ts`, `overview.ts`, `users.ts`, `events.ts`, `retention.ts`, `tech.ts`, `realtime.ts`, 각 `*.test.ts`, `src/admin/ga/reports/__fixtures__/*.json`

**Interfaces:**
- Consumes: Task 4 `DateRange`, `computeDelta`, `Delta`, `eventLabel`; Task 5 타입.
- Produces (모든 `build*`는 요청 body를, `parse*`는 화면 모델을 반환. 모든 `parse*`는 `rows` 없음을 빈 결과로 처리):
  - `common.ts`: `type Compared = { current: number; previous: number; delta: Delta }`; `splitByDateRange(res: RunReportResponse): { current: Row[]; previous: Row[] }` — 두 기간 요청 시 GA가 붙이는 `dateRange` 차원(`date_range_0`, `date_range_1`)으로 나눈다. `type Row = { dims: Record<string,string>; mets: Record<string,number> }`; `toRows(res): Row[]`; `displayDim(value: string): string` — `'(not set)'` → `'알 수 없음'`, `'(other)'` → `'기타'`, 그 외 그대로
  - `overview.ts`: `buildOverviewRequests(r: {current: DateRange; previous: DateRange}): RunReportRequest[]` — [0] 총계: metrics `activeUsers`, `newUsers`, `userEngagementDuration`, dateRanges 2개. [1] 추이: dimension `date`, metric `activeUsers`, current만, `orderBys` date 오름차순. `parseOverview(reports: RunReportResponse[]): OverviewModel`. `OverviewModel = { users: Compared; newUsers: Compared; avgEngagementSec: Compared; trend: { date: string; activeUsers: number }[] }`. avgEngagementSec = `userEngagementDuration / activeUsers`(activeUsers 0이면 0). `buildSummary(label: string, days: number | null, users: Compared): string` — `'지난 7일 동안 1,234명이 파르페를 썼어요. 그 전 7일보다 12% 늘었어요.'` / `'… 3% 줄었어요.'` / `'… 같아요.'`; days null(직접 선택)은 `'선택한 기간 동안 …. 그 전 같은 기간보다 …'`; delta none이면 두 번째 문장 생략
  - `users.ts`: `buildUsersRequests(r)` — [0] dimension `date`, metrics `active1DayUsers`, `active7DayUsers`, `active28DayUsers`; [1] dimension `newVsReturning`, metric `activeUsers`, dateRanges 2개. `parseUsers(reports): { trend: { date; dau; wau; mau }[]; newVsReturning: { label: '신규' | '재방문' | '알 수 없음'; users: Compared }[] }`
  - `events.ts`: `buildEventsRequest(r): RunReportRequest` — dimension `eventName`, metrics `eventCount`, `totalUsers`, dateRanges 2개, `orderBys` eventCount 내림차순, `limit: 20`(두 기간 행이 섞이므로 여유). `parseEvents(res): { name: string; label: string; registered: boolean; count: Compared; users: number }[]` — current 기준 count 내림차순 상위 10개
  - `retention.ts`: `buildRetentionRequest(today: string): RunReportRequest` — 오늘 이전의 완결된 주(일~토) 4개를 cohort로 만든다(`cohort_1`이 가장 오래된 주). `cohortsRange: { granularity: 'WEEKLY', startOffset: 0, endOffset: 4 }`, dimensions `cohort`, `cohortNthWeek`, metric `cohortActiveUsers`. `buildEngagementRequest(r)` — metrics `sessionsPerUser`, `userEngagementDuration`, `activeUsers`, dateRanges 2개. `parseRetention(res): { cohorts: { label: string; size: number; weeks: (number | null)[] }[] }` — `label`은 `'08.30 ~ 09.05'` 형식. `weeks[n]` = n주 후 활성 / 0주 활성 비율(0~1), 아직 오지 않은 주는 null. `parseEngagement(res): { sessionsPerUser: Compared; avgEngagementSec: Compared }`
  - `tech.ts`: `buildTechRequests(r)` — [0] dimension `platform`, [1] `country` limit 10, [2] `appVersion` limit 10; 모두 metric `activeUsers`, current만, 내림차순. `parseTech(reports): { platforms: Share[]; countries: Share[]; appVersions: Share[] }`, `Share = { label: string; users: number; ratio: number }`. label은 `displayDim` 적용.
  - `realtime.ts`: `buildRealtimeRequests(): RunRealtimeReportRequest[]` — [0] metric `activeUsers`만(총계), [1] dimension `minutesAgo`, metric `activeUsers`, `minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }]`. `parseRealtime(total, byMinute): { activeUsers: number; perMinute: { minutesAgo: number; users: number }[] }` — 0~29분 30칸을 채우고 빈 분은 0, minutesAgo 내림차순(차트 왼쪽이 과거).
- [ ] **Step 1:** fixture 작성. GA4 Data API 문서의 응답 형태를 따라 각 리포트별 JSON을 만든다. 두 기간 fixture에는 `dateRange` 차원을 포함한다.
- [ ] **Step 2:** 각 모듈 테스트 작성. 단언할 것:
  - 모든 `build*` 결과의 dimensions/metrics/dateRanges/orderBys/limit가 위 명세와 같음
  - `parse*`에 `{}`(rows 없음)를 넣으면 빈 배열/0 값, 예외 없음
  - `parseOverview` avgEngagementSec, delta 값
  - `buildSummary` 네 가지 문장
  - `parseEvents`가 미등록 이벤트에 `registered: false`
  - `buildRetentionRequest('2026-09-29')`(화) → cohort 주가 `2026-08-30~09-05`, `09-06~09-12`, `09-13~09-19`, `09-20~09-26`
  - `parseTech`가 `'(not set)'` → `'알 수 없음'`, `'(other)'` → `'기타'`, ratio 합 1
  - `parseRealtime` 30칸, 누락 분 0
- [ ] **Step 3:** Run `npx vitest run src/admin/ga/reports`. Expected: FAIL.
- [ ] **Step 4:** 구현.
- [ ] **Step 5:** Run 같은 명령. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(admin): add ga report builders and parsers`

### Task 7: Google 로그인 (GIS)

**Files:**
- Create: `src/admin/auth/gis.ts`, `src/admin/auth/AuthContext.tsx`, `src/admin/auth/AuthContext.test.tsx`, `src/admin/config.ts`
- Modify: `admin/index.html` (`<script src="https://accounts.google.com/gsi/client" async defer></script>`)

**Interfaces:**
- Produces:
  - `config.ts`: `export const GA_PROPERTY_ID = ''`, `export const OAUTH_CLIENT_ID = ''`, `isConfigured(): boolean`. 값은 사용자가 스펙 3장 수동 세팅 후 채운다. 구현자는 빈 문자열로 둔다.
  - `gis.ts`: `loadGis(timeoutMs = 10000): Promise<void>` (`window.google?.accounts?.oauth2` 대기), `createTokenClient(opts: { clientId: string; onToken: (t: { accessToken: string; expiresIn: number }) => void; onError: (kind: 'popup_closed' | 'popup_blocked' | 'denied' | 'unknown') => void }): { request(): void }`, `revokeToken(token: string): Promise<void>`
  - `type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'expired' | 'forbidden'`
  - `useAuth(): { status: AuthStatus; token: string | null; loginError: string | null; login(): void; logout(): Promise<void>; getToken(): string | null; reportAuthError(kind: 'auth' | 'forbidden'): void }`
  - `<AuthProvider clientId now?={() => number}>`
- 규칙: `getToken()`은 만료 시각(`now + expiresIn*1000 - 60_000`)이 지났으면 status를 `expired`로 바꾸고 null 반환. `reportAuthError('auth')` → `expired`, `('forbidden')` → `forbidden`. `logout` → revoke 후 `signedOut`, 토큰 null. `onError` 문구: popup_closed/popup_blocked → `'로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요.'`, denied → `'권한 허용이 필요해요. 다시 로그인해 주세요.'`, unknown → `'로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'`. 토큰을 어떤 저장소에도 쓰지 않는다.

- [ ] **Step 1:** 테스트 작성. `window.google.accounts.oauth2`를 가짜 객체로 주입한다.
  - 초기 `loading` → GIS 로드 후 `signedOut`
  - `login()` → 가짜 client의 callback이 `{ access_token: 't', expires_in: 3600 }`를 주면 `signedIn`, `getToken() === 't'`
  - `now`를 3600초 뒤로 옮기면 `getToken() === null`, status `expired`
  - `reportAuthError('forbidden')` → `forbidden`
  - `logout()` → `revoke`가 `'t'`로 호출되고 `signedOut`
  - error_callback `{ type: 'popup_closed' }` → `loginError`가 위 문구
  - 전 과정 후 `localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''`
- [ ] **Step 2:** Run `npx vitest run src/admin/auth`. Expected: FAIL.
- [ ] **Step 3:** 구현. GIS `initTokenClient`의 `error_callback`으로 팝업 에러를, 토큰 응답의 `error` 필드(`access_denied`)로 거부를 구분한다.
- [ ] **Step 4:** Run 같은 명령. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): add google sign-in with in-memory token`

### Task 8: 디자인 시스템과 공통 UI 컴포넌트

**Files:**
- Create: `src/admin/styles/tokens.css`, `src/admin/styles/admin.css`, `src/admin/components/{Card,StatCard,InfoTip,Delta,CardState,DataTable,CsvButton,FullScreenState}.tsx`, `src/admin/components/components.test.tsx`, `design-system/`(ui-ux-pro-max `--persist` 결과)

**Interfaces:**
- Consumes: Task 4 `Delta`, `formatNumber`, `toCsv`, `downloadCsv`.
- Produces:
  - `<Card title: string; subtitle?: string(원래 용어, 예 'DAU'); info?: string; action?: ReactNode>{children}</Card>`
  - `<StatCard title subtitle? info? value: string; delta?: Delta />`
  - `<InfoTip text: string />` — 버튼(`aria-label="설명 보기"`), hover와 focus와 탭 모두로 열림, Esc로 닫힘
  - `<DeltaText delta: Delta />` — tone별 색 + 텍스트 그대로
  - `<CardState query: { isPending: boolean; error: unknown; refetch(): void }; isEmpty: boolean>{children}</CardState>` — 로딩 스켈레톤 / 에러 문구(아래) + 다시 시도 버튼 / 빈 상태 `'이 기간에는 데이터가 없어요'` / children
    - `quota` → `'오늘 조회 한도를 다 썼어요. 한 시간 뒤나 내일 다시 시도해 주세요.'`
    - `network`, `server`, 그 외 → `'불러오지 못했어요'`
    - `auth`, `forbidden`은 렌더하지 않고 상위(Task 9)로 넘긴다
  - `<DataTable columns: { key: string; header: string; align?: 'left'|'right' }[]; rows: Record<string, ReactNode>[]; footnote?: string />`
  - `<CsvButton filename: string; headers: string[]; rows: (string|number)[][] />` — 라벨 `'CSV 받기'`
  - `<FullScreenState title: string; body?: string; actions?: ReactNode />`

- [ ] **Step 1:** ui-ux-pro-max로 디자인 시스템을 정한다. Run:
  `python3 ~/.claude/plugins/marketplaces/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py "analytics dashboard internal tool non-technical users fintech clean" --design-system -p "Parfait Admin" --persist --output-dir "$PWD"`
  이어서 `"dashboard kpi card trend" --domain chart`, `"tooltip keyboard focus" --domain ux`, `"react" --stack react`를 조회한다. 결과를 토스페이먼츠 대시보드 톤(흰 배경 위주, 넉넉한 여백, 파란 강조 1색, 둥근 카드, 큰 숫자)과 대조해 맞지 않는 제안은 버린다. 결과가 엉뚱하면 스킬 규칙대로 한 번만 좁혀 재시도한다.
- [ ] **Step 2:** `tokens.css`에 CSS 변수로 확정: 배경, 표면, 텍스트 1/2/3단계, 강조, 상승/하락 색, 테두리, 반경, 간격 스케일, 글자 크기 스케일. `@media (prefers-color-scheme: dark)`에서 다크 값. 각 텍스트/배경 조합이 4.5:1 이상인지 확인해 주석으로 비율을 남긴다. 컴포넌트 CSS에는 raw hex를 쓰지 않는다.
- [ ] **Step 3:** 테스트 작성(`components.test.tsx`).
  - `DeltaText`가 `'▲ 12%'` 텍스트를 렌더
  - `InfoTip`: 버튼 focus 시 설명 텍스트가 보이고 Esc로 사라짐
  - `CardState`: `error = new GaError('quota')` → quota 문구, `new GaError('server')` → `'불러오지 못했어요'` + 버튼 클릭 시 `refetch` 호출, `isEmpty` → 빈 상태 문구
  - `CsvButton` 클릭 시 `downloadCsv`가 BOM 포함 CSV로 호출(모듈 mock)
- [ ] **Step 4:** Run `npx vitest run src/admin/components`. Expected: FAIL.
- [ ] **Step 5:** 구현.
- [ ] **Step 6:** Run 같은 명령. Expected: PASS.
- [ ] **Step 7:** Commit: `feat(admin): add design tokens and shared ui components`

### Task 9: 어드민 셸 (게이트, 레이아웃, 기간 필터, CSP)

**Files:**
- Create: `src/admin/App.tsx`, `src/admin/App.test.tsx`, `src/admin/hooks/useGa.ts`, `src/admin/components/{Shell,SideMenu,PeriodFilter,QuotaBadge}.tsx`
- Modify: `src/admin/main.tsx`, `admin/index.html`, `vite.config.ts`

**Interfaces:**
- Consumes: Task 4 `UrlState`, `parseUrlState`, `toSearch`, `resolveRanges`, `validatePeriod`, `periodLabel`, `seoulToday`; Task 5 `createGaClient`, `GaError`, `isRetryable`; Task 7 `useAuth`, `isConfigured`; Task 8 컴포넌트.
- Produces:
  - `useGa(): { client: GaClient; ranges: { current: DateRange; previous: DateRange; days: number } | null; periodLabel: string; today: string; menu: MenuId }` (Context로 제공)
  - `gaQueryOptions` 기본값: `staleTime` 10분, `retry: (count, e) => isRetryable(e) && count < 1`, `enabled: status === 'signedIn' && ranges !== null`
  - `useQuota(): number | null` — 남은 하루 quota 비율(0~100)
  - 전역 `QueryCache({ onError })`: `GaError` kind `auth`/`forbidden`이면 `reportAuthError` 호출
- 메뉴 이름(SideMenu, 모바일 상단 탭): `overview '한눈에 보기'`, `users '사용자'`, `events '많이 한 행동'`, `retention '다시 찾아온 사람'`, `tech '기기·지역'`, `realtime '지금 접속 중'`

- [ ] **Step 1:** 테스트 작성(`App.test.tsx`, auth와 client를 mock).
  - `isConfigured()` false → `'설정이 필요해요'` 화면(README 안내 문구 포함)
  - `signedOut` → `'Google 계정으로 로그인'` 버튼, 클릭 시 `login` 호출
  - `expired` → `'로그인이 만료됐어요'` + `'다시 로그인'`
  - `forbidden` → `'이 계정은 파르페 GA를 볼 권한이 없어요'` + 관리자에게 GA 속성 뷰어 권한을 요청하라는 안내 + `'다른 계정으로 로그인'`
  - `signedIn`, URL `?menu=events&period=28d` → "많이 한 행동" 메뉴가 `aria-current="page"`, 기간 필터 `'최근 28일'` 선택. 메뉴 클릭 시 `history.replaceState`가 새 search로 호출
  - 직접 선택에서 시작일 > 종료일 → 필터 옆에 `'시작일이 종료일보다 늦어요'`, 페이지 쿼리 `enabled` false(client 호출 0회)
  - 쿼리 에러가 `GaError('auth')`이면 `reportAuthError('auth')` 호출
- [ ] **Step 2:** Run `npx vitest run src/admin/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** 구현. 상단 바: 서비스 이름, `PeriodFilter`(프리셋 3개 + 직접 선택 date input 2개, `max`=어제), 기준 문구 `'기준: 어제까지, 한국 시간'`, 계정 이메일 대신 `'로그아웃'` 버튼(이메일은 토큰만으로 알 수 없으므로 표시하지 않는다). 하단 `QuotaBadge`: `'오늘 조회 가능량 98% 남음'`. 페이지 영역은 Task 10/11 전까지 메뉴 이름만 렌더.
- [ ] **Step 4:** `admin/index.html`에 `<meta name="robots" content="noindex, nofollow">`, `<meta name="referrer" content="no-referrer">`, `<title>파르페 대시보드</title>`, Pretendard link 추가.
- [ ] **Step 5:** `vite.config.ts`에 `apply: 'build'` 플러그인 추가. `transformIndexHtml`에서 경로가 `admin/index.html`일 때만 스펙 3장의 CSP를 `<meta http-equiv="Content-Security-Policy">`로 `<head>` 맨 앞에 넣는다(dev 서버는 React refresh 인라인 스크립트 때문에 제외).
- [ ] **Step 6:** Run `npx vitest run && npm run build && grep -c Content-Security-Policy dist/admin/index.html dist/index.html`. Expected: 테스트 PASS, `dist/admin/index.html:1`, `dist/index.html:0`.
- [ ] **Step 7:** Commit: `feat(admin): add auth gates, layout, period filter and csp`

### Task 10: 페이지 — 한눈에 보기, 사용자, 많이 한 행동

**Files:**
- Create: `src/admin/hooks/useReports.ts`, `src/admin/pages/{Overview,Users,Events}Page.tsx`, `src/admin/pages/pages.test.tsx`
- Modify: `src/admin/components/Shell.tsx`(메뉴별 페이지 연결)

**Interfaces:**
- Consumes: Task 6 build/parse, Task 8 컴포넌트, Task 9 `useGa`, `gaQueryOptions`.
- Produces: `useOverview()`, `useUsers()`, `useEvents()` — 각각 `useQuery` 결과(`data`는 Task 6 모델). query key `['overview' | 'users' | 'events', ranges]`. `useOverview`는 `batchRunReports` 1회. `useRealtimeTotal()`(Task 11의 realtime 요청 [0]만)을 overview 카드에 재사용.

- 화면 구성(문구 고정):
  - 한눈에 보기: 맨 위 `buildSummary` 문장. StatCard 4개 — `'앱을 쓴 사람'`(`활성 사용자`), `'처음 온 사람'`(`신규 사용자`), `'한 사람당 평균 이용 시간'`(`평균 참여 시간`), `'지금 접속 중'`(`최근 30분`). 아래 `'날짜별 앱을 쓴 사람'` 선 차트.
  - 사용자: `'하루·일주일·한 달 동안 앱을 쓴 사람'` 선 차트 3계열(DAU/WAU/MAU 범례), `'처음 온 사람과 다시 온 사람'` 표 + CSV.
  - 많이 한 행동: `'가장 많이 일어난 행동 Top 10'` 가로 막대 차트, 표(행동, 횟수, 한 사람 이상 한 수, 직전 기간 대비) + CSV. 미등록 이벤트는 `'이름 미등록'` 태그. 표 footnote는 GA 임계값 안내 문구.
  - InfoTip 설명(고정): 앱을 쓴 사람 `'앱을 한 번 이상 연 사람 수예요. 같은 사람이 여러 번 열어도 1명으로 세요.'`, 처음 온 사람 `'이 기간에 앱을 처음 연 사람 수예요.'`, 평균 이용 시간 `'앱이 화면에 떠 있던 시간을 사람 수로 나눈 값이에요.'`, 하루·일주일·한 달 `'그날 기준으로 최근 1일, 7일, 28일 동안 앱을 쓴 사람 수예요.'`

- [ ] **Step 1:** 테스트 작성(`pages.test.tsx`, client mock이 fixture 반환).
  - Overview: 요약 문장, 카드 값 `'1,234'` 등 fixture 기반 텍스트, client `batchRunReports` 1회 호출
  - Overview: realtime 요청만 실패(`GaError('server')`) → 지금 접속 중 카드만 `'불러오지 못했어요'`, 나머지 카드 정상
  - Events: 미등록 이벤트 행에 `'이름 미등록'`
  - Users: 빈 응답 → `'이 기간에는 데이터가 없어요'`
- [ ] **Step 2:** Run `npx vitest run src/admin/pages`. Expected: FAIL.
- [ ] **Step 3:** 구현. 차트는 Recharts `ResponsiveContainer` + `Tooltip` + `Legend`, 색은 `tokens.css` 변수. 차트 컨테이너에 고정 높이를 줘 레이아웃 흔들림을 막는다. 차트마다 `aria-label`로 요약을 단다.
- [ ] **Step 4:** Run 같은 명령. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): add overview, users and events pages`

### Task 11: 페이지 — 다시 찾아온 사람, 기기·지역, 지금 접속 중

**Files:**
- Create: `src/admin/pages/{Retention,Tech,Realtime}Page.tsx`, `src/admin/pages/pages2.test.tsx`
- Modify: `src/admin/hooks/useReports.ts`, `src/admin/components/Shell.tsx`

**Interfaces:**
- Produces: `useRetention()`(key `['retention', today]`, 기간 필터와 무관), `useEngagement()`(key `['engagement', ranges]`), `useTech()`(key `['tech', ranges]`), `useRealtime()`(key `['realtime']`, `refetchInterval: 60_000`, `refetchIntervalInBackground: false`, `staleTime: 0`), `useRealtimeTotal()`

- 화면 구성(문구 고정):
  - 다시 찾아온 사람: 상단 안내 `'기간 필터와 관계없이 최근 4주 기준이에요.'`. `'주별로 다시 찾아온 비율'` 표 — 행 cohort, 열 `'첫 주'`, `'1주 후'`…`'4주 후'`, 값 `%`, 배경 농도로 비율 표현하되 숫자도 표시, null은 `'—'` + CSV. StatCard 2개 `'한 사람당 방문 횟수'`(`세션/사용자`), `'한 사람당 평균 이용 시간'`(기간 필터 적용).
  - 기기·지역: `'Android와 iOS 비율'` 도넛 차트 + 범례에 비율 텍스트, `'많이 쓰는 국가 Top 10'` 표, `'앱 버전별 사람 수'` 표. 각 표 CSV.
  - 지금 접속 중: 큰 숫자 `'최근 30분 동안 N명이 앱을 쓰고 있어요'`, 분 단위 막대 차트(x축 `'30분 전'` ~ `'지금'`), `'1분마다 자동으로 새로고침돼요'` 안내와 마지막 갱신 시각.

- [ ] **Step 1:** 테스트 작성(`pages2.test.tsx`, fake timers).
  - Retention: fixture로 `'08.30 ~ 09.05'` 행, 미래 주 `'—'`
  - Tech: `'알 수 없음'` 행 표시
  - Realtime: 60초 경과 시 client `runRealtimeReport` 재호출. `document.visibilityState = 'hidden'`이면 60초 뒤에도 재호출 없음
  - Realtime: 재호출이 `GaError('auth')`로 실패 → `reportAuthError('auth')` 호출, 이후 60초 경과해도 추가 호출 없음(인증 게이트로 unmount)
- [ ] **Step 2:** Run `npx vitest run src/admin/pages`. Expected: FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** Run 같은 명령. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): add retention, tech and realtime pages`

### Task 12: 최종 검증

**Files:**
- Modify: 발견된 문제에 해당하는 파일만

- [ ] **Step 1:** Run `npm ci && npm run typecheck && npm test && npm run build`. Expected: 모두 성공.
- [ ] **Step 2:** 번들 분리 확인. Run `grep -l "recharts\|accounts.google.com" dist/assets/*.js` 후 `dist/index.html`이 참조하는 JS 파일이 그 목록에 없는지 확인. Expected: 멀티링크 번들에 어드민 코드 없음.
- [ ] **Step 3:** 비밀값 검사. Run `grep -rnE "AIza|client_secret|private_key|BEGIN (RSA )?PRIVATE" --exclude-dir=node_modules --exclude-dir=.git . dist`. Expected: 결과 없음.
- [ ] **Step 4:** ui-ux-pro-max `references/pro-rules.md`의 pre-delivery 체크리스트로 어드민 화면을 점검하고, 걸린 항목을 고친다(모바일 폭 가로 스크롤 없음, 44px 터치 영역, focus 표시, 다크 모드 대비).
- [ ] **Step 5:** 사용자에게 수동 확인을 요청한다. 스펙 8장 "수동 확인" 6단계와 스펙 3장 "1회 수동 세팅"(config 값 채우기 포함)을 체크리스트로 전달한다. 실제 GA 로그인은 사용자 계정이 필요하므로 구현자가 대신하지 않는다.
- [ ] **Step 6:** 수정이 있었다면 Commit: `fix(admin): address final verification findings`
