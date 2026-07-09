import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// searchParams 사용 라우트 — 빌드 시 정적 렌더링 시도 방지
export const dynamic = 'force-dynamic';

// GET /api/admin/participant-responses?participantId= — 직책자 1명의 응답 기록 (활동 로그용)
// GET /api/admin/participant-responses?companyId=     — 기업 전체 직책자 응답 (분석 페이지용)
export async function GET(req: NextRequest) {
  try {
    const participantId = Number(req.nextUrl.searchParams.get('participantId'));
    const companyId = Number(req.nextUrl.searchParams.get('companyId'));

    if (Number.isInteger(participantId) && participantId > 0) {
      const rows = await prisma.participantResponse.findMany({
        where: { participantId },
        orderBy: { updatedAt: 'desc' },
      });
      return NextResponse.json({ responses: rows });
    }

    if (Number.isInteger(companyId) && companyId > 0) {
      const rows = await prisma.participantResponse.findMany({
        where: { participant: { companyId } },
        orderBy: { updatedAt: 'desc' },
        include: { participant: { select: { id: true, name: true, position: true, leadershipType: true } } },
      });
      return NextResponse.json({ responses: rows });
    }

    return NextResponse.json({ error: 'participantId 또는 companyId가 필요합니다.' }, { status: 400 });
  } catch (err) {
    console.error('[admin/participant-responses GET]', err);
    return NextResponse.json({ error: '응답 기록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
