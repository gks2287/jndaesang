import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 전반적 만족도 라벨 → 5점 점수
const SCORE: Record<string, number> = {
  '매우 만족': 5,
  '만족': 4,
  '보통': 3,
  '불만족': 2,
  '매우 불만족': 1,
};

// GET /api/admin/newsletter-satisfaction
// 뉴스레터별 만족도 집계 { [newsletterId]: { avg, count } }
// 상시(survey-always) rating + 정기조사(survey-periodic) 전반적 만족도 문항을 점수화.
export async function GET() {
  try {
    const rows = await prisma.participantResponse.findMany({
      where: { kind: { in: ['survey-always', 'survey-periodic'] }, newsletterId: { gt: 0 } },
      select: { newsletterId: true, kind: true, response: true },
    });

    const agg: Record<number, { sum: number; count: number }> = {};
    for (const row of rows) {
      const r = (row.response ?? {}) as Record<string, unknown>;
      let label: string | undefined;
      if (row.kind === 'survey-always') {
        label = typeof r.rating === 'string' ? r.rating : undefined;
      } else {
        const answers = Array.isArray(r.answers) ? (r.answers as { question?: string; answer?: unknown }[]) : [];
        const overall = answers.find(a => typeof a?.question === 'string' && a.question.includes('전반적으로') && a.question.includes('만족'));
        if (overall && typeof overall.answer === 'string') label = overall.answer;
      }
      const l = (label ?? '').trim();
      if (l in SCORE) {
        const a = agg[row.newsletterId] ?? (agg[row.newsletterId] = { sum: 0, count: 0 });
        a.sum += SCORE[l];
        a.count += 1;
      }
    }

    const satisfaction: Record<number, { avg: number; count: number }> = {};
    for (const [id, a] of Object.entries(agg)) {
      satisfaction[Number(id)] = { avg: a.count > 0 ? a.sum / a.count : 0, count: a.count };
    }

    return NextResponse.json({ satisfaction });
  } catch (err) {
    console.error('[admin/newsletter-satisfaction GET]', err);
    return NextResponse.json({ error: '만족도를 불러오지 못했습니다.' }, { status: 500 });
  }
}
