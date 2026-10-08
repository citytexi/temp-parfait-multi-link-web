# 어드민 클라이언트 도구 설계 (묶음 1): 캠페인 링크, 랜딩 분기 테스트, 바로가기, 릴리즈 체크리스트

- 작성일: 2026-10-08
- 브랜치: `feat/admin-client-tools`
- 상태: 구현됨(2026-10-08), 브랜치 전체 리뷰 반영. 브라우저 화면 확인과 실제 기기 확인(§9)은 아직 하지 않음

## 1. 목표

어드민에 API 호출 없이 브라우저만으로 동작하는 도구 네 개를 넣는다.

| 메뉴 | 그룹 | 푸는 문제 |
|------|------|-----------|
| 캠페인 링크 만들기 | 개발자 도구 | 사람마다 UTM 표기가 달라서 GA에서 같은 채널이 여러 줄로 갈린다. |
| 랜딩 분기 테스트 | 개발자 도구 | 랜딩이 기기와 인앱 브라우저마다 다르게 동작하는데, 확인하려면 기기를 직접 구해야 한다. |
| 바로가기 | 팀 운영 | Firebase, 스토어 콘솔 등의 주소를 매번 찾는다. |
| 릴리즈 체크리스트 | 팀 운영 | 배포 전 확인 항목이 사람 기억에만 있다. |

쓰는 사람은 개발자와 비개발 직군(기획, 디자인, 마케팅)이다.

이 묶음은 랜딩(`/`)도 고친다. 지금은 UTM을 붙여도 어디에서도 측정되지 않기 때문이다(§3).

### 성공 기준

- 캠페인 링크 만들기로 만든 링크의 UTM이 Android의 모든 진입 경로에서 Play 주소의 `referrer`로 실린다: 일반 브라우저의 자동 이동, 인앱 브라우저의 버튼, 외부 브라우저로 열기를 거친 경우. 이것은 코드와 테스트로 보장한다.
- 그 `referrer`가 GA의 `first_open`에 캠페인으로 잡히는지는 Play와 Firebase의 동작에 달려 있다. 실제 기기로 확인한다(§9). 확인 전까지는 가정이다.
- 랜딩 분기 테스트의 결과가 실제 랜딩의 동작과 같다. 버튼과 주소는 같은 코드를 쓰고, 번들 밖에 있는 인라인 스크립트는 테스트가 같은 입력으로 묶는다(§3).
- 기반의 "고치지 않는 파일" 7개를 고치지 않는다.

### 판단 기준

설계 선택은 확장성, 쓰는 사람의 편의, 보기 좋음 순으로 따진다. 구현이 쉬운지는 기준이 아니다.

### 제약

- 서버와 공유 저장소가 없다. 팀원끼리 자동으로 공유되는 상태는 없다. 공유는 URL과 복사한 텍스트로 한다.
- 레포는 public이다. 코드에 적은 주소는 누구나 볼 수 있다.
- 토큰은 메모리에만 둔다. `localStorage`에는 이 문서가 정한 키에 UI 상태만 넣는다.
- 어드민 CSP를 넓히지 않는다. CSP 조각(`*.csp.json`)은 만들지 않는다.
- 메뉴 규칙은 기반 스펙(`2026-10-07-admin-menu-registry-design.md`)을 따른다. `order`는 `devtools` 100~190, `ops` 100~190을 쓴다.
- 로컬 브랜치 `feat/custom-domain`이 사이트를 `https://www.parfait-app.store/`로 옮기려 한다. 랜딩 주소를 한 곳(`LANDING_URL`)에만 두고 테스트로 묶어서, 도메인이 바뀔 때 함께 바뀌게 한다(§7).
- 묶음 2(`feat/admin-devtools-qa`)가 병렬로 진행 중이다. 묶음 2가 고치는 파일(`src/admin/ga/*`, `src/admin/menu/NavContext.tsx`)과 만드는 폴더(`src/admin/pages/devtools/shared/`, `event-stream/`, `event-dictionary/`)는 건드리지 않는다.

### 확인하지 못한 것

- **Play의 `referrer` 형식**: `https://play.google.com/store/apps/details?id=<패키지>&referrer=<인코딩한 utm 문자열>`로 설치하면 Firebase SDK가 설치 경로를 기록하고 GA의 `first_open`에 캠페인이 잡힌다. Google의 Play Campaign URL Builder가 만드는 형식이고 SDK 수정은 필요 없다고 GA 도움말에 적혀 있다. 형식 자체는 내 기억에 기대고 있고, 문서 원문으로는 확인하지 못했다. `market://details?id=…&referrer=…`도 같은 방식으로 동작한다고 알고 있다.
- 위 내용은 실제 기기에서 설치해 봐야 확정된다(§9). GA에 반영되기까지 하루쯤 걸릴 수 있다.
- **사용자 동작 없는 intent 이동**: Chrome 문서는 사용자 동작 없이 시작된 intent 주소로는 외부 앱을 띄우지 않는다고 적는다. 인라인 스크립트의 자동 이동, QR 스캔, 주소 직접 입력이 여기에 해당한다. 이때 Chrome은 `S.browser_fallback_url`(Play 웹 주소)로 간다. 그래서 Play 웹 주소에도 `referrer`를 싣는다. Play 웹이 그 값을 Play 앱 설치까지 넘기는지는 확인하지 못했다.
- GA 도움말은 `utm_id`와 `utm_source_platform`도 권장한다. 이 묶음의 빌더는 만들지 않지만, 랜딩은 `utm_id`가 있으면 넘긴다(§3).
- GA 속성 화면의 주소 형식(`https://analytics.google.com/analytics/web/#/p543897329/…`)이 바로 열리는지.

## 2. 캠페인 링크 만들기

### 메뉴

| 필드 | 값 |
|------|----|
| `id` | `utm-builder` |
| `group` | `devtools` |
| `order` | 110 |
| `label` | 캠페인 링크 만들기 |
| `description` | 어디서 들어왔는지 알 수 있는 링크를 만들어요 |
| `keywords` | `UTM`, `QR`, `캠페인`, `마케팅`, `링크` |
| `usesPeriod`, `usesGa` | `false` |

### 규칙

이 화면이 팀의 UTM 규칙이다. 규칙은 `config.ts`에 데이터로 둔다.

**채널**

| id | 화면 이름 | `utm_source` | `utm_medium` |
|----|-----------|--------------|--------------|
| `instagram` | 인스타그램 | `instagram` | `social` |
| `kakaotalk` | 카카오톡 | `kakaotalk` | `social` |
| `threads` | 스레드 | `threads` | `social` |
| `x` | X | `x` | `social` |
| `youtube` | 유튜브 | `youtube` | `video` |
| `naver_blog` | 네이버 블로그 | `naver_blog` | `referral` |
| `newsletter` | 이메일 | `newsletter` | `email` |
| `offline` | 오프라인 QR | `offline` | `qr` |
| `paid` | 유료 광고 | 직접 입력 | `cpc` |
| `custom` | 직접 입력 | 직접 입력 | 직접 입력 |

`medium` 값은 GA의 기본 채널 분류가 쓰는 값(`social`, `video`, `referral`, `email`, `cpc`)을 골랐다. `cpc`는 source에 따라 유료 검색, 유료 소셜, 기타 유료로 나뉜다(내 기억이고 확인하지 못했다). `qr`은 GA가 분류하지 못해 "Unassigned"로 보이지만, 오프라인 유입을 따로 보려는 값이라 그대로 둔다.

