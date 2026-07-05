# 뉴스레터 대시보드 회차 중심 재구성 + 이어서/수정 제작 — 설계 문서

- 날짜: 2026-07-05
- 대상 화면: 뉴스레터 제작 탭(목록, `app/(admin)/admin/newsletters/page.tsx`)
- 관련 제작 위저드: `app/(admin)/admin/newsletters/new/configure/page.tsx`

## 1. 배경 / 문제

현재 뉴스레터 목록의 기업 박스를 열면 **리더십 유형 → 회차** 순서로 드릴다운된다. 사용자는 이를 **회차 중심**으로 보고 싶어 하며, 만들어 둔 캠페인을 기반으로 **다음 회차를 이어서 만들거나** 기존 내용을 **수정**할 수 있기를 원한다.

### 현재 데이터 모델의 제약 (조사 결과)
- 저장된 `Newsletter` 1개 = **다회차 캠페인 전체**(스토리라인 1~5회차를 한 번에 생성). 회차를 하나씩 만드는 구조가 아니다.
- 저장 시 **스토리라인 원문·유형 배분(그룹) 설정이 레코드에 남지 않는다.** 제작 후 초안(`configDraft`)이 리셋되며 사라진다.
- 위저드 초기 상태는 전적으로 `configDraft`(sessionStorage, `store/newNewsletterDraftStore.ts`)에서 읽어 온다. → **미리 채워서(시드) 진입시키는 것은 용이**하다.
- `Newsletter.generatedContent`(회차별 본문)는 이미 저장된다.

## 2. 목표 (스코프)

1. 뉴스레터 레코드에 **제작 설정(authoring config)** 저장: `storyline`, `distribution`.
2. 대시보드 기업 박스 내부를 **캠페인 → 회차 → 리더십 유형/그룹** 순으로 재구성.
3. 각 캠페인의 회차 섹션에 **"이어서 만들기"** 와 **"수정하기"** 버튼 제공.
4. 제작 위저드에 **편집 모드**(기존 뉴스레터 id를 들고 저장 시 덮어쓰기) 추가.

### 비목표 (Out of scope)
- 회차를 개별 레코드로 쪼개는 데이터 모델 재설계(Option B)는 하지 않는다.
- "새로 만들기(스토리라인만 복사, 배분 리셋)" 분기는 만들지 않는다. (사용자 요청: 이어서/수정만)
- 발송·미리보기 등 기존 기능의 동작 자체는 바꾸지 않는다(표시 위치만 재배치).

## 3. 설계

### 3.1 데이터 모델 — 제작 설정 저장

`Newsletter`(그리고 DB/Prisma의 대응 모델)에 다음을 추가한다. 둘 다 선택적(JSON) 필드로, 기존 레코드 호환을 위해 nullable.

| 필드 | 타입 | 의미 |
|---|---|---|
| `storyline` | `StorylineStep[]` (JSON) | 스토리라인 단계 원문 (`lib/storyline.ts`의 `StorylineStep`) |
| `distribution` | JSON | 회차별 유형 배분. 재현에 필요한 최소 정보: 회차별 `stepIndex` + `customGroups`(각 그룹의 `types`, 필요 시 `leaderIds`), `roundDistribution`, `totalRounds` |

- 저장 시점: `configure/page.tsx`의 `handleSave` / `handleDraftSave`가 `addNewsletter`/`updateNewsletter` 호출 시 위 값을 함께 전달.
- 저장 소스: 위저드의 현재 `customStoryline`, `rounds`(각 `Round`의 `stepIndex`/`customGroups`), `roundDistribution`, `totalRounds`.
- Prisma: `Newsletter` 모델에 `storyline Json?`, `distribution Json?` 추가 → 마이그레이션. 뉴스레터 API 라우트(`app/api/admin/newsletters/route.ts`, `.../[id]/route.ts`)에서 저장/수정 시 통과.
- `store/newsletterStore.ts`의 `Newsletter` 인터페이스 및 `NewsletterInput`에 두 필드 추가.

### 3.2 대시보드 박스 — 회차 → 유형

`app/(admin)/admin/newsletters/page.tsx`의 기업 박스 드릴다운을 재구성한다.

현재: 기업 → `PolarityGroup`("대상 리더") → `TypeRow`(유형별) → `RoundRow`(회차별).

변경 후: 기업 → **캠페인(뉴스레터)** → **회차(RoundRow, 상위)** → **유형/그룹(TypeRow, 하위)**.

- 한 기업에 캠페인이 여러 개면 캠페인별로 구분해 표시한다(서로 다른 배분이 섞이지 않도록). 캠페인 헤더는 제목/생성일 등으로 구분.
- 회차 행: 회차 번호·스토리라인 단계명(예: "1회차 수용")·진행 상태(제작완료/제작 중)·주제(`generatedContent.rounds[i].generated.headline`)·대상 인원.
- 회차를 펼치면: 그 회차에 배분된 리더십 유형/그룹 목록과 유형별 인원/상태(기존 `TypeRow` 내용을 회차 하위로 이동).
- 기존 기능 유지: 회차별 선택 체크박스(`selectedIds`/`onSelectRound`), 뉴스레터 선택(`selectedNewsletterIds`), 발송(`onSend`), 미리보기(`onPreview`), 회차 저장 토글(`toggleRoundSaved`).
- 데이터 준비: 현재 `companyGroups`(useMemo) 로직을 캠페인→회차→유형 구조를 만들도록 재작성. `buildRoundsFromNL`(회차 배열 생성)은 재사용하되, 각 회차 아래에 그 캠페인의 유형/그룹을 매핑.

