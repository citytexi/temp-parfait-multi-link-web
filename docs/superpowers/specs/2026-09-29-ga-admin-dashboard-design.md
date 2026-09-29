# GA 어드민 대시보드 설계

- 작성일: 2026-09-29
- 브랜치: `feat/ga-admin-dashboard`
- 상태: 설계 승인됨, 구현 계획 작성 전

## 1. 목표

- `https://citytexi.github.io/temp-parfait-multi-link-web/`는 지금처럼 멀티링크(앱 다운로드) 페이지로 유지한다.
- `https://citytexi.github.io/temp-parfait-multi-link-web/admin/`에 Firebase 프로젝트 `parfait-5934b`와 연결된 GA4 데이터를 보는 어드민 페이지를 만든다.
- 개발자가 아닌 직군(기획, 디자인, 마케팅)도 설명 없이 읽을 수 있어야 한다. 톤은 토스페이먼츠 대시보드를 참고한다.
- 사이트 전체를 Vite + React + TypeScript 기반으로 옮긴다.

### 제약

- repo는 public이다. 비밀값을 repo나 빌드 결과물에 넣지 않는다.
- 비용이 드는 서비스는 쓰지 않는다. BigQuery, Cloud Functions, Firebase Blaze 요금제를 쓰지 않는다.
- 호스팅은 GitHub Pages를 계속 쓴다. 서버가 없다.

### 가정

- 어드민을 보는 사람은 팀 내부 소수이고, 각자 GA property에 뷰어 이상 권한을 가진다.

## 2. 구조와 빌드

```
/
├─ index.html              # 멀티링크 엔트리 (OG meta, 인라인 리다이렉트 스크립트)
├─ admin/index.html        # 어드민 엔트리 (noindex, CSP)
├─ public/                 # icon-512.png, assets/ (배포 경로 유지)
├─ src/
│  ├─ landing/             # 멀티링크 React 컴포넌트, CSS, ua.ts
│  ├─ admin/
│  │  ├─ auth/             # Google Identity Services token client 래퍼, AuthContext
│  │  ├─ ga/               # client.ts, reports.ts, eventLabels.ts
│  │  ├─ hooks/            # 메뉴별 TanStack Query 훅
│  │  ├─ components/       # 카드, 차트, 표, 기간 필터, 상태 화면
│  │  └─ App.tsx
│  └─ config.ts            # OAuth client ID, GA4 property ID (공개값)
├─ vite.config.ts          # base '/temp-parfait-multi-link-web/', 엔트리 2개
└─ .github/workflows/deploy.yml
```

- 스택: Vite, React, TypeScript, TanStack Query, Recharts, Vitest, Testing Library. 패키지 매니저는 npm이고 `package-lock.json`을 커밋한다.
- Vite multi-page 빌드로 `index.html`과 `admin/index.html`을 별도 엔트리로 만든다. 멀티링크 번들에는 어드민 코드, GIS, Recharts가 들어가지 않는다.
- GitHub Pages는 `/admin` 요청을 `/admin/`으로 리다이렉트하고 `admin/index.html`을 서빙한다.

### 멀티링크 이식 규칙

- 화면과 동작은 현재 `index.html`과 같아야 한다. CSS는 그대로 옮긴다.
- OG, description, theme-color meta는 `index.html`에 정적으로 둔다. 크롤러는 JS를 실행하지 않는다.
- Android 일반 브라우저의 즉시 스토어 이동(`location.replace`)은 `<head>` 인라인 스크립트로 유지한다. React 번들을 기다리지 않는다.
- 버튼 노출 분기(iOS, Android 일반, Android 인앱, 데스크톱)는 React 컴포넌트에서 처리한다. UA 판정은 `src/landing/ua.ts` 순수 함수로 분리한다.

### 배포