**값의 형식**

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` 모두 `^[a-z0-9][a-z0-9_-]{0,49}$`를 지킨다. 영문 소문자, 숫자, 하이픈, 밑줄이고 50자까지다.
- 정규화: 앞뒤 공백을 지우고, 대문자는 소문자로, 사이의 공백은 하이픈으로 바꾼다. 그 밖의 글자(한글 등)는 지우지 않고 오류로 알린다. 조용히 지우면 다른 값이 된다.
- 정규화는 입력 칸이 포커스를 잃을 때만 칸의 글자에 적용한다. 치는 도중에는, 조합이 끝날 때에도 칸의 글자를 고치지 않는다. Android 키보드는 영문 단어도 조합으로 넣기 때문에, 조합이 끝날 때 고치면 다음 단어를 치기 전에 끝의 공백이 지워지거나("Summer Sale" → `summersale`) 커서가 끝으로 튄다. 링크는 항상 정규화한 값으로 만든다.
- UTM 입력 칸에는 `autocapitalize="none"`, `autocorrect="off"`, `spellcheck={false}`를 준다.
- `utm_campaign`은 필수다. 입력 칸 아래에 예시 `202610-launch`를 보여 준다.
- `utm_content`는 선택이다. 같은 캠페인 안에서 소재를 구분할 때 쓴다(예: `story`, `feed`).
- `utm_term`과 `utm_id`는 만들지 않는다. 검색 광고 키워드와 광고 플랫폼 연동용이고 이 팀이 쓸 일이 없다.

**만들어지는 링크**

```
https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story
```

기준 주소는 `config.ts`의 `LANDING_URL`이다. 파라미터 순서는 source, medium, campaign, content로 고정한다. 순서가 같아야 같은 링크가 같은 문자열이 된다.

### 화면

```
┌──────────────────────────────────────────────────────────────┐
│ 캠페인 링크 만들기                                             │
│ 어디서 들어왔는지 알 수 있는 링크를 만들어요                     │
│                                                              │
│ ┌ 링크 정보 ──────────────────┐ ┌ 완성된 링크 ───────────────┐ │
│ │ 어디에 올리나요?            │ │ https://citytexi.github…   │ │
│ │ [인스타그램            ▾]   │ │ [링크 복사]                 │ │
│ │ source instagram · medium  │ │                            │ │
│ │ social                     │ │  ▛▀▀▜ QR                   │ │
│ │                            │ │  ▙▄▄▟ [PNG 받기] [SVG 받기] │ │
│ │ 캠페인 이름                 │ │                            │ │
│ │ [202610-launch         ]   │ │ Android에서는 이렇게         │ │
│ │ 예: 202610-launch          │ │ Play로 넘어가요              │ │
│ │                            │ │ https://play.google.com/…  │ │
│ │ 소재 구분 (선택)            │ │ iOS 설치는 캠페인별로        │ │
│ │ [story                 ]   │ │ 측정되지 않아요              │ │
│ └────────────────────────────┘ └────────────────────────────┘ │
│                                                              │
│ ┌ 최근 만든 링크 ───────────────────────────────── [기록 지우기] ┐ │
│ │ 인스타그램 · 202610-launch · story    10월 8일   [다시 열기] │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- 채널을 고르면 source와 medium이 채워지고, 그 값을 입력 칸 아래에 작게 보여 준다. `유료 광고`는 source 칸이, `직접 입력`은 source와 medium 칸이 나타난다.
- 필수 값이 비었거나 형식이 틀리면 완성된 링크 자리에 "캠페인 이름을 넣으면 링크가 만들어져요"처럼 무엇이 빠졌는지 알리고, 복사와 QR 버튼은 그리지 않는다. 틀린 링크를 복사할 수 없어야 한다.
- 오류는 해당 입력 칸 아래에 쓰고 `aria-describedby`로 잇는다. 예: "영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요".
- `링크 복사`는 `CopyButton`(§7)이다.
- 복사하거나 QR을 받으면 그 링크를 최근 기록에 넣는다.

**QR**

- 라이브러리 `uqr`(0.1.3, MIT, 의존성 없음, ESM 27kB)의 `encode(url, { ecc: 'M', border: 4 })`로 행렬을 만든다. 기본값은 `ecc: 'L'`, `border: 1`이라 반드시 넘긴다. 돌려주는 `data`(boolean 행렬)와 `size`에는 여백이 이미 들어 있다.
- 화면에는 그 행렬을 인라인 SVG(`<rect>`)로 그린다. 외부 주소를 쓰지 않으므로 CSP는 그대로다.
- 색은 테마와 상관없이 흰 바탕에 검은 점이다. 어두운 바탕의 QR은 일부 스캐너가 읽지 못한다.
- `PNG 받기`는 캔버스에 `fillRect`로 직접 그린다. 한 칸의 크기는 정수 픽셀이고, 전체가 1024px 이상이 되는 가장 작은 정수 배율을 쓴다. `canvas.toBlob`과 blob 주소의 `<a download>`로 받는다(`src/admin/lib/download.ts`, §7).
- SVG를 `Image`에 넣어 캔버스로 옮기는 방식은 쓰지 않는다. 어드민 CSP의 `img-src`에 `blob:`이 없어서 막힌다.
- `SVG 받기`는 같은 SVG 문자열을 받는다.
- 파일 이름은 `parfait-qr-<source>-<campaign>[-<content>].png`, `.svg`다. 같은 캠페인의 다른 채널이 같은 이름이 되면 안 된다.
- SVG에는 `role="img"`와 "이 링크로 가는 QR 코드"라는 이름을 준다.

**전달 미리보기**

완성된 링크를 랜딩의 함수(§3의 `campaignReferrer`, `playWebUrl`)에 그대로 넣어 나온 Play 주소를 보여 준다. 랜딩과 같은 코드를 쓰므로 미리보기가 실제와 어긋나지 않는다.

**최근 만든 링크**

- `localStorage` 키 `parfait-admin:utm-builder:recent`. 항목은 `{ channel, source, medium, campaign, content, createdAt }`다. 주소는 저장하지 않고 화면에서 다시 만든다. 도메인이 바뀌어도 기록이 낡지 않는다.
- 최신 순으로 20개까지다. source, medium, campaign, content가 모두 같은 항목을 다시 만들면 맨 위로 올린다.
- `다시 열기`는 그 값을 입력 칸에 채운다. 저장된 채널 id가 지금 `config.ts`에 없으면 `직접 입력`으로 열고 저장된 source와 medium을 채운다. `기록 지우기`는 전부 지운다. 되돌릴 수 없으므로 `ConfirmButton`(§7)으로 한 번 더 눌러 확인한다. 지운 뒤 포커스는 캠페인 이름 칸으로 간다.

### URL 상태

| key | 값 |
|-----|----|
| `ch` | 채널 id |
| `src` | source (`paid`, `custom`일 때만) |
| `med` | medium (`custom`일 때만) |
| `camp` | campaign |
| `content` | content |

이 URL을 넘기면 받은 사람의 화면에 같은 링크가 만들어진다. 알 수 없는 `ch`는 무시하고 채널을 고르지 않은 상태로 연다. 글자를 치는 칸은 `useDebouncedPageParam`(§7)으로 URL에 쓴다.

### 좁은 화면

960px 미만에서는 한 줄로 쌓는다. 순서는 링크 정보, 완성된 링크, 최근 만든 링크다.

## 3. 랜딩이 Play로 UTM 전달

### 지금의 문제

랜딩에는 GA 태그가 없고, 스토어 링크에 UTM을 넘기지도 않는다. 그래서 `?utm_source=…`를 붙여도 흔적이 남지 않는다.

