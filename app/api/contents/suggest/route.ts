import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { callClaude } from '@/lib/api/claude';
import type { ContentPoolItem } from '@/lib/api/contentPool';

const DATA_FILE = path.join(process.cwd(), 'lib', 'mockData', 'contentPool.ts');

async function readItems(): Promise<ContentPoolItem[]> {
  const content = await fs.readFile(DATA_FILE, 'utf-8');
  const markerIdx = content.indexOf('= [');
  const start = markerIdx === -1 ? -1 : markerIdx + 2;
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  return JSON.parse(content.slice(start, end + 1)) as ContentPoolItem[];
}

export async function POST(req: NextRequest) {
  try {
    const { topic, leadershipType, storyStage, existingIds } = await req.json() as {
      topic: string;
      leadershipType?: string;
      storyStage?: string;
      existingIds?: string[];
    };

    const allItems = await readItems();
    if (!allItems.length) {
      return NextResponse.json({ selectedIds: [] });
    }

    const exclude = new Set(existingIds ?? []);
    const candidates = allItems.filter(item => !exclude.has(item.id));

    if (!candidates.length) {
      return NextResponse.json({ selectedIds: [] });
    }

    const contentSummary = candidates
      .map(item =>
        `[ID: ${item.id}] ${item.title} (${item.category}) — 태그: ${item.tags.join(', ')} — ${item.body.slice(0, 120)}`,
      )
      .join('\n');

    const prompt = `당신은 리더십 코칭 뉴스레터 콘텐츠 큐레이터입니다.
아래 뉴스레터 주제와 맥락에 가장 잘 맞는 콘텐츠 2~3개를 선택해 주세요.

[뉴스레터 주제] ${topic}
[리더십 유형] ${leadershipType ?? '일반'}
[스토리 단계] ${storyStage ?? ''}

[후보 콘텐츠 목록]
${contentSummary}

주제와 관련성이 가장 높은 콘텐츠 2~3개의 ID만 JSON으로 반환하세요.
예시: {"selectedIds": ["id1", "id2"]}
다른 텍스트는 포함하지 마세요.`;

    const raw = await callClaude(prompt);
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json({ selectedIds: [] });
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { selectedIds: string[] };

    const validIds = new Set(candidates.map(c => c.id));
    const selectedIds = (parsed.selectedIds ?? [])
      .filter((id): id is string => typeof id === 'string' && validIds.has(id))
      .slice(0, 3);

    return NextResponse.json({ selectedIds });
  } catch (e) {
    console.error('[contents/suggest]', e);
    return NextResponse.json({ error: '콘텐츠 추천 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