### 3.3 "이어서 만들기" / "수정하기"

각 캠페인의 회차 섹션 하단(또는 캠페인 헤더)에 버튼 2개를 둔다.

공통: 클릭 시 `configDraft`(newNewsletterDraftStore)를 시드하고 `/admin/newsletters/new/configure`로 이동. 초안 복구 팝업은 뜨지 않게(예: `localStorage 'newsletter_draft_saved'` 플래그 세팅 또는 시드가 존재하면 억제).

- **이어서 만들기**
  - 시드: 대상 기업(`companyIds`) + 그 캠페인의 `storyline` + `distribution`(유형 배분). 본문(`generatedContent`)은 시드하지 않음 → 새 회차 콘텐츠는 새로 생성.
  - 저장 시: **새 캠페인 생성**(`addNewsletter`).
- **수정하기**
  - 시드: 대상 기업 + `storyline` + `distribution` + **기존 본문 전체**(`generatedContent`) + **편집 대상 뉴스레터 id**.
  - 위저드가 편집 모드로 열려 기존 내용을 그대로 보여주고 편집 가능.
  - 저장 시: **기존 레코드 수정**(`updateNewsletter(id, ...)`), 새로 만들지 않음.

### 3.4 위저드 편집 모드

`configure/page.tsx`:
- `configDraft`에 `editingNewsletterId?: number`(또는 `mode: 'create' | 'continue' | 'edit'`)와 시드된 `generatedContent`를 받을 수 있게 확장.
- 초기화 로직(스토리라인/라운드/배분 읽기)에서 시드 값이 있으면 그대로 로드.
- `handleSave`: `editingNewsletterId`가 있으면 `updateNewsletter(id, {...})`로 덮어쓰기, 없으면 기존대로 `addNewsletter`.
- `storyline`/`distribution`을 저장 payload에 포함(3.1).
- 저장/취소 후 `resetDraft()`로 시드/편집 상태 정리.

## 4. 데이터 플로우 요약

- 제작(신규/이어서): 위저드 → `addNewsletter({..., storyline, distribution, generatedContent})` → DB.
- 수정: 대시보드 "수정하기" → `configDraft` 시드(+id) → 위저드 편집 → `updateNewsletter(id, {..., storyline, distribution, generatedContent})` → DB.
- 대시보드 표시: `newsletters`(스토어) → 기업별 그룹핑 → 캠페인 → `buildRoundsFromNL` → 회차 → 유형.

## 5. 영향 파일

- `prisma/schema.prisma` — `Newsletter`에 `storyline Json?`, `distribution Json?`.
- `app/api/admin/newsletters/route.ts`, `app/api/admin/newsletters/[id]/route.ts` — 두 필드 저장/수정 통과.
- `store/newsletterStore.ts` — 인터페이스/입력 타입에 두 필드 추가.
- `store/newNewsletterDraftStore.ts` — 시드/편집 필드(`editingNewsletterId`, `generatedContent` 등) 추가.
- `app/(admin)/admin/newsletters/page.tsx` — 박스 드릴다운 재구성(회차→유형), "이어서 만들기"/"수정하기" 버튼.
- `app/(admin)/admin/newsletters/new/configure/page.tsx` — 시드 로드, 편집 모드 저장, `storyline`/`distribution` 저장.

## 6. 엣지 케이스 / 결정

- 기존 레코드는 `storyline`/`distribution`이 비어 있음 → "이어서 만들기"/"수정하기" 시 값이 없으면: 회차 수(`totalRounds`)로 기본 스토리라인을 재구성하고, 유형 배분은 참여자 실제 유형으로 자동 그룹(기존 `buildDefaultGroups`/자동그룹 effect 재사용)해서라도 진입 가능하게 한다(빈 값 방어).
- 한 기업 다수 캠페인: 캠페인별로 분리 표시(회차 번호 통합하지 않음).
- 초안 복구 팝업: 시드로 진입한 경우 복구 팝업이 겹치지 않도록 억제.

## 7. 검증

- 타입 체크(`tsc --noEmit`) + 빌드(`npm run build`) 통과.
- 수동 확인(배포 후):
  1. 캠페인 저장 → 대시보드에서 회차→유형 순으로 표시되는지.
  2. "이어서 만들기" → 위저드에 스토리라인+유형배분이 채워지고, 저장 시 새 캠페인이 생기는지.
  3. "수정하기" → 기존 본문이 로드되고, 저장 시 기존 레코드가 덮어써지는지(중복 생성 안 됨).
