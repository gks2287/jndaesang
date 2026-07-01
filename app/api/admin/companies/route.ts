import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getInitials, colorForId } from '@/lib/company';

// GET /api/admin/companies — 기업 목록 (최신순)
export async function GET() {
  try {
    const companies = await prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(companies);
  } catch (err) {
    console.error('[admin/companies GET]', err);
    return NextResponse.json({ error: '기업 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

type CreateBody = {
  name: string;
  industry?: string;
  participantCount?: number;
  status?: string;
  hrName?: string;
  hrEmail?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  logoUrl?: string | null;
};

// POST /api/admin/companies — 기업 생성 (이니셜/색상은 서버에서 부여)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBody;
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: '기업명은 필수입니다.' }, { status: 400 });
    }
    // 색상은 id 기반이라, 생성 후 id로 한 번 더 업데이트
    const created = await prisma.company.create({
      data: {
        name: body.name.trim(),
        initials: getInitials(body.name),
        industry: body.industry ?? '',
        participantCount: body.participantCount ?? 0,
        status: body.status ?? '진행 전',
        hrName: body.hrName ?? '',
        hrEmail: body.hrEmail ?? '',
        startDate: body.startDate ?? '',
        endDate: body.endDate ?? '',
        note: body.note ?? '',
        color: '',
        logoUrl: body.logoUrl ?? null,
      },
    });
    const withColor = await prisma.company.update({
      where: { id: created.id },
      data: { color: colorForId(created.id) },
    });
    return NextResponse.json(withColor, { status: 201 });
  } catch (err) {
    console.error('[admin/companies POST]', err);
    return NextResponse.json({ error: '기업 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
