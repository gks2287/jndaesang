# 그룹 설정 단계 — AI 그룹 설명 기능 설계

작성일: 2026-07-06

## 배경 / 목적

뉴스레터 제작 마법사의 **4단계 "그룹 설정"**에서 관리자는 리더십 유형을 그룹으로 묶는다.
각 그룹에 대해 AI가 **그룹 설명(요약·특성·개발포인트)** 을 도출하고, 관리자가 이를 수정/보완할 수 있게 한다.

- 그룹 설명은 **기업 추가 시 학습한 리더십 유형별 정보**(`leadershipInfoStore`의 `{ type, definition, characteristics, developmentPoints }`)를 근거로 도출한다.
- 이 설명은 **5단계 콘텐츠 구성**에서 맞춤형 본문 생성 시 프롬프트 입력으로 반영되어, 그룹 특성에 맞춘 콘텐츠를 만드는 기준이 된다.
- AI 도출은 그룹을 묶는 즉시가 아니라 **버튼 클릭 시에만** 실행한다.

## 사용자 결정 사항

- 설명 항목: **요약 + 특성 + 개발포인트** (3개)
- 버튼 방식: **상단 일괄 생성 버튼 1개** (모든 그룹 한 번에 도출)
- 저장/적용 범위: **유형 구성이 같으면 회차와 무관하게 공유**
- 범위: 저장뿐 아니라 **뉴스레터 생성 API 반영까지 포함**
- UI: **접이식 패널** (각 그룹 카드 하단, 기본 접힘)

## 데이터 모델

### 신규 타입 (`lib/content.ts`)
```ts
export interface GroupDescription {
  summary: string;           // 그룹 한줄 요약/정의
  characteristics: string;   // 그룹 특성
  developmentPoints: string; // 개발 포인트(코칭 방향)
}

// 유형 구성 → 설명 매핑 키. 유형 배열을 정렬·조인하여 회차 무관 공유.
export function groupCompositionKey(types: string[]): string {
  return [...types].filter(Boolean).sort().join('|');
}
```

### 드래프트 스토어 (`store/newNewsletterDraftStore.ts`)
- `NewNewsletterDraft`에 `groupDescriptions: Record<string, GroupDescription>` 추가
- `DEFAULT_DRAFT`에 `groupDescriptions: {}` 추가
- sessionStorage(persist)에 기존 draft와 함께 유지 → 5단계까지 세션 내 유지
- 기존 드래프트 호환: 로드 시 `groupDescriptions`가 없으면 `{}`로 취급

키는 `groupCompositionKey(group.types)`. `types`가 빈 그룹은 대상에서 제외한다.

## AI 도출 엔드포인트 (신규)

`POST /api/admin/leadership-info/group-describe`

### 입력
```ts
{
  companyName: string;
  groups: Array<{
    key: string;                 // groupCompositionKey 결과
    types: string[];             // 그룹 구성 유형
    typeInfos: Array<{ type: string; definition?: string; characteristics?: string; developmentPoints?: string }>;
  }>;
}
```
- `typeInfos`는 클라이언트가 `companyLeadershipInfo`(leadershipInfoStore)에서 그룹의 `types`에 해당하는 항목만 필터링해 전달.

### 처리
- `callClaude(prompt, systemPrompt)` + `safeParseJson` 사용 (기존 `leadership-info/extract` 패턴 준수).
- 시스템/프롬프트 규칙:
  - 각 그룹의 구성 유형 정보를 **종합**해 그룹 단위 `{summary, characteristics, developmentPoints}` 도출.
  - **학습된 정보에 근거한 내용만** 사용, 없는 내용 지어내기 금지.
  - 단일 유형 그룹이면 해당 유형 정보를 그룹 관점으로 정리, 복수 유형이면 공통 주제로 종합.
  - 유형명 워딩 임의 변경 금지.
- 모든 그룹을 한 번의 요청으로 처리(일괄). 그룹 수가 많아도 단일 호출로 응답.

### 출력
```ts
{ descriptions: Record<string /* key */, GroupDescription> }
```

## UI — 4단계 "그룹 설정" (`app/(admin)/admin/newsletters/new/configure/page.tsx`)

