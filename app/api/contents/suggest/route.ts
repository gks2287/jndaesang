import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentPoolItem, ContentCategory } from '@/lib/api/contentPool';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CATEGORIES: ContentCategory[] = [
  '아티클', '인터뷰', '책 추천', '성공 사례', '카드뉴스', '웹툰',
];

type SearchedContent = {
  title: string;
  category: string;
  duration: number;
  author: string;
  tags: string[];
  body: string;
  thumbnail: string;
  imageUrl?: string;   // 웹서칭에서 찾은 대표 이미지 URL (있으면)
};

// 콘텐츠 주제/카테고리/태그 기반 Picsum 폴백 이미지 seed 선택
function pickThumbnailSeed(text: string): string {
  const has = (...ws: string[]) => ws.some(w => text.includes(w));
  if (has('소통', '피드백', '커뮤니케이션', '커뮤니', '경청', '대화', '1on1', '미팅', '회의')) return 'communication';
  if (has('팀', '조직', '협업', '팀워크', '동료', '문화')) return 'teamwork';
  if (has('코칭', '성장', '멘토', '육성', '코치', '발전')) return 'coaching';
  if (has('변화', '혁신', '전환', '개선', '도전')) return 'innovation';
  if (has('리더십', '자기인식', '리더', '인식', '성찰')) return 'leadership';
  return 'business';
}