- GitHub Pages source를 legacy(`main` 브랜치 root)에서 GitHub Actions로 바꾼다. repo 설정에서 한 번 바꾼다.
- `main` push에서만 실행한다: `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- 테스트가 실패하면 배포하지 않는다.
- workflow에 secret을 쓰지 않는다. fork PR에서는 배포하지 않는다.

## 3. 인증

1. 사용자가 로그인 버튼을 누른다.
2. `google.accounts.oauth2.initTokenClient({ client_id, scope: 'https://www.googleapis.com/auth/analytics.readonly', callback })`로 만든 client의 `requestAccessToken()`을 호출한다.
3. Google 팝업에서 계정을 고르고 동의한다.
4. callback으로 `access_token`과 `expires_in`을 받는다. 토큰과 만료 시각을 `AuthContext`(메모리)에 저장한다.
5. 대시보드를 렌더한다.

### 규칙

- GIS 스크립트(`https://accounts.google.com/gsi/client`)는 어드민 페이지에서만 로드한다.
- 토큰은 메모리에만 둔다. `localStorage`, `sessionStorage`, cookie에 저장하지 않는다. 새로고침하면 다시 로그인한다.
- 팝업은 사용자 클릭으로만 연다. 자동 로그인은 하지 않는다.
- 만료 시각이 지났거나 API가 `401`을 주면 "로그인이 만료됐어요" 화면을 보여준다.
- 로그아웃하면 `google.accounts.oauth2.revoke(token)`을 호출하고 메모리를 비운다.

### 어드민 페이지 meta

GitHub Pages는 HTTP 헤더를 설정할 수 없으므로 meta 태그로 둔다.

- `<meta name="robots" content="noindex, nofollow">`
- `<meta name="referrer" content="strict-origin-when-cross-origin">` — GIS가 Referer로 요청 origin을 확인하므로 `no-referrer`는 쓰지 않는다. cross-origin에는 origin만 보내서 경로·쿼리는 새지 않는다.
- CSP (빌드 때만 `<meta http-equiv>`로 넣는다. dev 서버는 React Refresh 인라인 스크립트 때문에 제외):
  - `default-src 'self'`
  - `script-src 'self' https://accounts.google.com/gsi/client`
  - `style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://cdn.jsdelivr.net`
  - `font-src https://cdn.jsdelivr.net`
  - `img-src 'self' data: https://*.googleusercontent.com`
  - `connect-src 'self' https://analyticsdata.googleapis.com https://accounts.google.com/gsi/ https://oauth2.googleapis.com` — `'self'`는 Vite modulepreload polyfill, `gsi/`는 GIS 요구사항, `oauth2`는 로그아웃 때 토큰 revoke
  - `frame-src https://accounts.google.com/gsi/`
  - `base-uri 'self'`
  - `form-action 'none'`
  - `object-src 'none'`
- 구현 중 GIS나 폰트가 다른 origin을 요구하면 최소한으로만 추가하고, 추가한 이유를 주석으로 남긴다.

### 1회 수동 세팅 (콘솔 작업)

1. GCP 프로젝트 `parfait-5934b`에서 Google Analytics Data API를 활성화한다.
2. OAuth 동의 화면을 External, Testing 모드로 만들고 볼 사람을 test user로 등록한다.
3. OAuth client ID(웹 애플리케이션)를 만든다. 승인된 JavaScript 원본은 `https://citytexi.github.io`와 `http://localhost:5173`만 등록한다.
4. Firebase 프로젝트 설정 → 통합 → Google Analytics에서 GA4 property ID를 확인한다.
5. GA 관리 → 속성 액세스 관리에서 볼 사람에게 뷰어 역할을 준다.
6. repo 설정 → Pages → Source를 GitHub Actions로 바꾼다.

## 4. 화면과 UX

### 원칙

- 쉬운 말을 먼저 쓰고 원래 용어는 작게 보조로 쓴다. 예: 제목 "하루 동안 앱을 쓴 사람", 보조 `DAU`.
- 지표마다 ⓘ 툴팁으로 한 줄 설명을 붙인다. 예: "앱을 한 번 이상 연 사람 수예요. 같은 사람이 여러 번 열어도 1명으로 세요."
- 숫자 위에 요약 문장을 둔다. 예: "지난 7일 동안 1,234명이 파르페를 썼어요. 그 전 7일보다 12% 늘었어요."
- 해요체를 쓴다. 에러와 빈 상태 문구는 다음 행동을 알려준다.
- 증감은 색에만 의존하지 않는다. `▲ 12%`, `▼ 3%`처럼 기호와 텍스트를 같이 쓴다.
- 이벤트 이름은 `eventLabels.ts` 사전으로 한글 이름을 보여준다. 사전에 없는 이벤트는 원래 이름과 "이름 미등록" 태그를 보여준다.
- 색, 타이포, 간격은 구현 때 ui-ux-pro-max 스킬로 정한다. 폰트는 Pretendard를 쓴다. 다크/라이트 모드를 지원한다.
- 접근성: 대비 4.5:1 이상, 키보드 이동, focus 표시, 차트에 범례와 툴팁.

