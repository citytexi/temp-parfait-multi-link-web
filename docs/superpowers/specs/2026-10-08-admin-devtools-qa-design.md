# 어드민 QA 도구 설계 (묶음 2): 실시간 이벤트 스트림과 이벤트 사전

- 작성일: 2026-10-08
- 브랜치: `feat/admin-devtools-qa`
- 상태: 방향 승인됨, 스펙 확인 전

## 1. 목표

어드민의 `개발자 도구` 그룹에 QA 때 쓰는 화면 두 개를 넣는다.

- **실시간 이벤트 스트림**: 방금 앱에서 쏜 이벤트가 GA에 들어왔는지 바로 확인한다. GA DebugView를 열지 않아도 된다.
- **이벤트 사전**: 이벤트의 뜻과 파라미터를 찾아보고, 정의와 실제 수집이 어긋난 곳을 찾는다.

쓰는 사람은 QA 중인 개발자와 비개발 직군(기획, 디자인, 마케팅)이다.

### 성공 기준

- 페이지 폴더 두 개를 추가하는 것만으로 사이드바, 모바일 메뉴, `⌘K`, URL에 반영된다. 기반의 "고치지 않는 파일" 7개는 고치지 않는다.
- 스트림 화면을 켜 둔 채 잊어도 GA quota가 바닥나지 않는다.
- 앱 팀의 이벤트 정의 문서가 나중에 오면 카탈로그 파일 하나만 채워서 사전이 완성된다.

### 판단 기준

설계 선택은 확장성, 쓰는 사람의 편의, 보기 좋음 순으로 따진다. 구현이 쉬운지는 기준이 아니다.

### 제약

- OAuth scope는 `analytics.readonly` 그대로다. CSP도 그대로다(`analyticsdata.googleapis.com`은 이미 허용돼 있다).
- 서버와 공유 저장소가 없다. 사전을 화면에서 편집해 저장할 수 없다.
- 기존 대시보드 스펙(`2026-09-29-ga-admin-dashboard-design.md`)의 보안 규칙을 지킨다. 토큰은 메모리에만 둔다.
- 메뉴 규칙은 기반 스펙(`2026-10-07-admin-menu-registry-design.md`)을 따른다. `devtools` 그룹의 `order`는 200~290을 쓴다.

### 확인한 사실 (Google 문서, 2026-10-08)

- Realtime API가 지원하는 측정기준: `appVersion`, `eventName`, `minutesAgo`, `platform`, `streamId`, `unifiedScreenName` 등. 측정항목은 `activeUsers`, `eventCount`, `keyEvents`, `screenPageViews`다.
- Realtime API는 이벤트 범위 커스텀 측정기준을 지원하지 않는다. 그래서 스트림에서는 이벤트 파라미터 값을 볼 수 없다.
- Realtime API에는 기기나 사용자 단위 필터가 없다. 여러 명이 동시에 QA하면 이벤트가 섞인다.
- 표준 속성은 최근 30분까지만 조회된다(`startMinutesAgo` 최대 29).
- `runRealtimeReport`도 `returnPropertyQuota`를 받는다. 돌려주는 값은 realtime 한도의 상태다.
- 표준 속성의 realtime 한도: 하루 200,000 토큰, 시간당 40,000 토큰, 프로젝트·속성당 시간당 14,000 토큰, 동시 요청 10개. 일반 조회(core) 한도와는 별도다.
- 요청 한 번의 토큰 비용은 행 수, 측정기준 수, 데이터 양에 따라 달라진다. 문서에 고정 값이 없다.
- `GET properties/{id}/metadata`는 `analytics.readonly`로 호출된다. 속성에 등록한 이벤트 파라미터는 `customEvent:<이름>`으로 나온다.

### 확인하지 못한 것

구현 중 실제 호출로 확인한다(§8).

- 앱이 이벤트를 쏜 뒤 Realtime API에 반영되기까지 걸리는 시간
- 스트림 요청 한 번의 토큰 비용
- 이 속성의 metadata에 `customEvent:` 항목이 실제로 있는지

## 2. 실시간 이벤트 스트림

### 메뉴

