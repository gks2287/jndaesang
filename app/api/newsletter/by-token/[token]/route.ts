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

    // 본인 회사·유형에 매칭되는 뉴스레터 본문. 유형 정확 매칭이 없으면
    // 미지정(전체 대상) 뉴스레터로 폴백. (가장 최근 것)
    let nl = await prisma.newsletter.findFirst({
      where: { companyId: participant.companyId, leadershipType: participant.leadershipType },
      orderBy: { createdAt: 'desc' },
    });
    if (!nl) {
      nl = await prisma.newsletter.findFirst({
        where: { companyId: participant.companyId, leadershipType: { in: ['미지정', ''] } },
        orderBy: { createdAt: 'desc' },
      });
    }
    const newsletter = nl
      ? { ...nl, createdAt: nl.createdAt.toISOString().slice(0, 10), updatedAt: nl.updatedAt.toISOString().slice(0, 10) }
      : null;

    // 본인의 실제 응답 기록(마이페이지 활동 내역용) — 최신순. 다른 참여자 데이터는 포함하지 않음.
    const responseRows = await prisma.participantResponse.findMany({
      where: { participantId: participant.id },
      orderBy: { updatedAt: 'desc' },
      select: { kind: true, elementKey: true, roundIndex: true, response: true, updatedAt: true },
    });
    const responses = responseRows.map(r => ({
      kind: r.kind,
      elementKey: r.elementKey,
      roundIndex: r.roundIndex,
      response: r.response,
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      participant,
      newsletter,
      responses,
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