### 레이아웃

- 상단 바: 로고, 기간 필터(최근 7일 / 28일 / 90일 / 직접 선택), 로그인한 계정, 로그아웃.
- 기간 필터 옆에 기준을 표시한다: "기준: 어제까지, 한국 시간".
- 왼쪽 메뉴. 모바일 폭에서는 상단 탭으로 바뀐다.
- 선택한 메뉴와 기간은 URL hash나 query에 반영해 링크로 공유할 수 있게 한다.

### 메뉴

| 메뉴 | 내용 | API |
|---|---|---|
| 한눈에 보기 | 요약 문장, 카드 4개(사용자, 신규 사용자, 평균 이용 시간, 지금 접속 중), 기간별 사용자 추이 차트 | `batchRunReports` + `runRealtimeReport` |
| 사용자 | DAU/WAU/MAU 추이(`active1DayUsers`, `active7DayUsers`, `active28DayUsers`), 신규 vs 재방문 | `runReport` |
| 많이 한 행동 | 이벤트 Top 10 막대 차트, 표(이름, 횟수, 사람 수, 직전 기간 대비 증감) | `runReport` |
| 다시 찾아온 사람 | 주간 코호트 리텐션 표(1~4주 후 재방문 비율), 평균 참여 시간, 사용자당 세션 수 | `runReport`(`cohortSpec`) |
| 기기·지역 | 플랫폼(Android/iOS) 비율, 국가 Top 10, 앱 버전 분포 | `runReport` |
| 지금 접속 중 | 최근 30분 활성 사용자, 분 단위 막대 차트, 60초 자동 새로고침 | `runRealtimeReport` |

- 표마다 CSV 다운로드 버튼을 둔다. CSV는 브라우저에서 만든다. 엑셀 한글 깨짐 방지를 위해 UTF-8 BOM을 붙인다.

## 5. 데이터 흐름

```
컴포넌트
  → hooks (useOverview, useUsers, useEvents, useRetention, useTech, useRealtime)
    → ga/reports.ts  요청 body 생성, 응답을 화면 모델로 변환 (순수 함수)
      → ga/client.ts  fetch POST, Authorization 헤더, 에러 분류
        → https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
                                                                   :batchRunReports
                                                                   :runRealtimeReport
```

### quota 절약

- GA4 Data API는 무료이며 표준 property 기준 하루 200,000 토큰, 시간당 40,000 토큰, 동시 요청 10개 제한이 있다.
- 직전 기간 비교는 한 요청에 `dateRanges` 2개로 조회한다.
- "한눈에 보기"는 `batchRunReports` 한 번으로 묶는다.
- TanStack Query `staleTime`은 10분이다. 로그인 전에는 쿼리를 실행하지 않는다.
- 실시간은 60초마다, 탭이 보일 때만 조회한다.
- 요청에 `returnPropertyQuota: true`를 넣고 남은 하루 quota 비율을 화면 하단에 작게 보여준다.

### 날짜

- 기본 종료일은 `yesterday`다. 오늘 데이터는 GA 반영이 덜 됐다.
- 날짜 계산은 GA property 시간대(한국 시간)를 따른다.
- 리텐션은 주간 코호트 4개, `cohortsRange` granularity `WEEKLY`로 조회한다.

## 6. 에러 처리

카드 단위로 에러를 격리한다. 카드 하나가 실패해도 다른 카드는 보인다. 인증 관련 에러만 전체 화면으로 바꾼다.

