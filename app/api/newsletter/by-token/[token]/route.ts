import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type PeerRow = { id: number; position: string; leadershipType: string; deliveryStatus: string; stepCurrent: number; stepTotal: number };

function rate(p: PeerRow): number | null {
  return p.stepTotal > 0 && p.deliveryStatus !== '미발송' ? (p.stepCurrent / p.stepTotal) * 100 : null;
}
function avg(group: PeerRow[]): number | null {
  const vals = group.map(rate).filter((v): v is number => v !== null);
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

// GET /api/newsletter/by-token/[token] — 공개(직책자) 토큰으로 본인 1명 + 동료 비교 평균만 반환
// (전체 참여자 목록을 노출하지 않고, 집계값만 서버에서 계산)
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    let participant = await prisma.participant.findFirst({ where: { token } });
    if (!participant && token.startsWith('nl-')) {
      const id = Number(token.slice(3));
      if (Number.isInteger(id)) {
        const byId = await prisma.participant.findUnique({ where: { id } });
        if (byId && !byId.token) participant = byId; // 폴백 토큰은 token 미설정 참여자에게만 유효
      }
    }
    if (!participant) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 });
    }

    // 동료 비교 평균 (직책/유형 그룹) — 개인 정보 없이 집계만
    const peerRows = await prisma.participant.findMany({
      where: { id: { not: participant.id }, deliveryStatus: { not: '미발송' }, stepTotal: { gt: 0 } },
      select: { id: true, position: true, leadershipType: true, deliveryStatus: true, stepCurrent: true, stepTotal: true },
    });
    const positionGroup = peerRows.filter(p => p.position === participant!.position);
    const typeGroup = peerRows.filter(p => p.leadershipType === participant!.leadershipType);

    return NextResponse.json({
      participant,
      peers: {
        positionParticipationAvg: avg(positionGroup),
        typeParticipationAvg: avg(typeGroup),
        positionGroupCount: positionGroup.length,
        typeGroupCount: typeGroup.length,
      },
    });
  } catch (err) {
    console.error('[newsletter/by-token GET]', err);
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
