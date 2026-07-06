import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// DB의 DateTime을 기존 스토어 계약(YYYY-MM-DD 문자열)에 맞춰 직렬화
function serialize(n: Prisma.NewsletterGetPayload<object>) {
  return {
    ...n,
    createdAt: n.createdAt.toISOString().slice(0, 10),
    updatedAt: n.updatedAt.toISOString().slice(0, 10),
  };
}

type CreateBody = {
  title: string;
  companyId: number;
  companyName: string;
  leadershipType: string;
  status?: string;
  stepCount?: number;
  positiveLeaders?: unknown;
  negativeLeaders?: unknown;
  totalRounds?: number;
  completedRounds?: number;
  type?: string;
  leaderType?: string;
  totalLeaders?: number;
  savedRounds?: number[];
  generatedContent?: unknown;
  authoring?: unknown;
};

// GET /api/admin/newsletters — 전체 뉴스레터(캠페인) 목록 (최신순)
export async function GET() {
  try {
    const rows = await prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error('[admin/newsletters GET]', err);
    return NextResponse.json({ error: '뉴스레터 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/newsletters — 뉴스레터 생성
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as CreateBody;
    if (!b?.title?.trim()) {
      return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 });
    }
    const data = {
      title: b.title,
      companyId: b.companyId,
      companyName: b.companyName,
      leadershipType: b.leadershipType,
      status: b.status ?? '제작 중',
      stepCount: b.stepCount ?? 0,
      positiveLeaders: (b.positiveLeaders ?? {}) as Prisma.InputJsonValue,
      negativeLeaders: (b.negativeLeaders ?? {}) as Prisma.InputJsonValue,
      totalRounds: b.totalRounds ?? 0,
      completedRounds: b.completedRounds ?? 0,
      type: b.type ?? 'general',
      leaderType: b.leaderType ?? 'positive',
      totalLeaders: b.totalLeaders ?? 0,
      savedRounds: b.savedRounds ?? [],
      generatedContent: (b.generatedContent ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      authoring: (b.authoring ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    };
    // 같은 기업·제목의 캠페인이 이미 있으면 새 행을 만들지 않고 갱신 (중복 행 생성 방지: 더블 서브밋·재완료 대응)
    const existing = await prisma.newsletter.findFirst({
      where: { companyId: b.companyId, title: b.title },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      const updated = await prisma.newsletter.update({ where: { id: existing.id }, data });
      return NextResponse.json(serialize(updated), { status: 200 });
    }
    const created = await prisma.newsletter.create({ data });
    return NextResponse.json(serialize(created), { status: 201 });
  } catch (err) {
    console.error('[admin/newsletters POST]', err);
    return NextResponse.json({ error: '뉴스레터 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