| 상황 | 범위 | 문구와 행동 |
|---|---|---|
| `401`, 토큰 만료 | 전체 | "로그인이 만료됐어요" + 다시 로그인 |
| `403` | 전체 | "이 계정은 파르페 GA를 볼 권한이 없어요" + 권한 요청 방법 + 다른 계정으로 로그인 |
| `429`, `RESOURCE_EXHAUSTED` | 카드 | "오늘 조회 한도를 다 썼어요. 한 시간 뒤나 내일 다시 시도해 주세요." |
| 네트워크 오류, `5xx` | 카드 | "불러오지 못했어요" + 다시 시도. 자동 재시도 1회 |
| 빈 응답 | 카드 | "이 기간에는 데이터가 없어요" |
| 로그인 팝업 닫음, 차단 | 전체 | "로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요." |
| GA 임계값으로 행 숨김 | 표 하단 | "사용자가 적은 항목은 개인정보 보호를 위해 GA가 숨길 수 있어요" |

## 7. 보안 체크 결과

- git 전체 히스토리를 `AIza`, `secret`, `token`, `private_key`, `client_secret`, `apiKey` 패턴으로 검색했고 결과가 없었다.
- OAuth client ID와 GA4 property ID는 공개돼도 된다. 데이터 접근은 로그인한 Google 계정의 GA 권한으로만 결정된다.
- service account 키, OAuth client secret은 쓰지 않는다.
- 승인된 origin `https://citytexi.github.io`는 citytexi의 모든 GitHub Pages repo가 공유한다. 전부 본인 소유라 위험은 낮다.
- OAuth 동의 화면을 Testing 모드로 두면 등록된 test user만 로그인할 수 있다.
- 토큰은 메모리에만 두고, scope는 `analytics.readonly` 하나만 요청한다.
- 의존성을 최소로 유지하고 lockfile을 커밋한다. `npm ci`로 설치한다.

## 8. 테스트

### 자동 테스트 (Vitest, CI에서 배포 전 실행)

- `src/landing/ua.ts`: iOS, iPadOS(Macintosh + 터치), Android 일반, Android 인앱(KAKAOTALK, Instagram, NAVER 등), 데스크톱 UA의 판정 결과가 현재 `index.html` 분기와 같은지 검증한다.
- `src/admin/ga/reports.ts`: 요청 body 생성, 응답 변환, 증감률 계산(직전 값 0 포함), 빈 rows, 코호트 변환을 fixture JSON으로 검증한다.
- `src/admin/ga/client.ts`: `fetch` mock으로 401, 403, 429, 5xx 에러 분류를 검증한다.
- `src/admin/ga/eventLabels.ts`: 등록 이벤트와 미등록 이벤트 표시를 검증한다.
- 컴포넌트: 로그인 전 화면, 권한 없음 화면, 카드 하나 실패 시 나머지 카드 표시.

### 수동 확인

CI에는 OAuth 토큰이 없으므로 실제 GA 호출은 로컬에서 확인한다.

1. `npm run dev` 후 `http://localhost:5173/temp-parfait-multi-link-web/admin/` 접속
2. 권한 있는 계정으로 로그인, 메뉴 6개에 데이터 표시 확인
3. 기간 필터 변경, CSV 다운로드 확인
4. 권한 없는 계정으로 로그인해 안내 화면 확인
5. DevTools Application 탭에서 저장소에 토큰이 없는지 확인
6. 멀티링크를 iOS, Android, 카카오톡 인앱에서 확인

## 9. 완료 기준

1. `/` 멀티링크가 기존과 같게 동작한다. iOS는 App Store 버튼만, Android 일반 브라우저는 즉시 스토어 이동, 인앱은 외부 브라우저 안내, OG 미리보기 유지.
2. `/admin/`에서 GA 권한이 있는 계정은 메뉴 6개의 데이터를 본다. 권한이 없는 계정은 안내 화면을 본다.
3. 토큰이 브라우저 저장소에 남지 않는다.
4. repo와 빌드 결과물에 비밀값이 없다.
5. 유료 서비스를 쓰지 않는다.
6. `main` push 한 번으로 GitHub Actions 배포가 끝난다.

## 10. 범위 밖

- 커스텀 도메인
- 알림, 정기 리포트 메일
- 사용자별 메뉴 권한 구분
- 앱에 새 이벤트를 추가하는 작업
