export type ContentType = '글' | '영상' | '인포그래픽' | '카드뉴스';

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
