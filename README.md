# temp-parfait-multi-link-web
파르페 임시 멀티 링크 웹페이지용 레포

## 로컬 실행

```bash
npm ci
npm run dev
```

- 멀티링크 랜딩: http://localhost:5173/temp-parfait-multi-link-web/
- 어드민 대시보드: http://localhost:5173/temp-parfait-multi-link-web/admin/

## 테스트

```bash
npm run typecheck
npm test
npm run build
```

CI에는 OAuth 토큰이 없어서 실제 GA 호출은 자동 테스트에 포함되지 않아요. 아래 "수동 확인"을 로컬에서 해 주세요.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 typecheck, 테스트, 빌드를 차례로 실행하고 `dist/`를 GitHub Pages에 배포해요. Actions 탭에서 수동 실행(`workflow_dispatch`)도 할 수 있어요. 워크플로에는 secret을 쓰지 않아요.

## 어드민 대시보드 설정

### 1회 수동 세팅 (콘솔 작업)

1. GCP 프로젝트 `parfait-5934b`에서 Google Analytics Data API를 활성화해요.
2. OAuth 동의 화면을 External, Testing 모드로 만들고 볼 사람을 test user로 등록해요.
3. OAuth client ID(웹 애플리케이션)를 만들어요. 승인된 JavaScript 원본은 `https://citytexi.github.io`와 `http://localhost:5173`만 등록해요.
4. Firebase 프로젝트 설정 → 통합 → Google Analytics에서 GA4 property ID를 확인해요.
5. GA 관리 → 속성 액세스 관리에서 볼 사람에게 뷰어 역할을 줘요.
6. repo 설정 → Pages → Source를 GitHub Actions로 바꿔요.

### 설정 값 채우기

`src/admin/config.ts`의 두 상수를 채워요.

```ts
export const GA_PROPERTY_ID = '' // 4번에서 확인한 GA4 property ID (숫자)
export const OAUTH_CLIENT_ID = '' // 3번에서 만든 OAuth client ID
```

두 값 모두 공개돼도 되는 값이에요. service account 키나 client secret은 repo에 넣지 않아요.

### 수동 확인

1. `npm run dev` 후 http://localhost:5173/temp-parfait-multi-link-web/admin/ 접속
2. 권한 있는 계정으로 로그인, 지표 메뉴마다 데이터 표시 확인
3. 기간 필터 변경, CSV 다운로드 확인
4. 권한 없는 계정으로 로그인해 안내 화면 확인
5. DevTools Application 탭에서 저장소에 토큰이 없는지 확인
6. 멀티링크를 iOS, Android, 카카오톡 인앱에서 확인

## 어드민 메뉴 추가하기

새 메뉴는 폴더 하나만 만들면 돼요. 공용 파일은 고치지 않아요.

1. `src/admin/pages/<그룹>/` 아래에 페이지 컴포넌트와 `<이름>.menu.ts`를 만들어요. `<그룹>`은 `metrics`, `devtools`, `ops` 중 하나예요(`src/admin/menu/groups.ts`).
2. 필요하면 같은 폴더에 아래 파일도 둬요.
   - `<이름>.css`: 페이지 컴포넌트가 import해요. 클래스 이름은 `adm-<메뉴 id>-`로 시작해요.
   - `config.ts`: 이 페이지만 쓰는 설정 값이에요.
   - `<이름>.csp.json`: 이 페이지가 연결할 외부 주소예요. 아래 CSP 규칙을 지켜요.
3. URL에 페이지 상태를 두려면 `src/admin/menu/NavContext.tsx`의 `usePageParam(key)`를 써요. `[값, 설정 함수]`를 돌려주고, 설정 함수에 `null`을 넘기면 그 파라미터가 지워져요. `menu`, `period`, `start`, `end`는 셸이 쓰는 이름이라 key로 쓸 수 없어요.
4. 페이지 옆에 `<이름>.test.tsx`로 테스트를 써요.

`*.menu.ts`는 이렇게 써요(`src/admin/pages/OverviewPage.menu.ts`).