### 바꾸는 것

`src/landing/ua.ts`가 페이지 주소에서 캠페인 값을 뽑아 Play 링크의 `referrer`로 넘긴다.

```ts
export const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const

/** 'utm_source=instagram&utm_medium=social&utm_campaign=x' 같은 문자열. 넘길 것이 없으면 ''. */
export function campaignReferrer(pageUrl: string): string
export function playWebUrl(referrer?: string): string
export function playIntentUrl(referrer?: string): string
```

**`campaignReferrer`의 알고리즘**

`ua.ts`와 인라인 스크립트가 글자 그대로 같은 절차를 쓴다. `URL`과 `URLSearchParams`는 쓰지 않는다. 인라인 스크립트는 ES5이고, 두 쪽이 다른 해석기를 쓰면 인코딩된 값에서 결과가 갈린다.

1. `pageUrl`에서 첫 `#`부터 끝까지를 버린다.
2. 첫 `?` 뒤의 문자열을 쿼리로 본다. `?`가 없으면 `''`을 돌려준다.
3. 쿼리를 `&`로 나눈다. 각 조각을 첫 `=`에서 key와 값으로 나눈다. `=`가 없는 조각은 버린다.
4. **디코딩하지 않는다.** key는 `CAMPAIGN_KEYS`와 대소문자까지 똑같이 비교한다. 값은 있는 그대로 `^[A-Za-z0-9._~-]{1,100}$`에 맞는지 본다. 맞지 않으면 그 조각을 버린다.
5. 같은 key가 여러 번 나오면 첫 번째로 통과한 것이 아니라 **첫 번째 조각**만 본다. 그 조각이 버려졌으면 그 key는 없는 것이다.
6. `utm_source`가 없으면 `''`을 돌려준다. source 없는 캠페인은 GA에서 쓸 수 없다.
7. 남은 것을 `CAMPAIGN_KEYS` 순서대로 `key=값`으로 만들어 `&`로 잇는다.

디코딩하지 않으므로 `utm_campaign=a%2Db`, `utm%5Fsource=x`, `utm_source=a+b`는 모두 버려진다. 빌더가 만드는 값(§2의 형식)은 인코딩이 필요 없는 글자뿐이라 전부 통과한다. 랜딩은 누구나 주소를 만들어 열 수 있으므로, 받은 값을 스토어 주소에 그대로 싣지 않는 것이 목적이다. 통과한 값에는 `;`, `#`, `%`, `&`가 없어서 intent 주소의 구조를 깰 수 없다.

**주소 조립**

- `playWebUrl(referrer)`: referrer가 있으면 `https://play.google.com/store/apps/details?id=com.teamyg.parfait&referrer=<encodeURIComponent(referrer)>`, 없으면 지금의 `PLAY_WEB_URL`과 같다. `PLAY_WEB_URL` 상수는 `playWebUrl()`의 값으로 남긴다.
- `playIntentUrl(referrer)`: referrer가 있으면 `intent://details?id=com.teamyg.parfait&referrer=<encodeURIComponent(referrer)>#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=<encodeURIComponent(playWebUrl(referrer))>;end`. 없으면 지금과 글자 하나 다르지 않다.

iOS의 App Store 링크는 바꾸지 않는다(§8).

### 인라인 스크립트

`index.html`의 인라인 스크립트는 Android 일반 브라우저를 React가 뜨기 전에 Play로 보낸다. Android 유입의 대부분이 이 경로다. 이 스크립트는 번들 밖에 있고(Vite가 변환하지 않고 그대로 내보낸다) `ua.ts`를 import할 수 없어서, 같은 로직을 ES5로 한 번 더 적는다.

- referrer를 만드는 코드는 `try`/`catch`로 감싼다. 예외가 나면 지금의 이동 주소(referrer 없는 intent)로 보낸다. 새 코드 때문에 기존 이동이 멈추면 안 된다.
- **OS 판정 순서를 `detectPlatform`과 맞춘다.** 지금 인라인 스크립트는 `/Android/`만 보고, `detectPlatform`은 iOS 토큰(`iPhone|iPad|iPod`)을 먼저 본다. `… (Windows Phone 10.0; Android 6.0.1) like iPhone` 같은 UA에서 둘이 갈린다. 인라인 스크립트도 iOS 토큰이 있으면 이동하지 않게 고친다. 터치 지원으로 가리는 iPadOS 규칙(`Macintosh`)은 Android와 겹치지 않으므로 인라인에 넣지 않는다.

### 두 곳을 묶는 테스트

`src/landing/inlineScript.test.ts`를 새로 만든다.

- `index.html`은 `import html from '../../index.html?raw'`로 읽는다. `src`에는 `vite/client` 타입만 있어서 `node:fs`를 import하면 `npm run typecheck`가 실패한다.
- `<script>` 가운데 `src` 속성이 없는 것이 정확히 하나인지 확인하고, 아니면 테스트가 실패한다. 스크립트가 옮겨지거나 늘어났을 때 조용히 지나가면 안 된다.
- 본문은 `new Function('navigator', 'location', body)(가짜 navigator, 가짜 location)`으로 실행한다. jsdom의 `location.replace`는 가로챌 수 없다.
- 실행 뒤 `location.replace`에 넘어간 주소(없으면 `null`)를 `landingView(detectPlatform(ua, 0), pageUrl).autoRedirect`와 비교한다.

비교하는 입력은 UA와 주소의 곱이다.

- UA: 랜딩 분기 테스트의 프리셋 전부(§4, `config.ts`에서 가져온다), 그리고 토큰이 섞인 UA(`Android`와 `iPhone`이 함께, `Android`와 `KAKAOTALK`, `Android`와 `Line/`)
- 주소: UTM 없음, 여섯 개 다 있음, source 없음, 허용하지 않는 글자, 101자 값, 같은 key 두 번(첫 조각이 틀린 경우와 맞는 경우), `#fragment`, 퍼센트 인코딩된 값, `+`, 인코딩된 key, 대문자 key, 빈 값, `=` 없는 key, 깨진 퍼센트(`%E0%`), `?` 없음

지금은 "두 곳이 같아야 한다"는 주석만 있고 확인하는 테스트가 없다. 이 테스트는 기존 분기 규칙도 함께 묶는다.

### 랜딩 화면의 판정을 한 곳으로

`Landing.tsx`는 어떤 버튼을 보일지를 직접 계산한다. 랜딩 분기 테스트(§4)가 같은 판정을 보여 줘야 하므로, 판정을 `ua.ts`로 옮기고 `Landing.tsx`는 그 결과를 그리기만 한다.

```ts
export type LandingButton = {
  id: 'store' | 'appstore' | 'external'
  label: string
  href: string
  variant: 'primary' | 'secondary'
}
export type LandingView = {
  /** 인라인 스크립트가 페이지를 그리기 전에 보내는 주소. 보내지 않으면 null. */
  autoRedirect: string | null
  /** 자동 이동을 하지 않는 이유. 하면 null. */
  noRedirectReason: 'in-app' | 'not-android' | null
  buttons: LandingButton[]
  /** 인앱 브라우저 안내 문구를 보이는지. */
  showInAppHint: boolean
  /** Play로 넘기는 캠페인 문자열. 없으면 ''. */
  referrer: string
}
export function landingView(platform: Platform, pageUrl: string): LandingView
```