// Picsum: seed 고정이라 항상 같은 이미지 반환(일관성), 무료·안정·빠름
function buildThumbnailUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/800/450`;
}

// http(s) 이미지 URL 형태인지 가벼운 검증
function isValidImageUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim());
}

// 서버 메모리 캐시 (주제+리더십유형 → 콘텐츠 결과). web_search 재호출 방지(비용 절감)
const contentsCache = new Map<string, ContentPoolItem[]>();
let contentsCallCount = 0;

// JSON 출력 강제 시스템 프롬프트 (배열만 출력)
const SYSTEM_PROMPT = `You must respond with ONLY a JSON array. No explanations, no markdown, no code fences.
Start your response with [ and end with ].
Do not include any text before [ or after ].
Example format:
[
  {
    "title": "...",
    "body": "...",
    ...
  }
]`;

// AI 응답 텍스트 → SearchedContent[] 추출. 다단계 폴백으로 견고하게 파싱.
// 1) 코드펜스 제거 → [ ... ] 배열 파싱
// 2) 구 형식 { "contents": [...] } 호환 파싱
// 3) 개별 객체 정규식 추출 후 각각 파싱
function parseContentsFromText(text: string): SearchedContent[] | null {
  // 1) 코드펜스 제거
  const cleaned = text.replace(/```json|```/g, '').trim();

  // 1) [ ... ] 배열 직접 파싱: [ 이전 / ] 이후 텍스트 제거
  const aStart = cleaned.indexOf('[');
  const aEnd = cleaned.lastIndexOf(']');
  if (aStart !== -1 && aEnd > aStart) {
    try {
      const arr = JSON.parse(cleaned.slice(aStart, aEnd + 1));
      if (Array.isArray(arr) && arr.length > 0) return arr as SearchedContent[];
    } catch { /* 다음 단계로 폴백 */ }
  }

  // 2) 구 형식 { "contents": [...] } 호환
  const oStart = cleaned.indexOf('{');
  const oEnd = cleaned.lastIndexOf('}');
  if (oStart !== -1 && oEnd > oStart) {
    try {
      const obj = JSON.parse(cleaned.slice(oStart, oEnd + 1)) as { contents?: SearchedContent[] };
      if (Array.isArray(obj?.contents) && obj.contents.length > 0) return obj.contents;
    } catch { /* 다음 단계로 폴백 */ }
  }

  // 3) 개별 객체 정규식 추출 (최후의 수단)
  const objMatches = cleaned.match(/\{[\s\S]*?\}/g);
  if (objMatches) {
    const items: SearchedContent[] = [];
    for (const m of objMatches) {
      try {
        const obj = JSON.parse(m) as Record<string, unknown>;
        if (obj && typeof obj === 'object' && 'title' in obj) items.push(obj as SearchedContent);
      } catch { /* 해당 조각 스킵 */ }
    }
    if (items.length > 0) return items;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { topic, leadershipType, storyStage, contentBrief } = await req.json() as {
      topic: string;
      leadershipType?: string;
      storyStage?: string;
      contentBrief?: string;
      existingIds?: string[];
    };

    // 캐시 키: 주제 + 리더십유형 + 콘텐츠 세부 방향 (세부 방향이 바뀌면 재수집해야 하므로 반드시 포함)
    const cacheKey = `${(topic ?? '').trim()}|${leadershipType ?? '일반형'}|${(contentBrief ?? '').trim()}`;
    contentsCallCount += 1;
    const cachedContents = contentsCache.get(cacheKey);
    console.log(`[contents/suggest] 호출 #${contentsCallCount}, 캐시: ${cachedContents ? 'HIT' : 'MISS'}`);
    if (cachedContents) {
      return NextResponse.json({ contents: cachedContents });
    }

    const isCustomType = leadershipType && leadershipType !== '일반형';
    const typeSearchHint = isCustomType ? (() => {
      const hints: Record<string, string> = {
        '독재형': '수평적 소통, 위임, 심리적 안전감, 참여적 의사결정',
        '방관형': '책임감, 적극적 개입, 피드백, 존재감 있는 리더십',
        '불통형': '경청, 공감, 1on1 소통, 열린 피드백 문화',
        '성과압박형': '지속 가능한 성과, 번아웃 예방, 과정 중심 리더십',
        '감정기복형': '감정 지능(EQ), 자기 조절, 일관성, 침착한 리더십',
        '완벽주의형': '위임, 실패 허용 문화, 완벽주의 극복, 팀 자율성',
        '우유부단형': '의사결정력, 명확한 방향 제시, 우선순위 설정',
      };
      return leadershipType.split(', ').map(t => hints[t] ?? t).join(' / ');
    })() : null;

    const prompt = `당신은 리더십 코칭 뉴스레터 콘텐츠 큐레이터입니다.
아래 조건에 맞는 콘텐츠를 웹에서 검색해 1~2개 수집해 주세요.

[조건]
- 뉴스레터 주제: ${topic}
- 발송 유형: ${isCustomType ? `맞춤형 (${leadershipType} 리더 대상)` : '일반형 (전체 리더 대상)'}
- 스토리 단계: ${storyStage ?? ''}
${isCustomType ? `- 검색 핵심 키워드: ${typeSearchHint} (${leadershipType} 유형의 문제 행동을 개선하는 콘텐츠 우선)` : '- 검색 방향: 모든 리더에게 적용 가능한 보편적 리더십 역량 콘텐츠'}

[분량 제약 — 반드시 준수]
- 뉴스레터 전체 4~5분 분량 중 콘텐츠에 쓸 수 있는 시간은 최대 3분
- duration 1분짜리: 최대 2개 수집 가능
- duration 2분짜리: 1개만 수집
- 콘텐츠는 절대 3개 이상 수집하지 말 것

[수집 기준 — 우선순위 순]
${contentBrief?.trim() ? `1. 사용자가 지정한 세부 방향: ${contentBrief.trim()} — 이 방향에 부합하는 콘텐츠를 최우선으로 수집\n` : ''}${contentBrief?.trim() ? '2' : '1'}. 뉴스레터 주제 "${topic}"와 직접 관련된 콘텐츠
${contentBrief?.trim() ? '3' : '2'}. ${storyStage ? `"${storyStage}" 단계 목적(${storyStage === '수용' ? '진단 수용·성찰' : storyStage === '분석' ? 'Gap 파악' : storyStage === '실행' ? '즉시 실행 가능한 변화' : storyStage === '유지' ? '습관화' : '성장 복기'})에 부합하는 콘텐츠` : '스토리 단계에 맞는 콘텐츠'}
${contentBrief?.trim() ? '4' : '3'}. 아티클, 인터뷰, 책, 성공 사례, 카드뉴스, 웹툰만 수집 (영상 제외)
${contentBrief?.trim() ? '5' : '4'}. 신뢰할 수 있는 출처 (언론사, 전문 매체, 학술 자료, 유명 저자)
${contentBrief?.trim() ? '6' : '5'}. 한국어 또는 영어 콘텐츠 모두 가능

[body 작성 가이드]
- 뉴닉 뉴스레터 스타일: 친근하고 재밌되 정제된 말투
- 리더(독자)에게 직접 말 거는 2인칭 톤 (예: "여러분은 혹시...")
- 이모지 적절히 활용 (과하지 않게)
- 핵심 내용을 bullet 또는 소제목으로 구조화
- duration 1분 = 400~600자, duration 2분 = 800~1000자
- 원문의 핵심 논점, 데이터, 사례를 구체적으로 포함
- ${storyStage ?? ''} 단계 맥락 및 ${isCustomType ? leadershipType + ' 유형 리더십 개선' : '보편적 리더십 역량 강화'}과 연결되는 인사이트로 마무리

반드시 아래 JSON 배열 형식으로만 응답하세요. [ 로 시작하고 ] 로 끝나며, 그 외 텍스트는 절대 포함 금지:
[
  {
    "title": "콘텐츠 제목 (한국어, 흥미롭게)",
    "category": "아티클|인터뷰|책 추천|성공 사례|카드뉴스|웹툰 중 하나",
    "duration": 1,
    "author": "출처/매체명",
    "tags": ["태그1", "태그2", "태그3"],
    "body": "뉴닉 스타일 본문 (duration 기준 분량 준수)",
    "thumbnail": "",
    "imageUrl": "검색 결과에서 찾은 콘텐츠 대표 이미지 URL (http로 시작, 없으면 빈 문자열)"
  }
]`;

    // AI 호출 → 응답 텍스트에서 JSON 파싱. 실패 시 새 API 호출로 1회 재시도.
    let searched: SearchedContent[] | null = null;
    for (let attempt = 1; attempt <= 2 && !searched; attempt += 1) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlocks = response.content.filter(b => b.type === 'text');
      const lastText = textBlocks.length > 0
        ? (textBlocks[textBlocks.length - 1] as { type: 'text'; text: string }).text
        : '';

      searched = lastText ? parseContentsFromText(lastText) : null;
      if (searched) {
        console.log(`[contents/suggest] 파싱 성공: ${searched.length}개 (시도 ${attempt}/2)`);
      } else {
        console.warn(`[contents/suggest] 파싱 실패, ${attempt < 2 ? '재시도 중...' : '최종 실패'} (시도 ${attempt}/2)`);
      }
    }

    // 재시도까지 실패 → 500 대신 빈 배열 + parse_failed 플래그 반환 (클라이언트 안내용)
    if (!searched) {
      console.warn('[contents/suggest] 재시도 후에도 파싱 실패 — parse_failed 반환');
      return NextResponse.json({ contents: [], error: 'parse_failed' });
    }

    const now = Date.now();

    const contents: ContentPoolItem[] = searched
      .slice(0, 2)
      .map((c, i) => {
        const tags = Array.isArray(c.tags) ? c.tags.slice(0, 5) : [];
        // 썸네일 폴백 URL: 웹서칭 이미지 우선, 없으면 주제/카테고리 기반 Unsplash
        const keywordText = [String(c.title ?? ''), String(c.category ?? ''), topic ?? '', ...tags].join(' ');
        const thumbnailUrl = isValidImageUrl(c.imageUrl)
          ? c.imageUrl.trim()
          : buildThumbnailUrl(pickThumbnailSeed(keywordText));
        return {
          id: `suggested_${now}_${i}`,
          type: 'curation' as const,
          title: String(c.title ?? ''),
          category: VALID_CATEGORIES.includes(c.category as ContentCategory)
            ? (c.category as ContentCategory)
            : '아티클',
          duration: Number(c.duration) === 2 ? 2 : 1,
          author: String(c.author ?? ''),
          tags,
          body: String(c.body ?? ''),
          thumbnail: '',
          thumbnailUrl,
          createdAt: new Date().toISOString().split('T')[0],
        };
      });

    if (contents.length > 0) contentsCache.set(cacheKey, contents); // 결과 캐시 저장
    return NextResponse.json({ contents });
  } catch (e) {
    console.error('[contents/suggest]', e);
    return NextResponse.json({ error: '콘텐츠 추천 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