| 필드 | 값 |
|------|----|
| `id` | `event-stream` |
| `group` | `devtools` |
| `order` | 210 |
| `label` | 실시간 이벤트 |
| `description` | 방금 들어온 이벤트를 바로 확인해요 |
| `keywords` | `QA`, `디버그`, `debugview`, `realtime`, `스트림` |
| `usesPeriod` | `false` |
| `usesGa` | `true` |

### 조회

갱신 한 번에 `runRealtimeReport` 요청 하나를 보낸다.

- 측정기준: `eventName`, `minutesAgo`, `platform`, `appVersion`
- 측정항목: `eventCount`
- 범위: `minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }]`
- `limit: 10000`, `returnPropertyQuota: true`

플랫폼과 앱 버전을 측정기준으로 함께 받는 이유는, 필터를 바꿀 때 다시 요청하지 않기 위해서다. 받은 행을 화면에서 걸러서 합친다.

응답의 `rowCount`가 받은 행 수보다 크면 일부가 잘린 것이다. 이때 표 아래에 "이벤트가 많아서 일부만 보여요"라고 알린다.

### 화면

```
┌──────────────────────────────────────────────────────────────┐
│ 실시간 이벤트                                                 │
│ 방금 들어온 이벤트를 바로 확인해요                              │
│                                                              │
│ ● 5초마다 갱신 중 · 마지막 갱신 14:02:31   [일시정지] [지금 새로고침] │
│                                                              │
│ [이벤트 이름 검색      ]  플랫폼 [전체▾]  앱 버전 [전체▾]         │
│                                                              │
│ ┌ 최근 30분 이벤트 ──────────────────────────────────────────┐ │
│ │ ☆ 이벤트              방금   5분   30분   30분 추이          │ │
│ │ ★ 화면 조회            3     12    140   ▁▂▅▃▁▂▇           │ │
│ │   screen_view  ▲ +3                                       │ │
│ │ ☆ purchase_done [새로 들어옴] [사전에 없음]                   │ │
│ │                       1      1      1    ▁▁▁▁▁▁▇           │ │
│ └──────────────────────────────────────────────────────────┘ │
│ 여러 사람이 함께 쓰면 이벤트가 섞여 보여요. 플랫폼과 앱 버전으로    │
│ 좁혀 보세요.                                                  │
└──────────────────────────────────────────────────────────────┘
```

**상태 줄**

- 지금 주기와, 느려졌거나 멈췄다면 그 이유를 한 문장으로 보여 준다(§2 주기 정책의 표).
- 마지막 갱신 시각은 서울 시간 `HH:mm:ss`로 쓴다.
- `일시정지`를 누르면 자동 갱신이 멈추고 버튼이 `다시 시작`으로 바뀐다. 표를 고정해 놓고 읽을 때 쓴다.
- `지금 새로고침`은 일시정지 중에도 한 번 조회한다.

**필터**

- 이벤트 이름 검색: 원래 이름과 한글 라벨 둘 다에서 찾는다. 대소문자를 가리지 않는다.
- 플랫폼, 앱 버전: 최근 30분 응답에 나온 값만 고를 수 있다. URL에 있는 값이 응답에 없으면 그 값을 선택된 상태로 목록에 남겨 둔다. 그래야 링크로 받은 필터가 조용히 풀리지 않는다.
- 값이 `(not set)`이거나 비어 있으면 `알 수 없음`으로 보여 준다(`displayDim`).

**표**

| 열 | 내용 |
|----|------|
| 지켜보기 | 별 모양 토글 버튼. 켠 이벤트는 표 맨 위에 고정된다. |
| 이벤트 | 카탈로그에 있으면 한글 라벨을 크게, 원래 이름을 작게 쓴다. 없으면 원래 이름과 `사전에 없음` 태그를 쓴다. |
| 방금 | `minutesAgo`가 0인 횟수. 지금 진행 중인 1분이다. |
| 5분 | `minutesAgo` 0~4의 합 |
| 30분 | 전체 합 |
| 30분 추이 | 1분 단위 막대 30개. 장식이므로 `aria-hidden`이다. 값은 숫자 열이 전한다. |

- 정렬: 지켜보는 이벤트가 먼저, 그 안에서와 나머지는 30분 합계가 큰 순서다. 같으면 이름 순이다. 갱신마다 행이 뛰어다니지 않도록 `방금` 값으로는 정렬하지 않는다.
- 지켜보는 이벤트가 최근 30분에 한 번도 없으면 0으로 채운 행을 보여 준다. "아직 안 들어옴"을 확인하는 것이 QA의 목적이기 때문이다.