| OS | 인앱 | 자동 이동 | 버튼 (순서대로) | 안내 문구 |
|----|------|-----------|------------------|-----------|
| android | 아님 | `playIntentUrl(referrer)` | `store` → `playIntentUrl(referrer)` | 없음 |
| android | 인앱 | 없음 (`in-app`) | `store` → `playIntentUrl(referrer)`, `external` → `externalBrowserUrl(pageUrl, kakao)` | 있음 |
| ios | 무관 | 없음 (`not-android`) | `appstore` → `APP_STORE_URL` | 없음 |
| other | 무관 | 없음 (`not-android`) | `store` → `playWebUrl(referrer)`, `appstore` → `APP_STORE_URL` | 없음 |

- `store`와 `appstore`는 `primary`, `external`은 `secondary`다. 지금의 `btn primary`와 `btn` 클래스에 대응한다.
- 버튼의 `label`은 지금 `Landing.tsx`의 글자 그대로다.
- 데스크톱(`other`)의 Play 버튼에도 referrer를 싣는다. 데스크톱에서 Play 웹으로 가서 기기에 설치를 보내는 경우가 있다.

랜딩의 모양과 문구는 바뀌지 않는다. 기존 `Landing.test.tsx`와 `ua.test.ts`가 그대로 통과해야 한다.

### 그대로 두는 것

인앱 브라우저의 `외부 브라우저로 열기`는 지금도 페이지 주소를 쿼리째 넘긴다(`#fragment`만 뗀다). 외부 브라우저에서 랜딩이 다시 열리면 인라인 스크립트가 UTM을 Play로 넘긴다. 고칠 것이 없다.

## 4. 랜딩 분기 테스트

### 메뉴

| 필드 | 값 |
|------|----|
| `id` | `ua-tester` |
| `group` | `devtools` |
| `order` | 120 |
| `label` | 랜딩 분기 테스트 |
| `description` | 기기와 앱마다 랜딩이 어떻게 열리는지 확인해요 |
| `keywords` | `UA`, `user agent`, `딥링크`, `인앱`, `랜딩` |
| `usesPeriod`, `usesGa` | `false` |

### 화면

```
┌──────────────────────────────────────────────────────────────┐
│ 랜딩 분기 테스트                                               │
│ 기기와 앱마다 랜딩이 어떻게 열리는지 확인해요                     │
│                                                              │
│ 기기 [iPhone Safari] [iPad] [Android Chrome] [인스타그램 인앱]   │
│      [카카오톡 인앱 (Android)] [카카오톡 인앱 (iOS)] [네이버 앱]  │
│      [데스크톱] [내 브라우저]                                   │
│                                                              │
│ UA 문자열                                                     │
│ [Mozilla/5.0 (Linux; Android 14; …) … KAKAOTALK/10.0.0     ] │
│ [✓] 터치를 지원해요                                            │
│ 랜딩 주소                                                     │
│ [https://citytexi.github.io/…/?utm_source=kakaotalk&…      ] │
│                                                              │
│ ┌ 결과 ────────────────────────────────────────────────────┐ │
│ │ 판정     Android · 인앱 브라우저 · 카카오톡                   │ │
│ │ 자동 이동  하지 않아요 (인앱 브라우저라서)                     │ │
│ │ 보이는 버튼                                                │ │
│ │  Google Play에서 다운로드   intent://details?id=…          │ │
│ │  외부 브라우저로 열기        kakaotalk://web/openExternal?… │ │
│ │ 안내 문구  보여요                                           │ │
│ │ Play로 넘기는 캠페인  utm_source=kakaotalk&utm_medium=…     │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- 결과는 `detectPlatform(ua, 터치 ? 5 : 0)`과 `landingView(platform, 랜딩 주소)`를 그대로 보여 준다(`src/landing/ua.ts`). 이 화면에는 판정 로직이 없다. 자동 이동의 이유는 `noRedirectReason`, 캠페인 줄은 `referrer`에서 온다.
- 프리셋 버튼은 UA 문자열과 터치 여부를 채운다. 고른 프리셋은 `aria-pressed`로 표시한다. UA 문자열을 직접 고치면 프리셋 선택이 풀린다. 프리셋은 `config.ts`에 데이터로 둔다(§3의 테스트도 이 데이터를 쓴다).
- `내 브라우저`는 `navigator.userAgent`와 `navigator.maxTouchPoints > 0`을 채운다.
- 랜딩 주소의 기본값은 `LANDING_URL`이다. `https://`로 시작하는 주소가 아니면 칸 아래에 알리고 결과의 주소 칸들을 비운다.
- 자동 이동 줄은 이유를 함께 쓴다: "Play로 바로 보내요" / "하지 않아요 (인앱 브라우저라서)" / "하지 않아요 (Android가 아니라서)".
- 주소는 길어서 줄바꿈을 허용하고(`overflow-wrap: anywhere`), 주소마다 복사 버튼을 둔다. 버튼 이름은 "Google Play에서 다운로드 주소 복사"처럼 무엇을 복사하는지 담는다.
- UA와 주소 입력 칸에는 `autocapitalize="none"`, `autocorrect="off"`, `spellcheck={false}`를 주고, 주소 칸에는 `inputmode="url"`도 준다.
- 960px 미만에서는 결과 표의 이름과 값을 위아래로 쌓는다.
- 결과 영역은 `aria-live="polite"`가 아니다. 글자를 칠 때마다 읽히면 안 된다. 결과는 입력 바로 아래에 있는 일반 영역이다.

### URL 상태

| key | 값 |
|-----|----|
| `preset` | 프리셋 id |
| `ua` | UA 문자열 (프리셋과 다를 때만) |
| `touch` | `0` 또는 `1` (프리셋과 다를 때만) |
| `url` | 랜딩 주소 (기본값과 다를 때만) |

"이 UA에서 이상해요"를 링크 하나로 넘길 수 있다. `ua`와 `url`은 `useDebouncedPageParam`(§7)으로 쓴다.

## 5. 바로가기

### 메뉴

| 필드 | 값 |
|------|----|
| `id` | `link-hub` |
| `group` | `ops` |
| `order` | 110 |
| `label` | 바로가기 |
| `description` | 자주 쓰는 콘솔과 문서를 한곳에서 열어요 |
| `keywords` | `링크`, `Firebase`, `Play Console`, `App Store`, `콘솔` |
| `usesPeriod`, `usesGa` | `false` |

### 팀 링크

`links.ts`에 데이터로 둔다. 팀원 모두에게 같은 목록이 보이고 PR로 고친다.

```ts
export type LinkGroupId = 'analytics' | 'store' | 'dev' | 'docs'
export type TeamLink = { id: string; group: LinkGroupId; label: string; description: string; url: string }
```

| 묶음 | 이름 | 주소 |
|------|------|------|
| 분석 | Firebase 콘솔 | `https://console.firebase.google.com/project/parfait-5934b/overview` |
| 분석 | Google Analytics | `https://analytics.google.com/analytics/web/#/p543897329/reports/intelligenthome` |
| 스토어 | Play Console | `https://play.google.com/console` |
| 스토어 | App Store Connect | `https://appstoreconnect.apple.com/apps` |
| 스토어 | Play 스토어 페이지 | `PLAY_WEB_URL` (`src/landing/ua.ts`) |
| 스토어 | App Store 페이지 | `APP_STORE_URL` (`src/landing/ua.ts`) |
| 개발 | 이 레포 (GitHub) | `https://github.com/citytexi/temp-parfait-multi-link-web` |
| 개발 | Google Cloud 콘솔 | `https://console.cloud.google.com/apis/credentials?project=parfait-5934b` |
| 개발 | 랜딩 페이지 | `LANDING_URL` |