```ts
import { LayoutDashboard } from 'lucide-react'
import { defineMenu } from '../menu/defineMenu'

export default defineMenu({
  id: 'overview',
  group: 'metrics',
  order: 10,
  label: '한눈에 보기',
  description: '핵심 지표와 추이를 한 화면에서 봐요',
  icon: LayoutDashboard,
  keywords: ['요약', '대시보드', 'overview'],
  load: () => import('./OverviewPage').then((m) => ({ default: m.OverviewPage })),
  usesPeriod: true,
  usesGa: true,
})
```

`keywords`, `usesPeriod`, `usesGa`, `scopes`는 안 써도 돼요. `usesPeriod`와 `usesGa`는 안 쓰면 `false`예요. 나머지는 꼭 써야 해요.

새 폴더에 두면 `import` 경로는 `../../menu/defineMenu`처럼 한 단계 더 깊어져요. `id`는 모든 메뉴에서 유일해야 하고, 겹치면 레지스트리가 에러를 던져요. `order`는 그룹 안 정렬 순서이고, 묶음마다 쓸 수 있는 범위가 정해져 있어요. 예약 범위는 `docs/superpowers/specs/2026-10-07-admin-menu-registry-design.md`의 2장 "묶음별 예약 범위" 표를 봐요.

### CSP 규칙

`<이름>.csp.json`은 빌드 때 어드민 CSP에 합쳐져요.

```json
{ "connect-src": ["https://api.github.com"] }
```

- 쓸 수 있는 키는 `connect-src`, `img-src`, `frame-src`뿐이에요.
- 값은 `https://` 다음에 점이 들어간 호스트 이름, 그리고 선택으로 포트(`https://a.example:8443`)만 쓸 수 있어요. 경로, 끝의 `/`, 쿼리, 와일드카드(`*`), 그 밖의 문자는 안 돼요.
- 규칙을 어기면 `npm run build`와 `npm run dev`가 실패해요.
- CSP는 빌드한 페이지에만 들어가요. 그래서 조각을 빠뜨려도 `npm run dev`에서는 티가 나지 않아요. 외부 주소를 쓰는 페이지는 `npm run build && npm run preview`로 확인해요.

### 페이지 모듈 규칙

`load()`는 로그인한 모든 사용자의 브라우저에서, 한가할 때 미리 실행돼요. 그 페이지를 열지 않아도 실행되고, 여러 번 실행될 수도 있어요(미리 받기, 화면 그리기, 다시 시도). 그래서 페이지 모듈의 최상위에는 부수 효과를 두지 않아요. 요청, 이벤트 리스너, 타이머, 저장소 쓰기는 컴포넌트 안에서 해요.

### 브라우저 저장과 입력

- 브라우저에 남길 값은 `src/admin/lib/localStore.ts`의 `useStored(key, parse, fallback)`로 읽고 써요. key는 `parfait-admin:<메뉴 id>:<이름>`으로 짓고, `parse`에서 저장된 값을 다시 검사해요. 저장된 값은 믿을 수 없는 입력이에요. 토큰이나 개인 정보는 넣지 않아요.
- 저장에 실패해도 화면은 계속 동작해요. `persisted`가 `false`면 "이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요."를 보여 줘요.
- 글자를 치는 칸을 URL에 둘 때는 `usePageParam` 대신 `src/admin/lib/useDebouncedPageParam.ts`를 써요. 마지막 입력 뒤 300ms에 한 번만 써요.
- 입력 칸, 복사 버튼, 한 번 더 눌러 확인하는 버튼은 `src/admin/components/form/`의 `TextField`, `SelectField`, `CheckboxField`, `CopyButton`, `ConfirmButton`을 써요. 페이지를 `StatusRegion`으로 감싸면 버튼이 한 일을 스크린 리더에 알려요.
- 랜딩 주소는 `src/admin/lib/siteUrls.ts`의 `LANDING_URL`을 써요.

### 고치지 않는 파일

아래 파일은 고치지 않아요.

- `src/admin/components/Shell.tsx`
- `src/admin/components/SideMenu.tsx`
- `src/admin/menu/registry.ts`
- `src/admin/lib/urlState.ts`
- `src/admin/styles/admin.css`
- `vite.config.ts`
- `src/admin/config.ts`

메뉴 목록, 모바일 메뉴, `⌘K` 빠른 이동은 레지스트리에서 저절로 만들어져요.
