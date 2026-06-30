import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 클라이언트가 보내는 직책자 입력(id 제외)
type ParticipantInput = {
  companyId: number;
  year: number;
  name: string;
  department?: string;
  position?: string;
  email: string;
  leadershipType: string;
  assessmentRound?: number;
  deliveryStatus?: string;
  lastOpenedAt?: string | null;
  stepCurrent?: number;
  stepTotal?: number;
  token?: string | null;
};

function toCreateData(it: ParticipantInput) {
  return {
    companyId: it.companyId,
    year: it.year,
    name: it.name,
    department: it.department ?? '',
    position: it.position ?? '',
    email: it.email,
    leadershipType: it.leadershipType,
    assessmentRound: it.assessmentRound ?? 1,
    deliveryStatus: it.deliveryStatus ?? '미발송',
    lastOpenedAt: it.lastOpenedAt ?? null,
    stepCurrent: it.stepCurrent ?? 0,
    stepTotal: it.stepTotal ?? 5,
    token: it.token ?? null,
  };
}

// GET /api/admin/participants — 전체 직책자 (스토어가 보관 후 회사/연도별로 필터)
export async function GET() {
  try {
    const participants = await prisma.participant.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(participants);
  } catch (err) {
    console.error('[admin/participants GET]', err);
    return NextResponse.json({ error: '직책자 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/participants — 일괄 생성 (생성된 행 배열 반환)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { items: ParticipantInput[] };
    const items = body?.items ?? [];
    if (items.length === 0) return NextResponse.json([]);
    const created = await prisma.$transaction(
      items.map(it => prisma.participant.create({ data: toCreateData(it) })),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[admin/participants POST]', err);
    return NextResponse.json({ error: '직책자 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