**변화 강조**

직전 갱신과 비교해서 표시한다. 색만으로 전하지 않는다.

- 직전에 없던 이벤트: `새로 들어옴` 태그
- `5분` 값이 직전 갱신보다 늘어난 이벤트: `▲ +n` 텍스트. `n`은 늘어난 횟수다. 줄어든 것은 표시하지 않는다. 시간이 지나 오래된 1분이 창에서 빠진 것일 뿐이기 때문이다.
- 한계: 새 이벤트가 들어온 바로 그 갱신에서 5분 전의 이벤트가 같은 수만큼 창에서 빠지면 `▲`가 뜨지 않는다. 숫자 열은 맞게 나온다.
- 강조는 다음 갱신에서 변화가 없으면 사라진다. 일시정지 중에는 그대로 남는다.
- 첫 조회에는 비교 대상이 없으므로 강조하지 않는다.
- 지켜보는 이벤트에 변화가 있을 때만 `aria-live="polite"` 영역에 "화면 조회 3번 더 들어왔어요"처럼 알린다. 모든 변화를 읽어 주면 5초마다 말이 끊기지 않는다.
- 배경 강조 애니메이션은 `prefers-reduced-motion`에서 끈다.

**사전으로 가기**

`사전에 없음` 태그 옆에 `사전에서 보기` 버튼을 둔다. `useNav().setMenu('event-dictionary')`로 이동한다. 기반의 한계로, 그 이벤트가 선택된 상태로 열리지는 않는다(§7).

### URL 상태

`usePageParam`으로 둔다. 이 URL을 팀원에게 넘기면 같은 필터로 열린다.

| key | 값 | 예 |
|-----|----|----|
| `q` | 검색어 | `q=purchase` |
| `platform` | 플랫폼 값 | `platform=iOS` |
| `ver` | 앱 버전 값 | `ver=1.4.0` |
| `watch` | 지켜보는 이벤트 이름을 쉼표로 이은 값 | `watch=screen_view,purchase_done` |

일시정지 여부는 URL에 두지 않는다. 링크를 받은 사람의 화면이 멈춘 채로 열리면 고장으로 보인다.

### 주기 정책

다음 갱신까지의 시간을 정하는 순수 함수 하나로 둔다.

```ts
type PollInput = {
  quota: RealtimeQuota | null   // 직전 응답의 realtime 한도 상태. 첫 조회 전에는 null
  visible: boolean              // 탭이 보이는지
  paused: boolean               // 사용자가 일시정지했는지
  idleMs: number                // 마지막 조작 뒤로 지난 시간
  failures: number              // 연속 실패 횟수
  quotaExhausted: boolean       // 직전 오류가 quota 오류인지
}
type PollDecision = { intervalMs: number | null; reason: PollReason }
function decidePoll(input: PollInput): PollDecision
```

`intervalMs`가 `null`이면 자동 갱신을 멈춘다. 위에서부터 먼저 맞는 규칙을 쓴다.

| 조건 | 주기 | 상태 줄 문구 |
|------|------|--------------|
| 일시정지 | 멈춤 | 일시정지했어요 |
| 탭이 가려짐 | 멈춤 | (보이지 않음) |
| quota 오류를 받음 | 멈춤 | 조회 한도를 다 써서 자동 갱신을 멈췄어요. 한 시간쯤 뒤에 다시 시도해 주세요. |
| 남은 quota 5% 미만 | 멈춤 | 조회 한도가 거의 남지 않아서 자동 갱신을 멈췄어요 |
| 연속 실패 1회 이상 | 기본 주기 × 2^실패 횟수, 최대 60초 | 불러오지 못해서 다시 시도하고 있어요 |
| 남은 quota 20% 미만 | 60초 | 조회 한도가 얼마 남지 않아서 1분마다 갱신해요 |
| 10분 넘게 조작 없음 | 60초 | 한동안 조작이 없어서 1분마다 갱신해요 |
| 남은 quota 50% 미만 | 15초 | 조회 한도를 아끼려고 15초마다 갱신해요 |
| 그 밖 | 5초 | 5초마다 갱신 중 |