`디자인·문서` 묶음(Figma, Notion)은 주소를 아직 받지 못했다. 링크가 없는 묶음은 화면에 나오지 않는다. 주소를 받으면 `links.ts`에 더한다.

위 주소는 모두 프로젝트 id나 공개 식별자뿐이고, 열려면 각 서비스의 로그인이 필요하다.

### 내 링크

- 화면에서 추가, 수정, 삭제한다. 그 브라우저에만 저장된다. `localStorage` 키 `parfait-admin:link-hub:personal`, 값은 `{ id, label, url }[]`.
- 이름은 1~40자, 주소는 `URL`로 해석되고 `protocol`이 `https:`인 것만 받는다. `javascript:` 같은 주소가 저장돼 링크로 그려지면 안 된다. 읽을 때도 같은 검사를 다시 한다. 저장된 값은 믿을 수 없는 입력이다.
- 50개까지다. 넘으면 추가 버튼 자리에 "내 링크는 50개까지 둘 수 있어요"를 보여 준다.
- 삭제는 `ConfirmButton`(§7)으로 한 번 더 눌러 확인한다.
- 화면에 "내 링크는 이 브라우저에만 저장돼요. 비밀번호나 토큰이 들어간 주소는 넣지 마세요."를 적는다. `github.io` 주소에서는 같은 계정의 다른 페이지가 같은 저장소를 읽을 수 있다.
- 삭제한 뒤 포커스는 다음 링크로, 없으면 추가 버튼으로 간다. 추가하거나 고친 뒤에는 그 링크로 간다.
- 수정과 삭제 버튼은 누르는 영역이 44px 이상이고 서로 8px 이상 떨어져 있다.

### 화면

- 맨 위에 검색 칸(이름, 설명, 주소에서 찾는다). 검색어는 URL에 두지 않는다. 화면 안에서만 쓰는 필터다.
- 묶음마다 카드 하나, 그 안에 링크 타일이 격자로 놓인다. 타일에는 이름, 설명, 주소의 호스트 이름이 있다. 타일 전체가 링크다.
- 모든 링크는 `target="_blank"`, `rel="noopener noreferrer"`로 연다. 이름 뒤에 "새 탭에서 열려요"를 스크린 리더용으로 붙인다.
- `내 링크` 카드는 맨 아래에 있고, 타일마다 수정과 삭제 버튼이 있다. 타일 안에 버튼을 넣으면 링크 안에 버튼이 들어가므로, 내 링크의 타일은 링크와 버튼을 형제로 둔다.
- 검색 결과가 없으면 "찾는 링크가 없어요"와 `검색 지우기`를 보여 준다.
- 타일 격자는 화면 폭에 따라 열 수가 줄고, 960px 미만에서는 한 열이다.

## 6. 릴리즈 체크리스트

### 메뉴

| 필드 | 값 |
|------|----|
| `id` | `release-checklist` |
| `group` | `ops` |
| `order` | 120 |
| `label` | 릴리즈 체크리스트 |
| `description` | 배포 전에 확인할 것을 빠짐없이 챙겨요 |
| `keywords` | `배포`, `출시`, `릴리즈`, `체크`, `QA` |
| `usesPeriod`, `usesGa` | `false` |

### 항목

`template.ts`에 데이터로 둔다.

```ts
export type ReleasePlatform = 'android' | 'ios'
export type ChecklistItem = {
  id: string                      // 한 번 정하면 바꾸지 않는다
  label: string
  help?: string
  platforms?: readonly ReleasePlatform[]   // 생략하면 모든 릴리즈에 나온다
  menu?: string                   // 관련 어드민 메뉴 id. 있으면 "열기" 링크를 둔다
}
export type ChecklistSection = { id: string; title: string; items: readonly ChecklistItem[] }
```

초안이다. 스펙을 확인할 때 고쳐 달라.

| 구역 | id | 항목 | 플랫폼 |
|------|----|------|--------|
| 준비 | `version-bumped` | 버전 이름과 빌드 번호를 올렸어요 | 공통 |
| 준비 | `release-notes` | 릴리즈 노트를 썼어요 | 공통 |
| 준비 | `server-order` | 서버 배포가 먼저 필요한지 확인했어요 | 공통 |
| 준비 | `remote-config` | Remote Config 값을 확인했어요 | 공통 |
| 확인 | `core-flows` | 가입, 로그인, 사진 올리기, 캔버스 공유, 알림을 직접 해 봤어요 | 공통 |
| 확인 | `events-arrive` | 새로 넣은 이벤트가 GA에 들어오는지 봤어요 | 공통 |
| 확인 | `no-crash` | 테스트 빌드에서 크래시가 없었어요 | 공통 |
| 확인 | `landing-links` | 랜딩에서 스토어로 잘 넘어가는지 봤어요 (`menu: 'ua-tester'`) | 공통 |
| Android | `android-signed` | 릴리즈 빌드의 서명과 난독화를 확인했어요 | Android |
| Android | `android-internal` | 내부 테스트 트랙에 올리고 설치해 봤어요 | Android |
| Android | `android-listing` | 스토어 설명과 스크린샷을 반영했어요 | Android |
| Android | `android-rollout` | 단계적 출시 비율을 정했어요 | Android |
| Android | `android-submitted` | 심사를 요청했어요 | Android |
| iOS | `ios-testflight` | TestFlight에 올리고 설치해 봤어요 | iOS |
| iOS | `ios-listing` | 스토어 설명과 스크린샷을 반영했어요 | iOS |
| iOS | `ios-review-notes` | 심사 메모와 테스트 계정을 적었어요 | iOS |
| iOS | `ios-release-mode` | 출시 방식(수동, 자동)을 골랐어요 | iOS |
| iOS | `ios-submitted` | 심사를 요청했어요 | iOS |
| 출시 후 | `store-visible` | 스토어에 새 버전이 보여요 | 공통 |
| 출시 후 | `crash-watch` | 출시 뒤 크래시 지표를 봤어요 | 공통 |
| 출시 후 | `version-adoption` | 새 버전 사용자가 늘고 있어요 (`menu: 'tech'`) | 공통 |
| 출시 후 | `team-notified` | 팀에 출시를 알렸어요 | 공통 |

- 항목 id는 테스트로 중복을 막는다.
- `menu`는 레지스트리에 있는 id일 때만 링크를 그린다(`useNav().setMenu`). 없는 메뉴를 가리키면 링크 없이 항목만 보인다. `events-arrive`는 묶음 2의 `event-stream`이 머지된 뒤에 `menu`를 더한다.

### 릴리즈

체크는 릴리즈 단위로 한다.

```ts
type Release = {
  id: string
  name: string                          // 예: '1.5.0'. 1~40자
  platforms: ReleasePlatform[]          // 하나 이상
  checked: Record<string, string>       // 항목 id → 체크한 시각(ISO). 프로토타입 없는 객체로 다룬다
  createdAt: string
}
```

- `localStorage` 키 `parfait-admin:release-checklist:releases`. 최신 순 30개까지다. 넘으면 새로 만들 때 "릴리즈는 30개까지 둘 수 있어요. 지난 릴리즈를 지워 주세요."라고 알리고 만들지 않는다. 오래된 것을 조용히 지우지 않는다.
- 릴리즈에 보이는 항목은 `platforms`가 없거나 릴리즈의 플랫폼과 겹치는 항목이다. 플랫폼 구역(`Android`, `iOS`)은 해당 플랫폼이 없으면 통째로 빠진다.
- 템플릿이 바뀌어도 기존 릴리즈는 깨지지 않는다. 없어진 항목의 체크는 무시하고, 새 항목은 체크되지 않은 채로 나온다.
- 진행률은 `체크한 수 / 보이는 항목 수`다.

