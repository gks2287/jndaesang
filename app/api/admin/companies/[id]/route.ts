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

// DELETE /api/admin/companies/[id] — 기업 삭제
// 직책자·뉴스레터는 FK onDelete: Cascade로 자동 삭제되고,
// 리더십 정보 버전(FK 없음)은 수동으로 정리한다.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 기업 ID입니다.' }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.leadershipInfoVersion.deleteMany({ where: { companyId: id } }),
      prisma.company.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/companies DELETE]', err);
    return NextResponse.json({ error: '기업 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