### 상단 일괄 생성 버튼
- 위치: 회차 탭 우측 영역, 기존 `전 회차 동일하게` 버튼 옆에 `AI로 그룹 설명 생성` 버튼 추가.
- 동작:
  1. 전 회차(`rounds`)의 모든 `customGroups` 중 `types.length > 0`인 그룹의 구성을 수집, `groupCompositionKey`로 **중복 제거**.
  2. 각 구성에 대해 `companyLeadershipInfo`에서 유형 정보를 모아 엔드포인트 호출(일괄).
  3. 응답을 `groupDescriptions`에 병합 저장(setDraft).
  4. 로딩 상태 표시(버튼 스피너/비활성). 실패 시 에러 안내.
- 도출 대상 그룹이 0개면 버튼 비활성 + 안내.

### 그룹 카드 접이식 설명 패널
- 각 그룹 카드 하단에 `그룹 설명` 접이식 섹션 추가(기본 **접힘**).
- 토글 헤더: `그룹 설명` 라벨 + 펼침/접힘 chevron. 생성된 경우 요약 일부를 미리보기로 표시.
- 펼치면 3개 편집 영역(요약/특성/개발포인트, textarea) 노출.
  - 값 = `groupDescriptions[groupCompositionKey(group.types)]` (없으면 빈 값).
  - 편집 시 해당 key의 `GroupDescription` 갱신 → **같은 구성의 다른 회차 그룹에도 자동 반영**.
- 아직 생성 전(해당 key 없음): "상단 `AI로 그룹 설명 생성`을 눌러 초안을 만드세요" 안내 표시, 편집 영역은 빈 상태로 수동 입력도 가능.
- 그룹 구성 변경(드래그로 유형 이동) 시 key가 바뀌어 설명이 비어 보일 수 있음 → 재생성으로 해결(정상 동작). 이전 key의 설명은 남아도 무해.

### 상태 관리
- 접힘/펼침 상태: 컴포넌트 로컬 `useState<Set<string>>` (그룹 id 기준). 기존 `collapsedSections` 패턴 재사용 가능하나 별도 상태로 분리해 혼선 방지.
- 생성 로딩: 로컬 boolean state.

## 생성 연동 — 5단계 콘텐츠 구성

### 클라이언트 (`generateLivePreview`)
- 맞춤형 그룹(`isCustom && group.types.length > 0`) 생성 시 요청 바디에 추가:
  ```ts
  groupDescription: groupDescriptions[groupCompositionKey(group.types)] // 없으면 생략/undefined
  ```

### 서버 (`app/api/newsletter/generate/route.ts`)
- 요청 타입에 `groupDescription?: { summary?: string; characteristics?: string; developmentPoints?: string }` 추가.
- 값이 있으면 프롬프트에 블록 주입(기존 `infoBlock` 인접):
  ```
  [이 그룹의 리더십 정의 — 본문 방향의 기준]
  · 요약: ...
  · 특성: ...
  · 개발 포인트: ...
  (이 그룹 정의를 본문 톤·문제 인식·실천 처방의 기준으로 삼되, 없는 내용은 지어내지 마세요.)
  ```
- 기존 per-type `leadershipInfo` 블록과 병행(중복 시 그룹 정의가 상위 방향 기준).

## 영향 범위 / 파일

- `lib/content.ts` — `GroupDescription` 타입, `groupCompositionKey` 헬퍼
- `store/newNewsletterDraftStore.ts` — `groupDescriptions` 필드
- `app/api/admin/leadership-info/group-describe/route.ts` — 신규 엔드포인트
- `app/(admin)/admin/newsletters/new/configure/page.tsx` — 상단 버튼, 그룹 카드 접이식 패널, 편집 핸들러, `generateLivePreview` 페이로드
- `app/api/newsletter/generate/route.ts` — `groupDescription` 입력 + 프롬프트 블록

## 비범위 (YAGNI)

- 그룹 설명의 DB 영구 저장(캠페인 저장소): 현재 그룹 구성이 sessionStorage 드래프트로만 유지되므로 동일하게 세션 범위로 한정. DB 영구화는 별도 작업.
- 그룹 설명 버전 히스토리(리더십 정보 업로드 히스토리와 유사) 미포함.
- 개별 그룹 단위 재생성 버튼 미포함(일괄 버튼만). 필요 시 후속.

## 테스트 / 검증

- 타입 체크(`tsc --noEmit`), 프로덕션 빌드 통과.
- 수동 검증: 그룹 2개 이상 구성 → 일괄 생성 → 카드 펼쳐 3개 항목 확인/편집 → 5단계에서 생성 시 프롬프트 반영(응답 톤 확인).
- 회차 공유 검증: 같은 유형 구성 그룹을 두 회차에 두고, 한쪽 편집이 다른 쪽에 반영되는지 확인.
