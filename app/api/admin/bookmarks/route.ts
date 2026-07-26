import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/bookmarks — 현재 관리자의 북마크 키 목록 (`${newsletterId}-${roundNum}`)
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const rows = await prisma.newsletterBookmark.findMany({
      where: { adminUserId: admin.id },
      select: { newsletterId: true, roundNum: true },
    });
    return NextResponse.json({ keys: rows.map(r => `${r.newsletterId}-${r.roundNum}`) });
  } catch (err) {
    console.error('[admin/bookmarks GET]', err);
    return NextResponse.json({ error: '북마크를 불러오지 못했습니다.' }, { status: 500 });
  }
}

type Body = { newsletterId?: number; roundNum?: number; bookmarked?: boolean };

// POST /api/admin/bookmarks — 북마크 토글 (bookmarked=true 추가 / false 제거)
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const { newsletterId, roundNum, bookmarked } = (await req.json()) as Body;
    if (!Number.isInteger(newsletterId) || !Number.isInteger(roundNum)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }
    const nId = newsletterId as number;
    const rNum = roundNum as number;
    if (bookmarked) {
      await prisma.newsletterBookmark.upsert({
        where: { adminUserId_newsletterId_roundNum: { adminUserId: admin.id, newsletterId: nId, roundNum: rNum } },
        create: { adminUserId: admin.id, newsletterId: nId, roundNum: rNum },
        update: {},
      });
    } else {
      await prisma.newsletterBookmark.deleteMany({ where: { adminUserId: admin.id, newsletterId: nId, roundNum: rNum } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/bookmarks POST]', err);
    return NextResponse.json({ error: '북마크 저장에 실패했습니다.' }, { status: 500 });
  }
}
