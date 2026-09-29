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
2. 권한 있는 계정으로 로그인, 메뉴 6개에 데이터 표시 확인
3. 기간 필터 변경, CSV 다운로드 확인
4. 권한 없는 계정으로 로그인해 안내 화면 확인
5. DevTools Application 탭에서 저장소에 토큰이 없는지 확인
6. 멀티링크를 iOS, Android, 카카오톡 인앱에서 확인
