# 어드민 메뉴 레지스트리와 셸 개편 설계

- 작성일: 2026-10-07
- 브랜치: `feat/admin-menu-registry`
- 상태: 방향 승인됨, 스펙 검토 전

## 1. 목표

어드민에 개발자 도구와 팀 운영 기능을 여러 묶음으로 나눠 추가하려고 한다. 묶음은 워크트리에서 병렬로 구현한다. 이 문서는 그 전에 넣는 기반 작업을 다룬다.

- 새 메뉴를 추가할 때 공통 파일을 고치지 않게 한다. 병렬 작업끼리 머지 충돌이 나지 않아야 한다.
- 메뉴가 6개에서 16개 안팎으로 늘어도 찾기 쉽고 보기 좋아야 한다.
- 지표가 아닌 페이지(링크 빌더, 링크 허브 등)에 기간 필터 같은 지표용 UI가 붙지 않게 한다.

### 판단 기준

설계 선택은 확장성, 쓰는 사람의 편의, 보기 좋음 순으로 따진다. 구현이 쉬운지는 기준이 아니다.

### 제약

- GitHub Pages 정적 배포다. 서버가 없다.
- 기존 대시보드 스펙(`2026-09-29-ga-admin-dashboard-design.md`)의 보안 규칙을 그대로 지킨다. 토큰은 메모리에만 둔다.
- 기존 6개 페이지의 내용과 기존 URL은 바꾸지 않는다.

### 뒤따르는 묶음

이 기반 위에 올라갈 묶음은 아래와 같다. 이 문서의 범위는 아니다.

1. 순수 클라이언트 도구: UTM 링크 빌더와 QR, 딥링크/UA 분기 테스터, 링크 허브, 릴리즈 체크리스트
2. GA 기반 QA 도구: 실시간 이벤트 스트림, 이벤트 사전
3. Firebase/Play 연동: Remote Config 뷰어, App Distribution 빌드 목록, Play 리뷰 뷰어
4. GitHub 보드

## 2. 메뉴 레지스트리

### 메뉴 정의 파일

메뉴 하나는 페이지 옆에 두는 `*.menu.ts` 파일 하나로 정의한다.

