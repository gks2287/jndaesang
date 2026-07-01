import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getInitials } from '@/lib/company';

type UpdateBody = Partial<{
  name: string;
  industry: string;
  participantCount: number;
  status: string;
  hrName: string;
  hrEmail: string;
  startDate: string;
  endDate: string;
  note: string;
  logoUrl: string | null;
}>;

// PATCH /api/admin/companies/[id] — 기업 수정 (이름 변경 시 이니셜 재계산)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 기업 ID입니다.' }, { status: 400 });
    }
    const body = (await req.json()) as UpdateBody;
    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...body,
        ...(body.name !== undefined ? { initials: getInitials(body.name) } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[admin/companies PATCH]', err);
    return NextResponse.json({ error: '기업 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