### 화면

```
┌──────────────────────────────────────────────────────────────┐
│ 릴리즈 체크리스트                                              │
│ 배포 전에 확인할 것을 빠짐없이 챙겨요                            │
│                                                              │
│ 릴리즈 [1.5.0 · Android, iOS ▾]  [새 릴리즈]                    │
│ ████████████░░░░░░░░  12 / 22                                │
│ [진행 상황 복사] [링크로 공유] [이 릴리즈 지우기]                 │
│                                                              │
│ ┌ 준비  4 / 4 ─────────────────────────────────────────────┐ │
│ │ [✓] 버전 이름과 빌드 번호를 올렸어요                         │ │
│ │ [✓] 릴리즈 노트를 썼어요                                    │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌ 확인  2 / 4 ─────────────────────────────────────────────┐ │
│ │ [ ] 랜딩에서 스토어로 잘 넘어가는지 봤어요   [랜딩 분기 테스트 열기] │ │
│ └──────────────────────────────────────────────────────────┘ │
│ 체크한 내용은 이 브라우저에만 저장돼요.                          │
└──────────────────────────────────────────────────────────────┘
```

- 릴리즈가 하나도 없으면 "아직 릴리즈가 없어요. 버전 이름을 정해서 시작해 보세요."와 새 릴리즈 폼(버전 이름, 플랫폼 체크박스)을 보여 준다.
- 항목은 진짜 체크박스(`<input type="checkbox">`와 `<label>`)다. 줄 전체를 눌러도 체크된다.
- 진행률은 `<progress>`와 "12 / 22" 텍스트를 함께 쓴다. 구역 제목에도 그 구역의 진행을 적는다.
- 전부 체크하면 진행률 옆에 "모두 확인했어요"를 보여 주고, 페이지의 상태 영역(§7)으로 알린다.
- `이 릴리즈 지우기`는 한 번 더 눌러 확인한다. 지운 뒤 포커스는 릴리즈 선택 상자로 간다. 릴리즈를 만들거나 가져온 뒤에는 그 릴리즈의 진행률 제목으로 간다.
- 버전 이름에는 제어 문자와 줄바꿈을 받지 않는다. 이름이 복사한 텍스트에 그대로 들어가기 때문이다.
- 960px 미만에서는 릴리즈 선택 상자와 버튼들을 줄바꿈해서 쌓는다.

### 공유

저장소가 없으므로 공유는 두 가지로 한다.

두 버튼 모두 `CopyButton`(§7)을 쓴다. 클립보드를 쓸 수 없으면 내용이 든 읽기 전용 글상자가 나타난다.

**진행 상황 복사**: 슬랙에 붙일 텍스트를 복사한다.

```
파르페 1.5.0 릴리즈 (Android, iOS) 12 / 22

준비 4/4
✅ 버전 이름과 빌드 번호를 올렸어요
…
확인 2/4
⬜ 랜딩에서 스토어로 잘 넘어가는지 봤어요
```

**링크로 공유**: 체크 상태를 URL 파라미터 `share`에 담아 복사한다.

- 담는 값은 `{ v: 1, name, platforms, checked: 항목 id 배열 }`의 JSON을 `TextEncoder`로 UTF-8 바이트로 바꾼 뒤 base64url로 적은 것이다. `btoa`에 문자열을 바로 넣으면 한글 이름에서 예외가 난다. 체크한 시각은 담지 않는다.
- 링크는 `origin + pathname + '?menu=release-checklist&share=…'`다. 보내는 사람의 `release` 파라미터는 싣지 않는다.
- 템플릿의 모든 항목을 체크하고 이름을 40자로 채운 값도 4,000자를 넘지 않아야 한다. 테스트로 확인한다.
- 이 링크로 열면 읽기 전용으로 보인다. 항목은 체크박스가 아니라 목록으로 그리고 항목마다 "확인함" 또는 "아직"을 글자로 쓴다. `disabled` 체크박스는 Tab으로 갈 수 없어서 스크린 리더와 키보드 사용자가 읽기 어렵다. 맨 위에 "공유받은 릴리즈예요. 읽기 전용이에요."와 `내 브라우저로 가져오기`, `닫기` 버튼이 있다.
- `내 브라우저로 가져오기`는 새 릴리즈로 저장하고 `share`를 지운다. 가져온 체크의 시각은 가져온 시각이다. 같은 이름의 릴리즈가 이미 있어도 새로 만든다. 덮어쓰지 않는다. 릴리즈가 이미 30개면 30개 제한 문구를 보여 주고 `share`를 지우지 않는다.
- `닫기`는 `share`를 지우고 포커스를 릴리즈 선택 상자로 보낸다.
- `share`는 믿을 수 없는 입력이다. 아래 중 하나라도 어긋나면 "공유 링크를 읽지 못했어요"를 보여 주고 평소 화면을 그린다: 풀기 전 길이 4,000자 이하, base64url과 UTF-8과 JSON으로 풀림, `v === 1`, `name`이 1~40자이고 제어 문자가 없음, `platforms`가 `android`와 `ios`로만 이뤄진 비어 있지 않은 배열(중복은 합친다), `checked`가 문자열 배열. 템플릿에 없는 항목 id는 버린다.

### URL 상태

| key | 값 |
|-----|----|
| `release` | 보고 있는 내 릴리즈의 id. 없거나 모르는 id면 가장 최근 릴리즈 |
| `share` | 공유받은 릴리즈 |

## 7. 공용 코드

### 파일 위치

```
src/admin/lib/
  localStore.ts            브라우저 저장
  useDebouncedPageParam.ts 글자를 치는 칸의 URL 쓰기
  download.ts              Blob을 파일로 받기
  siteUrls.ts              LANDING_URL
src/admin/components/form/
  TextField.tsx, SelectField.tsx, CheckboxField.tsx
  ConfirmButton.tsx, CopyButton.tsx, StatusRegion.tsx
  form.css
src/admin/pages/devtools/utm-builder/      config.ts(채널, 형식), qr.ts, …
src/admin/pages/devtools/ua-tester/        config.ts(프리셋), …
src/admin/pages/ops/link-hub/              links.ts(팀 링크), …
src/admin/pages/ops/release-checklist/     template.ts(항목), share.ts, …
src/landing/
  ua.ts, Landing.tsx       §3
  inlineScript.test.ts     §3
```

`src/admin/pages/devtools/shared/`, `event-stream/`, `event-dictionary/`에는 아무것도 만들지 않는다. 묶음 2의 폴더다.

### `src/admin/lib/localStore.ts`

```ts
export type Parser<T> = (raw: unknown) => T | null
export function readStored<T>(key: string, parse: Parser<T>, fallback: T): T
export function writeStored(key: string, value: unknown): boolean
export type Stored<T> = {
  value: T
  /** 저장소의 최신 값에 fn을 적용해 쓴다. 저장에 성공하면 true. */
  update(fn: (current: T) => T): boolean
  /** 마지막 쓰기가 저장소에 들어갔는지. 한 번도 쓰지 않았으면 true. */
  persisted: boolean
}
export function useStored<T>(key: string, parse: Parser<T>, fallback: T): Stored<T>
```