```ts
// src/admin/pages/OverviewPage.menu.ts
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

| 필드 | 뜻 |
|------|----|
| `id` | URL의 `?menu=` 값. 전체에서 유일해야 한다. |
| `group` | `metrics`, `devtools`, `ops` 중 하나. |
| `order` | 그룹 안 정렬 순서. 10 단위로 띄워 쓴다. |
| `label` | 메뉴와 페이지 제목에 쓰는 이름. |
| `description` | 페이지 제목 아래와 빠른 이동 목록에 쓰는 한 줄 설명. |
| `icon` | `lucide-react` 아이콘 컴포넌트. |
| `keywords` | 빠른 이동 검색어. 선택. |
| `load` | 페이지를 동적 import하는 함수. |
| `usesPeriod` | 기간 필터를 쓰는지. 기본값 `false`. |
| `usesGa` | GA Data API를 호출하는지. quota 배지 표시에 쓴다. 기본값 `false`. |
| `scopes` | 이 페이지에 필요한 OAuth scope 목록. 선택. 이번에는 필드만 두고 쓰지 않는다(§6). |

### 수집 방식

`src/admin/menu/registry.ts`가 `import.meta.glob('../pages/**/*.menu.ts', { eager: true })`로 정의 파일을 모두 모은다. 정의 파일은 가볍고, 페이지 코드는 `load`로 필요할 때만 받는다.

- 새 메뉴를 추가하는 작업은 페이지 파일과 `*.menu.ts` 파일만 만든다. 공통 파일을 고치지 않는다.
- 새 페이지는 `src/admin/pages/devtools/`, `src/admin/pages/ops/`처럼 하위 폴더에 둘 수 있다. 기존 6개 페이지는 지금 위치에 둔다.

### 그룹

그룹은 `src/admin/menu/groups.ts`에 고정 목록으로 둔다.

| id | 라벨 | 순서 |
|----|------|------|
| `metrics` | 지표 | 1 |
| `devtools` | 개발자 도구 | 2 |
| `ops` | 팀 운영 | 3 |

메뉴가 하나도 없는 그룹은 화면에 나오지 않는다. 이 기반 작업만 배포된 시점에는 `지표` 그룹만 보인다.

### 레지스트리가 주는 것

- `MENUS`: 그룹 순서, `order` 순서로 정렬한 전체 메뉴
- `MENU_GROUPS`: 메뉴가 있는 그룹과 그 메뉴 목록
- `findMenu(id)`: id로 메뉴 찾기. 없으면 `undefined`
- `DEFAULT_MENU_ID`: `'overview'`

`MenuId` 타입은 문자열 유니온에서 `string`으로 바뀐다. 유효한지는 `findMenu`로 실행 중에 확인한다. 대신 레지스트리 테스트가 id 중복, 그룹 안 `order` 중복, 알 수 없는 그룹을 잡는다.

## 3. 내비게이션

### 데스크톱 (960px 이상)

```
┌──────────────────────────────────────────────────┐
│ 파르페 대시보드          [검색  ⌘K]       로그아웃 │
├─────────────┬────────────────────────────────────┤
│ 지표       ▾ │ 한눈에 보기                         │
│  ▫ 한눈에 보기│ 핵심 지표와 추이를 한 화면에서 봐요    │
│  ▫ 사용자    │                    [기간 필터]      │
│ 개발자 도구 ▾ │ ───────────────────────────────── │
│  ▫ 이벤트 사전│                                    │
│ 팀 운영    ▾ │ (페이지 내용)                       │
│  ▫ 링크 허브  │                                    │
└─────────────┴────────────────────────────────────┘
```

- 사이드바에 그룹 제목과 그 아래 메뉴(아이콘 + 이름)를 모두 보여 준다. 어느 메뉴든 한 번 눌러 간다.
- 그룹 제목을 누르면 그 그룹을 접거나 편다. 접힘 상태는 `localStorage`의 `parfait-admin:menu-collapsed` 키에 그룹 id 배열로 저장한다. 이 키에는 UI 상태만 들어간다.
- 지금 보고 있는 메뉴의 그룹은 저장된 상태와 상관없이 펼쳐서 보여 준다.
- `localStorage`를 못 쓰는 환경에서는 모두 펼친 상태로 동작한다.

### 모바일 (960px 미만)

- 상단 바 아래에 그룹 전환 세그먼트를 두고, 그 아래에 고른 그룹의 메뉴만 가로 탭으로 보여 준다.
- 그룹이 하나뿐이면 세그먼트를 숨긴다.
- 세그먼트에서 다른 그룹을 누르면 탭 목록만 바뀐다. 페이지는 탭을 눌렀을 때 바뀐다.
- 현재 메뉴의 탭은 화면에 보이도록 스크롤한다.

### 빠른 이동

- `⌘K`(Windows와 Linux는 `Ctrl+K`)나 상단 바의 검색 버튼으로 연다. 모바일에서는 버튼으로만 연다.
- 메뉴 이름, 설명, `keywords`로 검색한다. 결과는 그룹별로 묶어 아이콘, 이름, 설명을 보여 준다.
- 위아래 화살표로 고르고 Enter로 이동한다. Esc나 바깥을 누르면 닫힌다.
- 검색 결과가 없으면 "찾는 메뉴가 없어요"를 보여 준다.
- `cmdk`로 만든다. 목록은 레지스트리에서 만들어지므로 메뉴를 추가해도 이 컴포넌트를 고치지 않는다.

### 접근성

- 사이드바는 `<nav aria-label="메뉴">`. 그룹 제목은 `aria-expanded`를 가진 버튼이다.
- 현재 메뉴에는 지금처럼 `aria-current="page"`를 준다.
- 모바일 그룹 세그먼트의 각 버튼은 `aria-controls`로 탭 목록을 가리킨다.
- 키보드 포커스 표시는 기존 토큰을 쓴다. 터치 영역은 `--adm-hit` 이상이다.
- 접기, 펴기, 팔레트 열기 애니메이션은 `prefers-reduced-motion`에서 끈다.

## 4. 셸과 페이지 헤더

### 페이지 헤더

셸이 모든 페이지 위에 같은 모양의 헤더를 그린다.

- 왼쪽: 메뉴의 `label`을 `<h1>`으로, 그 아래 `description`
- 오른쪽 도구 자리: `usesPeriod`가 `true`면 기간 필터와 "기준: 어제까지, 한국 시간" 문구

기존 6개 페이지에 있는 `<h1 className="adm-page__title">`은 지운다. 제목이 셸로 옮겨 가기 때문이다. `adm-page__lead`(한눈에 보기의 요약 문장, 지금 접속 중의 헤드라인)는 페이지 내용이므로 그대로 둔다.

### 상단 바

- 브랜드, 빠른 이동 버튼, 로그아웃만 남긴다. 기간 필터는 페이지 헤더로 옮긴다.

### 푸터

- quota 배지는 `usesGa`가 `true`인 페이지에서만 보여 준다.

### 페이지 로딩

- 페이지는 `React.lazy`로 메뉴별 청크로 나눈다. 메뉴가 늘어도 첫 로딩 크기가 커지지 않는다.
- 로딩 중에는 페이지 영역에 "불러오는 중이에요"를 보여 준다. 헤더와 메뉴는 그대로 둔다.
- 청크를 못 받으면(새 버전 배포 직후 등) 페이지 영역에 "화면을 불러오지 못했어요"와 새로고침 버튼을 보여 준다. 다른 메뉴로 옮기면 오류 상태를 지운다.
- 청크는 같은 출처에서 받으므로 CSP는 바꾸지 않는다.

## 5. 상태와 URL

### 내비게이션 상태 분리

지금은 `GaProvider`가 메뉴와 기간을 함께 들고 있다. 메뉴는 GA와 무관하므로 나눈다.

- `NavProvider`(`src/admin/menu/NavContext.tsx`)가 URL 상태(메뉴, 기간)와 `setMenu`, `setPeriod`를 가진다. `useNav()`로 읽는다.
- `GaProvider`는 `useNav()`에서 기간을 읽어 `ranges`, `periodLabel`, `periodError`를 계산한다. `useGa()`가 주는 값 중 `menu`와 `setMenu`는 뺀다.
- 기존 페이지는 `useGa()`에서 기간 관련 값만 쓰므로 고칠 것이 없다.

### URL 규칙

- `?menu=<id>` 형식은 그대로다. 기존 링크(`?menu=events&period=28d`)는 지금과 똑같이 동작한다.
- 알 수 없는 `menu` 값은 `overview`로 간다.
- `usesPeriod`가 `false`인 페이지에서는 URL에 기간 파라미터를 붙이지 않는다(`?menu=utm`).
- 기간을 쓰지 않는 페이지로 갔다가 돌아와도 고른 기간은 유지된다. 기간은 메모리 상태에 남아 있다.
- 지금처럼 `history.replaceState`를 쓴다.

## 6. OAuth scope

이번에는 `scopes` 필드를 타입에만 둔다. 로그인은 지금처럼 `analytics.readonly` 하나만 요청한다.

scope가 더 필요한 페이지에 들어갈 때 추가 동의를 받는 흐름은 묶음 3의 스펙에서 정한다. 레지스트리에 필드를 미리 두는 이유는, 그때 메뉴 정의 형식을 바꾸지 않으려는 것이다.

## 7. 파일 구조

```
src/admin/
├─ menu/
│  ├─ defineMenu.ts        # MenuDef 타입, defineMenu()
│  ├─ groups.ts            # 그룹 목록
│  ├─ registry.ts          # glob 수집, 정렬, findMenu
│  ├─ NavContext.tsx       # NavProvider, useNav
│  └─ collapsed.ts         # 접힘 상태 읽기/쓰기 (localStorage)
├─ components/
│  ├─ Shell.tsx            # 헤더, 메뉴, 페이지 영역 조립
│  ├─ SideMenu.tsx         # 데스크톱 그룹 사이드바
│  ├─ MobileMenu.tsx       # 그룹 세그먼트 + 탭
│  ├─ PageHeader.tsx       # 제목, 설명, 도구 자리
│  ├─ PageOutlet.tsx       # lazy 페이지, 로딩, 오류 경계
│  └─ CommandMenu.tsx      # 빠른 이동
├─ pages/
│  ├─ OverviewPage.tsx
│  ├─ OverviewPage.menu.ts # 기존 6개 페이지마다 하나씩
│  └─ ...
└─ lib/urlState.ts         # MenuId를 string으로, 검증을 레지스트리에 위임
```

스타일은 `src/admin/styles/admin.css`에 추가하고 `tokens.css`의 토큰만 쓴다. 새 색을 만들지 않는다. 디자인 기준은 `design-system/parfait-admin/MASTER.md`를 따른다.

### 추가하는 의존성

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `cmdk` | 빠른 이동 | React 19 지원. 키보드와 스크린리더 처리가 들어 있다. |
| `lucide-react` | 아이콘 | 쓰는 아이콘만 번들에 들어간다. `MASTER.md`가 권하는 아이콘 세트다. |

둘 다 어드민 엔트리에서만 import한다. 멀티링크 번들에는 들어가지 않아야 한다.

## 8. 새 메뉴를 추가하는 방법

뒤따르는 묶음은 아래만 하면 된다.

1. `src/admin/pages/<그룹>/` 아래에 페이지 컴포넌트를 만든다.
2. 같은 폴더에 `<이름>.menu.ts`를 만든다.
3. 페이지 테스트를 쓴다.

`Shell.tsx`, `SideMenu.tsx`, `registry.ts`, `urlState.ts`는 고치지 않는다. 이 절차를 README에 짧게 적는다.

## 9. 테스트

### 자동 테스트

- 레지스트리: id 중복 없음, 그룹 안 `order` 중복 없음, 모든 메뉴의 그룹이 `groups.ts`에 있음, 정렬 순서
- URL 상태: 알 수 없는 메뉴는 `overview`, 기간을 안 쓰는 메뉴는 기간 파라미터 없음, 기존 URL 왕복 변환 유지
- 사이드바: 그룹 접기와 펴기, 접힘 상태 저장과 복원, 현재 메뉴의 그룹은 항상 펼침, 빈 그룹 숨김
- 모바일 메뉴: 그룹 전환 시 탭 목록 변경, 그룹이 하나면 세그먼트 숨김
- 빠른 이동: 단축키로 열기, 검색, Enter로 이동, 결과 없음 문구
- 페이지 헤더: `usesPeriod`에 따라 기간 필터 표시, `usesGa`에 따라 quota 배지 표시
- 페이지 영역: 로딩 표시, 청크 실패 시 오류 화면과 다른 메뉴로 이동 후 복구
- 기존 테스트는 모두 통과해야 한다. 메뉴 타입 변경과 제목 이동에 맞춰 고치는 것은 허용한다.

테스트에서 그룹과 메뉴를 바꿔 넣을 수 있게, 메뉴 컴포넌트는 레지스트리를 직접 import하지 않고 props로 받는다.

### 수동 확인

- 데스크톱과 모바일 폭에서 메뉴 이동, 그룹 접기, 빠른 이동
- 기존 링크(`?menu=events&period=28d`)로 들어가 같은 화면이 나오는지
- 다크 모드
- 빌드 후 멀티링크 번들에 `cmdk`, `lucide-react`가 없는지
- 빌드한 어드민 페이지에서 CSP 위반이 콘솔에 없는지

## 10. 완료 기준

- 기존 6개 메뉴가 `지표` 그룹 아래에서 지금과 같은 내용으로 보인다.
- 테스트용 메뉴 정의 파일 하나를 추가하는 것만으로 사이드바, 모바일 탭, 빠른 이동, URL에 그 메뉴가 나타난다. 확인 뒤 테스트용 파일은 지운다.
- 기간 필터가 페이지 헤더에 있고, `usesPeriod`가 `false`인 페이지에서는 나오지 않는다.
- `npm run typecheck`, `npm test`, `npm run build`가 통과한다.

## 11. 범위 밖

- 개발자 도구와 팀 운영 페이지 자체. 뒤따르는 묶음에서 만든다.
- OAuth scope 추가와 추가 동의 흐름. 묶음 3에서 정한다.
- 로그인 없이 쓰는 페이지. 어드민 전체는 지금처럼 GA 권한이 있는 계정으로 로그인해야 열린다.
- 즐겨찾기, 최근 본 메뉴, 메뉴 순서 바꾸기.
- 기존 6개 페이지의 내용 변경.
