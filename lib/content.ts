import type { ContentPoolItem } from '@/lib/api/contentPool';

export type ContentType = '글' | '영상' | '인포그래픽' | '카드뉴스';

export type InteractionType = 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont';
export type SurveyType = 'always' | 'periodic';

// 맞춤형 그룹: 부정 리더십 유형 묶음 + 그룹별 독립 콘텐츠 구성
export interface CustomGroup {
  id: string;
  types: string[];
  leaderIds: number[];
  // 그룹별 콘텐츠 구성
  topic: string;
  contents: ContentPoolItem[];
  interactions: InteractionType[];
  surveys: SurveyType[];
  // 그룹별 콘텐츠 세부 방향(선택) — AI 콘텐츠 수집·본문 생성에 반영. 기존 드래프트 호환을 위해 optional
  contentBrief?: string;
  // 그룹별 추가 자료 (선택) — 기존 드래프트 호환을 위해 optional
  attachments?: RoundAttachment[];
}

// 타깃(일반형/그룹)별 추가 자료 (조직 진단 결과 파일 등 직접 첨부).
// 업로드 즉시 AI 파싱해 추출 텍스트만 보관 (파일 바이트는 저장하지 않음 → 새로고침·재생성에도 유지).
export interface RoundAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;        // bytes
  note: string;        // 관리자 메모 (예: "2024 조직 진단 결과")
  uploadedAt: string;  // ISO
  useForGeneration: boolean;                    // '본문에 반영' 체크 — 체크된 자료만 generate/refine 입력에 포함
  parseStatus: 'parsing' | 'done' | 'error';    // AI 파싱 상태
  extractedText?: string;                       // 추출된 핵심 데이터(수치·분포 등). done일 때만 존재
  parseError?: string;                          // error일 때 사유
}

export interface Round {
  id: number;
  stepIndex: number;
  topic: string;
  contents: ContentPoolItem[];
  interactions: InteractionType[];
  surveys: SurveyType[];
  newsletterType: '일반형' | '맞춤형';
  generalTypes: string[];   // 일반형으로 이동된 부정 리더십 유형 (기본 빈 배열 = 전체 맞춤형)
  customLeaderIds: number[];
  generalLeaderIds: number[];
  // 맞춤형 그룹 (기존 customTypes/customTopic/customContents/... 대체)
  customGroups: CustomGroup[];
  // 일반형 콘텐츠 세부 방향(선택) — AI 콘텐츠 수집·본문 생성에 반영. 기존 드래프트 호환을 위해 optional
  contentBrief?: string;
  // 회차별 추가 자료 (선택) — 기존 드래프트 호환을 위해 optional
  attachments?: RoundAttachment[];
}

export function makeCustomGroup(id: string, types: string[] = [], leaderIds: number[] = []): CustomGroup {
  return { id, types, leaderIds, topic: '', contents: [], interactions: [], surveys: [], contentBrief: '', attachments: [] };
}

// 그룹 설명: 기업 학습 리더십 정보를 종합해 AI가 도출하고 관리자가 편집하는 그룹 단위 정의.
// 뉴스레터 콘텐츠 생성 시 맞춤형 본문의 방향 기준으로 사용된다.
export interface GroupDescription {
  summary: string;           // 그룹 한줄 요약/정의
  characteristics: string;   // 그룹 특성
  developmentPoints: string; // 개발 포인트(코칭 방향)
}

// 유형 구성 → 설명 매핑 키. 유형 배열을 정렬·조인하여 회차와 무관하게 같은 구성이 설명을 공유한다.
export function groupCompositionKey(types: string[]): string {
  return [...types].filter(Boolean).sort().join('|');
}

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  url: string;
  readingTime: number; // 분
  description: string;
  tags: string[];
}

export interface Issue {
  id: string;
  label: string; // "1회차", "2회차" ...
  contentItems: ContentItem[];
}

export interface StepContent {
  stepIndex: number; // 0~4
  issues: Issue[];
}

export const CONTENT_TYPE_ICON: Record<ContentType, string> = {
  '글': '📝',
  '영상': '🎬',
  '인포그래픽': '📊',
  '카드뉴스': '🃏',
};

export const CONTENT_TYPE_COLOR: Record<ContentType, string> = {
  '글': 'bg-blue-50 text-blue-600 border-blue-200',
  '영상': 'bg-red-50 text-red-600 border-red-200',
  '인포그래픽': 'bg-green-50 text-green-600 border-green-200',
  '카드뉴스': 'bg-purple-50 text-purple-600 border-purple-200',
};

export function calcReadingTime(items: ContentItem[]): number {
  return items.reduce((sum, item) => sum + item.readingTime, 0);
}

export function readingTimeStatus(minutes: number): { label: string; color: string } {
  if (minutes === 0) return { label: '콘텐츠 없음', color: 'text-gray-400' };
  if (minutes < 3) return { label: `${minutes}분 — 권장보다 짧음`, color: 'text-amber-600' };
  if (minutes <= 5) return { label: `${minutes}분 ✅`, color: 'text-emerald-600' };
  return { label: `${minutes}분 — 권장보다 김`, color: 'text-red-500' };
}

export function makeIssue(index: number): Issue {
  return { id: `issue-${Date.now()}-${index}`, label: `${index + 1}회차`, contentItems: [] };
}

export function makeStepContents(stepCount: number): StepContent[] {
  return Array.from({ length: stepCount }, (_, i) => ({
    stepIndex: i,
    issues: [makeIssue(0)],
  }));
}