- key는 `parfait-admin:`로 시작해야 한다. 아니면 개발 모드에서 예외를 던진다.
- 저장하는 모양은 `{ v: 1, items: … }`다. `readStored`와 `writeStored`가 이 껍데기를 붙이고 뗀다. `v`가 다르면 `fallback`이다. 나중에 모양을 바꿀 때 옛 값을 구분할 수 있다.
- 읽기: 값이 없거나, JSON이 깨졌거나, `parse`가 `null`을 돌려주거나, 저장소 접근이 막혀 있으면 `fallback`이다.
- 쓰기: 실패하면(용량 초과, 접근 차단) `false`를 돌려주고 예외를 던지지 않는다.
- `update`는 쓰기 직전에 저장소를 다시 읽어 그 값에 `fn`을 적용한다. 탭 두 개에서 번갈아 체크해도 한쪽의 변경이 다른 쪽을 덮어쓰지 않는다. 화면이 들고 있던 값으로 전체를 덮어쓰지 않는다.
- 쓰기에 실패해도 화면의 값은 `fn`을 적용한 값으로 바뀌고 `persisted`가 `false`가 된다. 화면은 계속 동작하고, 각 페이지는 `persisted`가 `false`일 때 "이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요."를 보여 준다.
- 저장되지 않은 값은 다른 메뉴로 갔다가 돌아와도 남아 있고, 창을 새로 고치면 사라진다. 그 사이에 다른 탭이 저장에 성공했으면 저장소의 값을 따른다.
- 저장된 `v`가 지금 버전보다 크면 그 값은 건드리지 않는다. 그 key는 읽기 전용이 된다. `value`는 `fallback`이고, `update`는 화면의 값만 바꾸고 쓰지 않으며, `persisted`는 `false`다. `writeStored`도 덮어쓰지 않고 `false`를 돌려준다. 배포로 버전이 오른 뒤에도 열려 있던 옛 탭이 새 값을 지우지 않게 한다.
- 다른 탭의 변경은 `storage` 이벤트로 따른다. `key`가 `null`인 이벤트(저장소 전체 삭제)도 처리한다.
- 같은 저장 문자열에는 같은 값(같은 참조)을 돌려준다. `fallback`을 호출할 때마다 새 배열로 넘겨도 다시 그리기가 반복되지 않는다.
- 기존 `src/admin/menu/collapsed.ts`는 고치지 않는다.

저장소는 출처(origin) 단위다. 도메인이 바뀌면(`feat/custom-domain`) 저장한 값은 새 주소에서 보이지 않는다. 릴리즈는 `링크로 공유`로 옮길 수 있다. 내 링크와 최근 기록은 옮기는 방법을 두지 않는다.

### `src/admin/lib/useDebouncedPageParam.ts`

```ts
/** [칸에 보일 값, 칸의 값 바꾸기, 지금 바로 URL에 쓰기] */
export function useDebouncedPageParam(key: string, delayMs?: number): [string, (value: string) => void, () => void]
```

- 글자를 치는 모든 칸(`camp`, `content`, `src`, `med`, `ua`, `url`)이 이 훅으로 URL에 쓴다. 기반의 `usePageParam`은 부를 때마다 `history.replaceState`를 부르고, 글자마다 부르면 브라우저의 호출 제한에 걸릴 수 있다.
- 마지막 입력 뒤 300ms에 쓴다. "지금 바로 쓰기"는 칸이 포커스를 잃을 때 부른다. 한글 조합 중에는 쓰지 않는다. 빈 값은 파라미터를 지운다.
- URL의 값이 바깥에서 바뀌면(뒤로 가기, `다시 열기`) 칸의 값을 그것으로 바꾸고 남은 타이머를 지운다.
- `NavContext.tsx`는 고치지 않는다.
- 묶음 2의 `SearchField`가 같은 규칙을 컴포넌트 안에 갖고 있다. 두 묶음이 머지된 뒤 `SearchField`가 이 훅을 쓰도록 합치는 것을 후속 작업으로 둔다.

### `src/admin/lib/download.ts`

`downloadBlob(filename, blob)`. `src/admin/lib/csv.ts`의 `downloadCsv`와 같은 방식(blob 주소와 `<a download>`)이다. `csv.ts`는 고치지 않는다.

### `src/admin/lib/siteUrls.ts`

`LANDING_URL`. 캠페인 링크, 분기 테스트, 바로가기가 함께 쓴다. 테스트가 이 값이 `index.html`의 `og:url`과 같은지 확인한다(`?raw`로 읽는다). 도메인을 옮기는 브랜치가 `og:url`만 바꾸고 이 값을 빠뜨리면 테스트가 실패한다.

### `src/admin/components/form/`

지금 어드민에는 공용 입력 컴포넌트가 없고, 이 묶음의 네 화면이 모두 입력을 쓴다.

- `TextField`, `SelectField`, `CheckboxField`: 보이는 라벨, 도움말, 오류를 갖고 `aria-describedby`와 `aria-invalid`로 잇는다.
- `StatusRegion`: 페이지마다 하나, 처음부터 그려져 있고 화면에는 보이지 않는 `role="status"` 영역이다. `CopyButton`과 `ConfirmButton`과 페이지가 여기에 글자를 써서 알린다. 내용과 함께 새로 그려지는 상태 영역은 스크린 리더가 읽지 않는 경우가 많다.
- `CopyButton`: 클립보드에 넣고 버튼 글자를 2초 동안 `복사했어요`로 바꾸고 `StatusRegion`에 알린다. 버튼의 역할은 바꾸지 않는다. 클립보드가 없거나 실패하면 버튼 아래에 내용이 든 읽기 전용 글상자를 보여 주고 내용을 선택한다. 이 동작은 버튼에 들어 있고 페이지가 따로 만들지 않는다.
- `ConfirmButton`: 누르면 글자가 확인 문구(예: `정말 지울까요?`)로 바뀌고, 다시 누르면 실행한다. 확인 상태는 시간으로 풀리지 않고, 포커스를 잃거나 Escape를 누르면 풀린다. 시간 제한은 스크린 리더와 스위치 사용자에게 장벽이다. 확인 상태가 된 뒤 400ms 안의 누름은 무시한다. 더블 탭으로 지워지면 안 된다.
- `NotSavedNote`: `persisted`를 받아 `false`일 때 "이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요."를 보여 준다. `true`에서 `false`로 바뀔 때마다 `StatusRegion`에 한 번 알린다. 세 화면이 이것을 쓰고 문구를 따로 적지 않는다. 검색이나 화면 전환으로 가려지지 않는 자리에 둔다.
- 스타일은 `form.css`에 두고 클래스는 `adm-field`, `adm-confirm`, `adm-copy`, `adm-status-region`, `adm-not-saved`로 시작한다. `admin.css`는 고치지 않는다.
- 입력 글자 크기는 16px(`--adm-fs-md`) 이상, 누르는 영역은 44px(`--adm-hit`) 이상이다.

묶음 2는 자기 복사 버튼과 `SearchField`를 따로 만든다. 병렬 작업이라 이 묶음에서는 쓰지 않는다. 머지된 뒤 `components/form/`으로 합치는 것을 후속 작업으로 둔다.

### 고치는 것

- `src/landing/ua.ts`, `src/landing/Landing.tsx`, `index.html`: §3
- `package.json`, `package-lock.json`: `uqr` 추가. 묶음 2는 의존성을 더하지 않으므로 겹치지 않는다.
- `README.md`: "페이지 모듈 규칙" 뒤에 새 소제목 "브라우저 저장과 입력"을 더해 `localStore`, `useDebouncedPageParam`, `components/form/`을 쓰라고 적는다. "어드민 메뉴 추가하기"의 1~4번 항목은 묶음 2가 고치므로 건드리지 않는다.

### 어드민이 랜딩 코드를 import하는 것