- **남은 quota**는 `tokensPerHour`, `tokensPerProjectPerHour`, `tokensPerDay` 각각의 `remaining / (consumed + remaining)` 중 가장 작은 값이다. 응답에 없는 항목은 건너뛴다. 셋 다 없으면 100%로 본다.
- **조작**은 이 페이지 안의 포인터, 키보드, 스크롤 입력이다. 조작이 다시 생기면 다음 갱신부터 원래 주기로 돌아온다.
- 탭이 다시 보이면 바로 한 번 조회한다.
- 멈춘 상태에서도 `지금 새로고침`은 동작한다. quota 오류 뒤에 누르면 다시 조회하고, 성공하면 자동 갱신이 다시 시작된다.
- 주기와 기준 값은 모두 페이지 폴더의 `config.ts`에 상수로 둔다. §8의 측정 결과로 조정한다.

시간당 한도는 한 시간마다 회복되므로, 느려진 주기는 사람이 손대지 않아도 원래대로 돌아온다.

### 상태별 화면

- 첫 조회 중: 카드 안 스켈레톤(`CardState`)
- 최근 30분에 이벤트가 없음: "최근 30분 동안 들어온 이벤트가 없어요. 앱에서 이벤트를 보내면 여기에 나타나요."
- 필터 결과가 없음: "조건에 맞는 이벤트가 없어요"와 `필터 지우기` 버튼
- 첫 조회 실패: `CardState`의 오류 화면과 `다시 시도`
- 갱신 실패: 마지막으로 받은 표를 그대로 두고 상태 줄에만 알린다.

## 3. 이벤트 사전

### 메뉴

| 필드 | 값 |
|------|----|
| `id` | `event-dictionary` |
| `group` | `devtools` |
| `order` | 220 |
| `label` | 이벤트 사전 |
| `description` | 이벤트의 뜻과 파라미터를 찾아봐요 |
| `keywords` | `이벤트`, `파라미터`, `정의`, `미등록`, `dictionary` |
| `usesPeriod` | `true` |
| `usesGa` | `true` |

기간 필터를 쓰는 이유는 "이 기간에 들어왔는가"가 사전의 핵심 판정이기 때문이다.

### 원본 세 가지

| 원본 | 주는 것 | 어디서 |
|------|---------|--------|
| 카탈로그 | 이벤트 이름, 한글 라벨, 설명, 파라미터, 구분, 대상 플랫폼 | 레포 파일 `src/admin/ga/eventCatalog.ts` (§4) |
| GA 관측 | 고른 기간에 실제로 들어온 이벤트, 횟수, 사람 수, 플랫폼별 횟수 | `runReport` |
| GA metadata | 속성에 커스텀 측정기준으로 등록된 이벤트 파라미터 | `GET metadata` |

GA 관측 요청은 하나다.

- 측정기준: `eventName`, `platform`
- 측정항목: `eventCount`, `totalUsers`
- 기간: 현재 기간 하나(직전 기간과 비교하지 않는다)
- `limit: 10000`

metadata는 기간과 무관하므로 따로 조회하고, 세션 동안 다시 받지 않는다.

### 이벤트 상태

카탈로그와 GA 관측을 이벤트 이름으로 합친 뒤 상태를 하나 매긴다. 위에서부터 먼저 맞는 것을 쓴다.

| 상태 | 조건 | 뜻 |
|------|------|-----|
| 사전에 없음 | GA에 들어왔는데 카탈로그에 없다 | 정의 없이 수집되고 있다. 오타이거나 문서에서 빠진 이벤트다. |
| 안 들어옴 | 카탈로그에 앱 정의 이벤트로 있는데 기간 안에 0건이다 | 구현이 빠졌거나 이름이 다르다. |
| 일부 플랫폼만 | 카탈로그의 대상 플랫폼 중 0건인 플랫폼이 있다 | 한쪽 플랫폼 구현이 빠졌다. |
| 설명 없음 | 카탈로그에 있지만 설명이 비어 있다 | 문서를 채워야 한다. |
| 정상 | 그 밖 | |

- 자동 수집 이벤트(`kind: 'auto'`)는 `안 들어옴`과 `일부 플랫폼만`으로 판정하지 않는다. 앱 팀이 구현하는 이벤트가 아니고, `app_remove`처럼 한 플랫폼에서만 오는 것이 정상인 이벤트가 있다.
- GA 관측 조회가 아직 끝나지 않았거나 실패했으면 `안 들어옴`과 `일부 플랫폼만`은 판정하지 않는다. 받지 못한 것을 0건으로 읽으면 전부 문제로 보인다.

