// TODO: 추후 뉴스레터 위저드와 통합 시 고려사항
//
// [category가 lib/content.ts의 ContentType과 다른 이유]
// - 이 파일의 ContentCategory = '아티클' | '인터뷰' | '책 추천' | '성공 사례' | '카드뉴스' | '웹툰' | '영상'  → 콘텐츠 풀 관리 도메인. "발행 형태" 기준.
// - lib/content.ts의 ContentType = '글' | '영상' | '인포그래픽' | '카드뉴스'  → 뉴스레터 위저드 도메인. "독자 경험 형태" 기준.
// 콘텐츠 풀은 원본 에셋 관리 관점이고, 위저드는 독자가 소비하는 방식 관점이기 때문에 의도적으로 분리.
//
// [뉴스레터 위저드와 통합 방향]
// 1. app/api/save-content/route.ts가 lib/mockData/contentPool.ts 파일을 직접 읽고 씁니다.
//    → 이 파일의 함수들은 /api/save-content를 통해 파일에 영속적으로 저장합니다.
// 2. 위저드 3단계 콘텐츠 카드에서 보여주는 ContentType 배지는
//    아래 toWizardContentType() 매핑 함수(미구현)로 변환 권장.
//    예: '아티클' → '글', '영상' → '영상'. 인포그래픽/카드뉴스가 필요하면 ContentCategory에 추가 후 매핑 확장.
// 3. 통합 시 lib/content.ts의 ContentItem.readingTime ↔ ContentPoolItem.duration 필드 이름 통일 검토.

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
  thumbnail: string;       // 직접 등록한 썸네일 (1순위)
  thumbnailUrl?: string;   // 웹서칭 이미지 / 주제 기반 폴백 URL (2순위)
  body: string;
  summary?: string;
  createdAt: string;
  sourceUrl?: string;      // AI 큐레이션 콘텐츠의 원문 출처 링크 (웹서칭 결과). 있으면 카드에 출처 표시
}

export interface ContentListFilter {
  type?: ContentSource;
  category?: ContentCategory;
  q?: string;
}

export async function getContentList(filter?: ContentListFilter): Promise<ContentPoolItem[]> {
  const res = await fetch('/api/save-content', { cache: 'no-store' });
  if (!res.ok) throw new Error('콘텐츠 목록을 불러오지 못했습니다.');
  let items = (await res.json()) as ContentPoolItem[];

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
  const items = await getContentList();
  return items.find(i => i.id === id) ?? null;
}

export async function addContent(
  item: Omit<ContentPoolItem, 'id' | 'createdAt'>,
): Promise<ContentPoolItem> {
  const res = await fetch('/api/save-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? '저장에 실패했습니다.');
  }
  const data = await res.json() as { item: ContentPoolItem };
  return data.item;
}

export async function updateContent(
  id: string,
  patch: Partial<Omit<ContentPoolItem, 'id' | 'createdAt'>>,
): Promise<ContentPoolItem> {
  const res = await fetch('/api/save-content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? '수정에 실패했습니다.');
  }
  // 서버가 저장한 최신 상태를 현재 patch 기반으로 재구성
  const current = await getContentById(id);
  return current ?? ({ id, ...patch } as ContentPoolItem);
}

export async function deleteContent(id: string): Promise<void> {
  const res = await fetch('/api/save-content', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? '삭제에 실패했습니다.');
  }
}