`ua-tester`, `utm-builder`, `link-hub`이 `src/landing/ua.ts`를 import한다. `tsconfig.app.json`이 `src` 전체를 포함하므로 타입 검사는 통과한다. `ua.ts`는 DOM을 만지지 않는 순수 함수와 상수뿐이라 어드민 번들에 들어가도 부수 효과가 없다. 이 성질은 유지해야 하므로 `ua.ts` 맨 위에 그 사실을 주석으로 적는다.

비용이 하나 있다. 빌드에서 `ua.ts`가 랜딩과 어드민이 함께 쓰는 별도 조각(약 1kB)이 되어, 랜딩이 요청을 하나 더 보낸다.

## 8. 이번에 하지 않는 것

- **iOS 캠페인 측정**: App Store 링크의 캠페인 토큰은 App Store Connect에서만 보이고 GA에는 들어오지 않는다. 제공자 ID도 필요하다. 필요해지면 `landingView`에 더한다.
- **랜딩 방문 자체의 측정**: 랜딩에 GA 태그를 넣는 일이다. 지표 확장이라 이번 범위가 아니다.
- **팀이 함께 보는 체크리스트 상태**: 저장소가 없다. 링크와 텍스트 공유로 대신한다.
- **팀 링크와 체크리스트 항목을 화면에서 편집**: PR로 고친다.
- **랜딩 분기 테스트에서 실제 랜딩을 띄워 보기**: 브라우저의 UA를 바꿀 수 없고, 어드민 CSP가 iframe을 막는다.

## 9. 실제 기기로 확인할 것

사용자가 한다. 코드만으로는 확정할 수 없다.

| 확인할 것 | 방법 |
|-----------|------|
| UTM이 GA에 잡히는지 | 앱이 없는 Android 기기에서 캠페인 링크를 열어 설치하고 앱을 실행한다. 하루 뒤 GA의 사용자 획득 보고서에서 그 캠페인의 `first_open`을 찾는다. |
| 인앱 경로 | 카카오톡과 인스타그램에서 같은 링크를 열어 `외부 브라우저로 열기`를 거쳐 설치한다. |
| QR | 화면의 QR과 받은 PNG를 휴대폰 카메라로 찍어 같은 링크가 열리는지 본다. |
| 진입 경로별 동작 | Android에서 (1) 카메라로 QR 스캔, (2) 메신저에서 링크를 눌러 Chrome이 열림, (3) 주소 직접 입력. 경로마다 Play 앱이 열렸는지 Play 웹이 열렸는지, 캠페인이 GA에 잡혔는지를 적는다. 사용자 동작 없는 intent 이동은 Play 웹으로 갈 수 있다(§1). |
| 기존 동작 | UTM 없는 랜딩 주소가 전과 같이 동작하는지 본다. |

이 변경은 `main`에 배포돼야 실제 랜딩에서 확인된다. `develop`에 머지한 시점에는 `npm run build && npm run preview`의 주소로 확인한다.

## 10. 테스트

**단위**

- `ua.ts`: `campaignReferrer`(§3 알고리즘의 일곱 단계와 §3의 주소 목록), `playWebUrl`과 `playIntentUrl`(referrer가 없을 때 지금과 같은 문자열), `landingView`(OS와 인앱 조합마다 버튼, 자동 이동, 안내 문구)
- `inlineScript.test.ts`: §3의 경우들
- `localStore`: 깨진 JSON, `parse` 거부, 다른 `v`, 접근 차단, 쓰기 실패와 `persisted`, 접두사 검사, `storage` 이벤트(`key`가 `null`인 것 포함), `update`가 쓰기 직전의 저장 값을 쓰는지, 같은 문자열에 같은 참조
- `useDebouncedPageParam`: 300ms 뒤 쓰기, 바로 쓰기, 한글 조합 중 쓰지 않기, 바깥 변경 때 값과 타이머
- `siteUrls`: `LANDING_URL`이 `index.html`의 `og:url`과 같은지
- `form`: `CopyButton`의 성공과 글상자 대체, `ConfirmButton`의 확인·Escape·포커스 잃음·400ms 안의 누름 무시, 입력의 라벨과 오류 연결
- 캠페인 규칙: 채널 표의 값, 정규화, 형식 검사, 링크 조립과 파라미터 순서, URL 상태에서 되살리기
- QR: 행렬이 정사각형이고 같은 입력에 같은 결과, SVG 문자열에 여백이 들어가는지
- 바로가기: 팀 링크의 id 중복 없음과 모두 `https:`, 내 링크 검사(`javascript:`, `http:`, 빈 이름, 41자), 저장된 값 다시 검사
- 체크리스트: 항목 id 중복 없음, 플랫폼별 보이는 항목, 진행률, 템플릿 변경에 대한 내성, 공유 값 만들기와 풀기(깨진 base64, 다른 버전, 모르는 항목 id, 4,000자 초과), 텍스트 복사 형식

**페이지**

- 캠페인 링크: 채널 선택과 입력으로 링크가 만들어짐, 오류일 때 복사와 QR이 없음, 복사, 최근 기록 저장과 다시 열기와 지우기 확인, URL 상태, 전달 미리보기
- 분기 테스트: 프리셋마다 결과, UA를 고치면 프리셋이 풀림, 잘못된 주소, URL 상태
- 바로가기: 묶음과 타일, 빈 묶음이 숨겨짐, 검색, 내 링크 추가·수정·삭제와 검사 오류, 새 탭 속성
- 체크리스트: 빈 상태에서 만들기, 체크와 진행률, 플랫폼에 따른 구역, 릴리즈 전환, 지우기 확인, 공유 링크로 열기(읽기 전용)와 가져오기, 깨진 공유 링크

**확인 명령**

`npm run typecheck`, `npm test`, `npm run build`가 통과해야 한다. `npm run build && npm run preview`에서 네 화면을 열어 CSP 위반이 없는지 본다. PNG와 SVG 받기는 기존 CSV 받기와 같은 방식이라 CSP에 걸리지 않을 것으로 보지만 브라우저에서 확인한 것은 아니므로 preview에서 직접 눌러 본다. 클립보드는 CSP가 아니라 보안 컨텍스트와 사용자 동작이 조건이다.

## 11. 기반 규칙 점검

| 규칙 | 이 묶음 |
|------|---------|
| 메뉴 `id`가 유일하다 | `utm-builder`, `ua-tester`, `link-hub`, `release-checklist`. 기존 6개, 묶음 2의 `event-stream`, `event-dictionary`와 겹치지 않는다. |
| `order` 예약 범위 | `devtools` 110, 120 / `ops` 110, 120 |
| `load()`에 부수 효과 없음 | 저장소 읽기와 쓰기, 리스너는 모두 컴포넌트와 훅 안에서 한다. |
| URL 상태는 `usePageParam`(글자를 치는 칸은 그것을 감싼 `useDebouncedPageParam`) | `ch`, `src`, `med`, `camp`, `content`, `preset`, `ua`, `touch`, `url`, `release`, `share`. 예약어(`menu`, `period`, `start`, `end`)와 겹치지 않는다. |
| CSS 클래스 접두사 | `adm-utm-builder-`, `adm-ua-tester-`, `adm-link-hub-`, `adm-release-checklist-`, 공용은 `adm-field`, `adm-confirm`, `adm-copy`, `adm-status-region` |
| 고치지 않는 파일 7개 | 고치지 않는다. |
| `localStorage` | 키 3개, 모두 `parfait-admin:` 접두사, UI 상태만. 토큰 없음. |
| 의존성 추가 | `uqr` 하나. 머지할 때 `npm install`로 lockfile을 다시 만든다. |