### 화면

```
┌──────────────────────────────────────────────────────────────┐
│ 이벤트 사전                                    [기간 필터]     │
│ 이벤트의 뜻과 파라미터를 찾아봐요                               │
│                                                              │
│ [전체 24] [사전에 없음 3] [안 들어옴 1] [일부 플랫폼만 0] [설명 없음 5] │
│ [이벤트 이름이나 설명 검색          ]                [CSV 받기] │
│                                                              │
│ ┌ 이벤트 ───────────────────────────────────────────────────┐ │
│ │ ▸ 화면 조회  screen_view      자동 수집   12,340번  정상     │ │
│ │ ▾ purchase_done               —          41번  사전에 없음  │ │
│ │   ┌───────────────────────────────────────────────────┐   │ │
│ │   │ 이 이벤트는 사전에 없어요.                           │   │ │
│ │   │ 플랫폼별: Android 30번 · iOS 11번                   │   │ │
│ │   │ [카탈로그 항목 복사]                                 │   │ │
│ │   └───────────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌ GA에 등록된 파라미터 ──────────────────────────────────────┐ │
│ │ item_id   "상품 ID"   customEvent:item_id                  │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**상태 버튼**

- 상태별 개수를 보여 주고, 누르면 그 상태만 거른다. 하나만 고를 수 있고 `전체`가 기본이다.
- `aria-pressed`를 쓰는 토글 버튼 묶음이다. 개수가 0인 버튼도 자리를 지킨다. 버튼이 사라지면 문제가 없다는 사실이 보이지 않는다.

**검색**

이벤트 이름, 한글 라벨, 설명, 파라미터 이름에서 찾는다.

**이벤트 표**

| 열 | 내용 |
|----|------|
| 이벤트 | 펼치기 버튼, 한글 라벨, 원래 이름 |
| 구분 | `자동 수집`, `앱 정의`. 카탈로그에 없으면 `—` |
| 횟수 | 기간 안의 `eventCount`. 조회 전이면 스켈레톤 |
| 상태 | 상태 태그. 정상은 태그 없이 `정상` 텍스트 |

- 정렬: 문제가 있는 상태(사전에 없음, 안 들어옴, 일부 플랫폼만, 설명 없음)가 먼저, 그 안에서는 횟수가 큰 순서, 같으면 이름 순이다.
- 행 전체가 아니라 펼치기 버튼이 `aria-expanded`와 `aria-controls`를 가진다.

**펼친 내용**

- 설명. 비어 있으면 "아직 설명이 없어요"
- 파라미터 표: 이름, 타입, 설명. 파라미터가 GA metadata에 `customEvent:<이름>`으로 있으면 `GA 등록됨` 태그를 붙인다. 등록되지 않은 파라미터는 GA 보고서에서 조회할 수 없다는 뜻이다.
- 플랫폼별 횟수와 사람 수
- `사전에 없음`인 이벤트에는 `카탈로그 항목 복사` 버튼을 둔다. 누르면 `eventCatalog.ts`에 붙여 넣을 항목을 클립보드에 넣고, 버튼 글자가 2초 동안 `복사했어요`로 바뀐다. 클립보드를 쓸 수 없으면 코드를 선택할 수 있는 글상자로 보여 준다.

복사되는 코드:

```ts
{ name: 'purchase_done', label: '', description: '', kind: 'app', params: [] },
```

**GA에 등록된 파라미터 카드**

metadata의 `customEvent:` 항목을 표로 보여 준다. 열은 파라미터 이름, GA에 적힌 표시 이름, 설명이다. GA는 어떤 파라미터가 어떤 이벤트에 속하는지 알려 주지 않으므로 이벤트 표와 따로 둔다. 카탈로그의 어느 이벤트에도 없는 파라미터에는 `사전에 없음` 태그를 붙인다.

**CSV**

지금 걸러진 이벤트를 내보낸다. 열은 이벤트 이름, 한글 라벨, 구분, 상태, 횟수, 사람 수, 설명, 파라미터(이름을 쉼표로 이음)다. 파일 이름은 `parfait-event-dictionary-<시작일>_<종료일>.csv`다.

### URL 상태

| key | 값 | 예 |
|-----|----|----|
| `q` | 검색어 | `q=purchase` |
| `status` | `unknown`, `missing`, `partial`, `undocumented` | `status=unknown` |
| `event` | 펼친 이벤트 이름 하나 | `event=purchase_done` |

`event`를 URL에 두므로 "이 이벤트 좀 봐줘"를 링크로 보낼 수 있다. 한 번에 하나만 펼친다. `event`가 가리키는 이벤트가 지금 필터에 걸러졌으면 필터보다 `event`를 우선해서 그 행을 목록 맨 위에 보여 준다.

### 상태별 화면

- GA 관측 조회 중: 카탈로그 내용은 바로 보여 주고 횟수 열만 스켈레톤이다. 카탈로그는 번들에 있어서 기다릴 것이 없다.
- GA 관측 실패: 카탈로그 내용은 그대로 두고, 표 위에 "수집 현황을 불러오지 못했어요"와 `다시 시도`를 보여 준다.
- metadata 실패: `GA에 등록된 파라미터` 카드에만 오류를 보여 준다. 파라미터의 `GA 등록됨` 태그는 붙이지 않는다.
- 필터 결과 없음: "조건에 맞는 이벤트가 없어요"와 `필터 지우기`

## 4. 이벤트 카탈로그

`src/admin/ga/eventCatalog.ts`를 새로 만든다. 사전, 스트림, 기존 `많이 한 행동` 화면이 모두 이 파일을 읽는다.

```ts
export type EventParam = {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
}

