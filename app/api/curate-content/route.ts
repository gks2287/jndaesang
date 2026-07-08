import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { callClaude } from '@/lib/api/claude';
import type { ContentCategory } from '@/lib/api/contentPool';

export type CuratedResult = {
  title: string;
  category: ContentCategory;
  duration: 1 | 2;
  author: string;
  tags: string[];
  body: string;
  summary: string;
  sourceUrl: string;
  thumbnailUrl?: string;
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_SYSTEM = `당신은 리더십 코칭 콘텐츠 큐레이터입니다.
웹 검색으로 찾은 실제 자료를 바탕으로 기업 리더십 개발에 관심 있는 40~50대 임원을 위한 콘텐츠를 한국어로 요약합니다.
반드시 JSON만 반환하고, 다른 텍스트는 포함하지 마세요.`;

async function generateTopic(): Promise<string> {
  const raw = await callClaude(
    '기업 리더십 개발에 관심 있는 40~50대 임원이 읽으면 도움될 최신 주제 1개를 추천해주세요.\n예: 심리적 안전감, 코칭 리더십, 조직문화 등\n주제명만 한국어로 답하세요.',
  );
  return raw.trim();
}

async function searchAndParse(topic: string): Promise<CuratedResult | null> {
  const query = `${topic} 리더십 최신 트렌드 연구`;
  const userPrompt = `"${query}"로 웹을 검색하고, 기업 리더십 개발에 가장 유용한 자료 하나를 아래 JSON 형식으로 정리해주세요:
{
  "title": "독자가 읽고 싶어지는 흥미로운 한국어 제목",
  "category": "아티클" 또는 "인터뷰" 또는 "책 추천" 또는 "성공 사례" 또는 "카드뉴스" 또는 "웹툰" 또는 "영상",
  "duration": 1 또는 2,
  "author": "출처/저자/매체명",
  "tags": ["키워드1", "키워드2", "키워드3"],
  "body": "원본 내용을 충실하게 500~800자 한국어로 요약. 핵심 인사이트와 실용적 조언 포함.",
  "summary": "한 줄 핵심 요약",
  "sourceUrl": "원본 URL (없으면 빈 문자열)"
}
JSON만 반환하세요.`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  for (let turn = 0; turn < 8; turn++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: PARSE_SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return null;
      const text = textBlock.text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      try {
        return JSON.parse(text.slice(start, end + 1)) as CuratedResult;
      } catch {
        return null;
      }
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      messages.push({
        role: 'user',
        content: toolUses.map(tu => ({
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: '검색이 완료되었습니다.',
        })),
      });
      continue;
    }

    break;
  }

  return null;
}

async function parseFromUrl(url: string): Promise<CuratedResult | null> {
  const userPrompt = `아래 URL의 콘텐츠를 웹에서 검색·조회하고, 기업 리더십 개발에 관심 있는 40~50대 임원을 위해 아래 JSON 형식으로 정리해주세요.

URL: ${url}

{
  "title": "독자가 읽고 싶어지는 흥미로운 한국어 제목",
  "category": "아티클" 또는 "인터뷰" 또는 "책 추천" 또는 "성공 사례" 또는 "카드뉴스" 또는 "웹툰" 또는 "영상",
  "duration": 1 또는 2,
  "author": "출처/저자/매체명",
  "tags": ["키워드1", "키워드2", "키워드3"],
  "body": "원본 내용을 충실하게 500~800자 한국어로 요약. 핵심 인사이트와 실용적 조언 포함.",
  "summary": "한 줄 핵심 요약",
  "thumbnailUrl": "해당 콘텐츠의 대표 이미지 URL (찾을 수 없으면 빈 문자열)",
  "sourceUrl": "${url}"
}
JSON만 반환하세요.`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  for (let turn = 0; turn < 8; turn++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: PARSE_SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return null;
      const text = textBlock.text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      try {
        return JSON.parse(text.slice(start, end + 1)) as CuratedResult;
      } catch {
        return null;
      }
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      messages.push({
        role: 'user',
        content: toolUses.map(tu => ({
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: '검색이 완료되었습니다.',
        })),
      });
      continue;
    }

    break;
  }

  return null;
}

// 서버 메모리 캐시 (URL → 파싱 결과). 같은 URL 재파싱 시 web_search 재호출 방지
const urlCache = new Map<string, CuratedResult>();
let curateCallCount = 0;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { topic?: string; sourceUrl?: string };

    if (body.sourceUrl?.trim()) {
      const url = body.sourceUrl.trim();
      curateCallCount += 1;
      const cached = urlCache.get(url);
      console.log(`[curate-content] 호출 #${curateCallCount}, 캐시: ${cached ? 'HIT' : 'MISS'} (${url})`);
      if (cached) return NextResponse.json({ data: cached });
      const result = await parseFromUrl(url);
      if (!result) {
        return NextResponse.json(
          { error: 'URL 콘텐츠 파싱에 실패했습니다. 다시 시도해주세요.' },
          { status: 500 },
        );
      }
      urlCache.set(url, result); // 결과 캐시 저장
      return NextResponse.json({ data: result });
    }

    let topic = body.topic?.trim() ?? '';
    if (!topic) {
      topic = await generateTopic();
    }
    const result = await searchAndParse(topic);
    if (!result) {
      return NextResponse.json(
        { error: '자료 수집에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ data: result });
  } catch (e) {
    console.error('[curate-content]', e);
    return NextResponse.json(
      { error: '수집 중 오류가 발생했습니다. 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
