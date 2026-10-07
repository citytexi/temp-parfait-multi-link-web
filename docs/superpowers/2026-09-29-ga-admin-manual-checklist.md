# 수동 확인 체크리스트 (GA 어드민 대시보드)

실제 GA 로그인과 콘솔 작업은 사용자 계정이 필요해서 구현자가 대신하지 않았어요. 아래 순서대로 확인해 주세요.

## A. 1회 수동 세팅 (콘솔 작업, 스펙 3장)

- [ ] 1. GCP 프로젝트 `parfait-5934b`에서 Google Analytics Data API를 활성화해요.
- [ ] 2. OAuth 동의 화면을 External, Testing 모드로 만들고 볼 사람을 test user로 등록해요.
- [ ] 3. OAuth client ID(웹 애플리케이션)를 만들어요. 승인된 JavaScript 원본은 `https://citytexi.github.io`와 `http://localhost:5173`만 등록해요.
- [ ] 4. Firebase 프로젝트 설정 → 통합 → Google Analytics에서 GA4 property ID(숫자)를 확인해요.
- [ ] 5. GA 관리 → 속성 액세스 관리에서 볼 사람에게 뷰어 역할을 줘요.
- [ ] 6. repo 설정 → Pages → Source를 GitHub Actions로 바꿔요.
- [ ] 7. `src/admin/config.ts`의 `GA_PROPERTY_ID`(4번 값)와 `OAUTH_CLIENT_ID`(3번 값)를 채우고 커밋해요. 둘 다 공개 식별자예요. service account 키나 client secret은 넣지 않아요.

## B. 로컬 수동 확인 (스펙 8장)

- [ ] 1. `npm run dev` 후 http://localhost:5173/temp-parfait-multi-link-web/admin/ 에 접속해요. (5173 포트를 다른 프로세스가 쓰고 있으면 먼저 꺼 주세요. OAuth 원본이 5173으로만 등록돼 있어요.)
- [ ] 2. 권한 있는 계정으로 로그인하고 지표 메뉴(한눈에 보기, 사용자, 많이 한 행동, 다시 찾아온 사람, 기기·지역, 지금 접속 중)에 데이터가 나오는지 확인해요.
- [ ] 3. 기간 필터(프리셋, 직접 입력)를 바꿔 보고, CSV 다운로드가 되는지 확인해요.
- [ ] 4. 권한 없는 계정으로 로그인해 안내 화면이 나오는지 확인해요.
- [ ] 5. DevTools → Application 탭에서 localStorage, sessionStorage, cookie에 토큰이 없는지 확인해요.
- [ ] 6. 멀티링크를 iOS, Android, 카카오톡 인앱에서 열어 확인해요.

## C. 추가 확인

- [ ] 멀티링크(`/`) 화면이 기존 페이지와 똑같이 보이는지 iOS Safari, Android Chrome, 카카오톡 인앱 브라우저에서 비교해요(이미지, 버튼, 스토어 이동 분기).
- [ ] 배포된 사이트(https://citytexi.github.io/temp-parfait-multi-link-web/admin/)에서 CSP 아래 GIS 로그인 팝업이 열리고 로그인이 끝까지 되는지 확인해요. DevTools Console에 CSP 위반(`Refused to ...`) 메시지가 없는지도 봐 주세요. `vite preview`(4173 포트)로 확인하려면 그 원본을 OAuth client에 잠깐 추가해야 해요.
- [ ] "다시 찾아온 사람"(주차별 재방문 비율)과 "지금 접속 중"(최근 30분) 숫자가 GA 콘솔의 같은 기간 값과 크게 다르지 않은지 비교해요.
- [ ] 폰(375px 폭 전후)으로 어드민을 열어 가로 스크롤이 없는지, 카드의 ⓘ 설명 말풍선이 화면 밖으로 나가지 않는지, 다크 모드에서 글자와 차트가 잘 보이는지 확인해요.
- [ ] 사이드 메뉴에서 그룹을 접고 새로고침한 뒤에도 접힌 상태가 유지되는지 확인해요.
- [ ] `⌘K`(Windows는 `Ctrl+K`)로 빠른 이동을 열어 메뉴를 검색하고 이동해 봐요.
- [ ] 메뉴를 몇 번 옮긴 뒤 브라우저 뒤로 가기를 눌러 이전 메뉴로 돌아오는지 확인해요.
- [ ] 모바일 폭(960px 미만)에서 그룹을 바꾸면 해당 그룹의 메뉴가 나오는지 확인해요.
- [ ] 다크 모드에서 메뉴, 페이지 제목, 빠른 이동 창이 잘 보이는지 확인해요.
- [ ] 예전 링크 `?menu=events&period=28d`로 들어가 같은 화면이 나오는지 확인해요.