export type CatalogEvent = {
  name: string
  /** 화면에 쓰는 한글 이름. 비어 있으면 원래 이름을 쓴다. */
  label: string
  description: string
  /** auto: Firebase가 자동으로 수집한다. app: 앱 팀이 구현한다. */
  kind: 'auto' | 'app'
  params: readonly EventParam[]
  /** 이 이벤트를 보내야 하는 플랫폼. 생략하면 모든 플랫폼이다. */
  platforms?: readonly ('Android' | 'iOS')[]
}

export const EVENT_CATALOG: readonly CatalogEvent[]
export function findEvent(name: string): CatalogEvent | undefined
```

- 지금 `eventLabels.ts`에 있는 자동 수집 이벤트 10개를 `kind: 'auto'`로 옮긴다. 설명은 Firebase 문서의 뜻을 해요체로 한 줄씩 쓴다.
- 앱 정의 이벤트는 비워 둔다. 앱 팀의 정의 문서가 오면 이 파일에 옮겨 적는다. 그때까지 앱 이벤트는 사전에서 `사전에 없음`으로 보인다. 의도한 동작이다.
- `platforms`의 값은 GA `platform` 측정기준의 값과 같은 문자열을 쓴다.
- `eventLabels.ts`의 `eventLabel(name)`은 시그니처를 그대로 두고 카탈로그를 읽도록 바꾼다. `label`이 비어 있는 항목은 등록되지 않은 것으로 돌려준다. `많이 한 행동` 화면은 손대지 않는다.

테스트로 지키는 규칙: 이벤트 이름이 중복되지 않는다. 한 이벤트 안에서 파라미터 이름이 중복되지 않는다. 이름은 GA 규칙(영문자로 시작, 영문자·숫자·밑줄, 40자 이하)을 지킨다.

## 5. 공용 코드 변경

고치는 공용 파일은 아래뿐이다. 기반의 "고치지 않는 파일" 7개에 들지 않고, 묶음 1은 GA를 쓰지 않으므로 겹치지 않는다.

### `src/admin/ga/types.ts`

- `RunRealtimeReportRequest`에 `returnPropertyQuota?: boolean`을 넣는다.
- `PropertyQuota`에 `tokensPerHour`, `tokensPerProjectPerHour`, `concurrentRequests`, `serverErrorsPerProjectPerHour`를 선택 필드로 넣는다. 모양은 `tokensPerDay`와 같다.
- `Metadata`, `DimensionMetadata` 타입을 넣는다. 필요한 필드는 `apiName`, `uiName`, `description`, `customDefinition`이다.

### `src/admin/ga/client.ts`

- `runRealtimeReport`가 `returnPropertyQuota: true`를 붙여 보낸다. 응답의 `propertyQuota`는 호출한 쪽이 읽는다.
- realtime 응답의 quota로는 `onQuota`를 부르지 않는다. `onQuota`는 푸터의 "오늘 조회 가능량"을 채우는데, 그 숫자는 일반 조회 한도다. realtime 한도를 섞으면 숫자가 두 한도 사이를 오간다.
- `getMetadata()`를 넣는다. `GET {BASE_URL}/{propertyId}/metadata`를 부른다. 토큰 확인, 네트워크 오류, 오류 응답 분류는 `post`와 같은 코드를 쓴다.

기존 `지금 접속 중`과 `한눈에 보기`의 realtime 호출은 요청에 필드 하나가 늘 뿐 동작이 같다.

### `src/admin/ga/eventLabels.ts`

§4대로 카탈로그를 읽게 바꾼다.

### 고치지 않는 것

- `src/admin/hooks/useReports.ts`: 새 훅은 각 페이지 폴더에 둔다. 묶음마다 이 파일에 훅을 더하면 병렬 작업끼리 겹친다.
- `src/admin/components/DataTable.tsx`: 두 화면의 표는 행 강조, 펼치기, 행 고정이 필요해서 `DataTable`의 모양(셀 값만 받음)에 맞지 않는다. 각 페이지 폴더에 표 컴포넌트를 두고, 모양은 기존 `adm-table` 클래스를 그대로 써서 맞춘다.

## 6. 파일 구조

```
src/admin/ga/
  eventCatalog.ts            카탈로그와 findEvent (신규)
  eventCatalog.test.ts
  eventLabels.ts             카탈로그를 읽게 수정
  client.ts, types.ts        §5

