// TODO: 추후 뉴스레터 위저드와 통합 시 고려사항
//
// [category가 lib/content.ts의 ContentType과 다른 이유]
// - 이 파일의 ContentCategory = '아티클' | '인터뷰' | '책 추천' | '성공 사례' | '카드뉴스' | '웹툰' | '영상'  → 콘텐츠 풀 관리 도메인. "발행 형태" 기준.
// - lib/content.ts의 ContentType = '글' | '영상' | '인포그래픽' | '카드뉴스'  → 뉴스레터 위저드 도메인. "독자 경험 형태" 기준.
// 콘텐츠 풀은 원본 에셋 관리 관점이고, 위저드는 독자가 소비하는 방식 관점이기 때문에 의도적으로 분리.
//
// [뉴스레터 위저드와 통합 방향]
// 1. app/api/content-pool/route.ts가 현재 별도 하드코딩 mock을 반환 중.
//    → 추후 이 getContentList()를 호출하는 형태로 교체하면 단일 데이터 소스로 통일 가능.
// 2. 위저드 3단계 콘텐츠 카드에서 보여주는 ContentType 배지는
//    아래 toWizardContentType() 매핑 함수(미구현)로 변환 권장.
//    예: '아티클' → '글', '영상' → '영상'. 인포그래픽/카드뉴스가 필요하면 ContentCategory에 추가 후 매핑 확장.
// 3. 통합 시 lib/content.ts의 ContentItem.readingTime ↔ ContentPoolItem.duration 필드 이름 통일 검토.

import { MOCK_CONTENT_POOL } from '@/lib/mockData/contentPool';

export type ContentSource = 'original' | 'curation';
export type ContentCategory = '아티클' | '인터뷰' | '책 추천' | '성공 사례' | '카드뉴스' | '웹툰' | '영상';

export interface ContentPoolItem {
  id: string;
  type: ContentSource;
  title: string;
  category: ContentCategory;
  duration: number;
  author: string;
  tags: string[];
  thumbnail: string;
  body: string;
  createdAt: string;
}

export interface ContentListFilter {
  type?: ContentSource;
  category?: ContentCategory;
  q?: string;
}

// 모듈 레벨 mutable store — 실제 API 교체 전까지 메모리에서 CRUD를 처리합니다.
// 페이지 새로고침 시 MOCK_CONTENT_POOL로 초기화되는 것은 의도된 동작입니다.
let _store: ContentPoolItem[] = [...MOCK_CONTENT_POOL];

export async function getContentList(filter?: ContentListFilter): Promise<ContentPoolItem[]> {
  // 실제 API 교체 시 fetch('/api/content-pool', { ... }) 형태로 변경
  let items = _store;

  if (filter?.type) items = items.filter(i => i.type === filter.type);
  if (filter?.category) items = items.filter(i => i.category === filter.category);
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    items = items.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        i.author.toLowerCase().includes(q),
    );
  }

  return items;
}

export async function getContentById(id: string): Promise<ContentPoolItem | null> {
  return _store.find(i => i.id === id) ?? null;
}

export async function addContent(
  item: Omit<ContentPoolItem, 'id' | 'createdAt'>,
): Promise<ContentPoolItem> {
  // 실제 API 교체 시 fetch('/api/content-pool', { method: 'POST', body: ... }) 형태로 변경
  const newItem: ContentPoolItem = {
    ...item,
    id: `content-${Date.now()}`,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  _store = [newItem, ..._store];
  return newItem;
}

export async function updateContent(
  id: string,
  patch: Partial<Omit<ContentPoolItem, 'id' | 'createdAt'>>,
): Promise<ContentPoolItem> {
  // 실제 API 교체 시 fetch(`/api/content-pool/${id}`, { method: 'PATCH', body: ... }) 형태로 변경
  const target = _store.find(i => i.id === id);
  if (!target) throw new Error(`Content not found: ${id}`);
  const updated = { ...target, ...patch };
  _store = _store.map(i => (i.id === id ? updated : i));
  return updated;
}

export async function deleteContent(id: string): Promise<void> {
  // 실제 API 교체 시 fetch(`/api/content-pool/${id}`, { method: 'DELETE' }) 형태로 변경
  _store = _store.filter(i => i.id !== id);
}