src/admin/pages/devtools/event-stream/
  EventStreamPage.menu.ts
  EventStreamPage.tsx        화면 조립
  EventStreamPage.test.tsx
  event-stream.css           클래스는 adm-event-stream- 로 시작
  config.ts                  주기와 quota 기준 상수
  report.ts                  요청 생성, 응답 파싱, 필터 적용, 직전 갱신과 비교
  report.test.ts
  pollPolicy.ts              decidePoll
  pollPolicy.test.ts
  useEventStream.ts          조회와 주기 정책을 잇는 훅
  StreamStatus.tsx           상태 줄
  StreamTable.tsx            표와 추이 막대
  __fixtures__/

src/admin/pages/devtools/event-dictionary/
  EventDictionaryPage.menu.ts
  EventDictionaryPage.tsx
  EventDictionaryPage.test.tsx
  event-dictionary.css       클래스는 adm-event-dictionary- 로 시작
  report.ts                  GA 관측 요청과 파싱, metadata 파싱
  report.test.ts
  dictionary.ts              카탈로그와 관측을 합치고 상태를 매김
  dictionary.test.ts
  useEventDictionary.ts
  DictionaryTable.tsx        표와 펼친 내용
  __fixtures__/
```

각 단위가 하는 일:

- `report.ts`: GA 응답을 화면이 쓰는 모양으로 바꾼다. React를 모른다.
- `pollPolicy.ts`, `dictionary.ts`: 판정 규칙이다. 입력과 출력만 있는 순수 함수라서 표 전체를 테스트로 덮는다.
- `use*.ts`: react-query와 위 함수들을 잇는다.
- `*Page.tsx`: URL 상태를 읽고 컴포넌트를 조립한다.

색은 `src/admin/styles/tokens.css`의 토큰만 쓴다. 문구는 해요체다. 디자인 기준은 `design-system/parfait-admin/pages/dashboard.md`를 따른다.

## 7. 이번에 하지 않는 것

- **사전을 특정 이벤트가 선택된 채로 열기**: 스트림에서 `사전에서 보기`를 눌러도 그 이벤트가 펼쳐지지 않는다. 메뉴를 바꾸면 페이지 파라미터가 지워지고, 이를 바꾸려면 `src/admin/lib/urlState.ts`와 `NavContext`를 고쳐야 한다. 기반 후속 작업으로 넘긴다. 필요한 것은 `setMenu(id, params)` 형태다.
- **화면에서 사전 편집**: 저장할 곳이 없다. `카탈로그 항목 복사`와 PR로 대신한다.
- **스트림에서 파라미터 값 보기**: Realtime API가 지원하지 않는다.
- **기기 단위 필터**: Realtime API가 지원하지 않는다.
- **앱 정의 이벤트 채우기**: 앱 팀의 정의 문서가 온 뒤에 한다.

## 8. 실제 호출로 확인할 것

토큰이 브라우저 메모리에만 있어서 명령줄에서는 확인할 수 없다. 스트림 화면의 조회가 붙은 뒤, 사용자가 `npm run dev`로 화면을 열어서 확인한다.

이를 위해 스트림 화면은 개발 모드(`import.meta.env.DEV`)에서만 상태 줄 아래에 진단 한 줄을 보여 준다. 내용은 직전 요청이 쓴 토큰 수, 세 한도의 남은 양, 받은 행 수다. 빌드 결과에는 들어가지 않는다.

| 확인할 것 | 방법 | 결과에 따라 바꾸는 것 |
|-----------|------|------------------------|
| 반영 지연 | 앱에서 이벤트를 보내고 화면에 나타날 때까지 잰다 | 지연이 10초를 넘으면 기본 주기를 그 값에 맞춘다. 5초마다 물어도 새 데이터가 없기 때문이다. |
| 요청당 토큰 비용 | 진단 줄의 값을 읽는다 | 기본 주기로 한 시간 쓴 양이 14,000 토큰의 절반을 넘으면 기본 주기를 늦춘다. 그래도 넘으면 `appVersion` 측정기준을 빼고 앱 버전 필터를 없앤다. |
| metadata | 사전 화면의 파라미터 카드를 본다 | `customEvent:` 항목이 하나도 없으면 카드에 "GA에 등록된 파라미터가 없어요"를 보여 준다. |

확인한 값과 그에 따라 정한 상수는 이 문서의 이 장에 적는다.

## 9. 테스트

**단위**

- `eventCatalog`: §4의 규칙, `findEvent`, `eventLabel`의 기존 동작
- `client`: realtime 요청에 `returnPropertyQuota`가 붙는지, realtime quota로 `onQuota`를 부르지 않는지, `getMetadata`의 URL과 오류 분류
- 스트림 `report`: 요청 모양, fixture 파싱, 필터별 합계, `방금`/`5분`/`30분` 계산, 추이 30칸 채우기, 직전 갱신과의 비교, 잘림 판정
- `pollPolicy`: §2 표의 모든 줄과 줄 사이의 우선순위, 남은 quota 계산(항목이 빠진 경우 포함)
- 사전 `report`: 요청 모양, fixture 파싱, metadata에서 `customEvent:`만 고르기
- `dictionary`: §3 상태 표의 모든 줄, 자동 수집 예외, 관측이 없을 때 판정하지 않는 것, 정렬

**페이지**

- 스트림: 검색과 필터, 지켜보기 고정과 0건 행, 강조 표시와 사라짐, 일시정지와 다시 시작, 가짜 타이머로 주기 확인, URL 파라미터 읽고 쓰기, 빈 상태와 오류 상태, 갱신 실패 때 표가 남는지
- 사전: 상태 버튼과 개수, 검색, 펼치기와 `event` 파라미터, 복사 버튼, CSV 내용, 관측 실패 때 카탈로그가 남는지, metadata 실패가 카드에만 보이는지

**확인 명령**

`npm run typecheck`, `npm test`, `npm run build`가 모두 통과해야 한다. 외부 주소를 새로 쓰지 않으므로 CSP 조각은 없다. 그래도 `npm run build && npm run preview`에서 두 화면을 열어 CSP 위반이 없는지 본다.

## 10. 기반 규칙 점검

| 규칙 | 이 묶음 |
|------|---------|
| 메뉴 `id`가 유일하다 | `event-stream`, `event-dictionary`. 기존 6개와 겹치지 않는다. 다른 묶음 스펙은 아직 없다. |
| `order` 예약 범위 | 210, 220 (`devtools` 200~290) |
| `load()`에 부수 효과 없음 | 타이머, 리스너, 요청은 모두 컴포넌트와 훅 안에서 시작한다. |
| URL 상태는 `usePageParam` | `q`, `platform`, `ver`, `watch`, `status`, `event`. 예약어와 겹치지 않는다. |
| 고치지 않는 파일 7개 | 고치지 않는다. |
| 의존성 추가 | 없다. |
