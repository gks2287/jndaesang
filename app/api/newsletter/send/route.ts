import { NextResponse } from 'next/server';
import { buildEmailHtml, sendNewsletterBatch, type SendNewsletterParams } from '@/lib/email';
import type { GeneratedNewsletter } from '@/components/newsletter/NewsletterRender';
import { prisma } from '@/lib/db';

interface Recipient {
  email: string;
  name: string;
  token?: string;
}

interface RoundPayload {
  vol: number;
  dateLabel: string;
  generated: GeneratedNewsletter;
}

interface SendRequest {
  recipients: Recipient[];
  round: RoundPayload;
  companyName: string;
}

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY가 설정되지 않았습니다. .env.local에 API 키를 추가하세요.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SendRequest;
    const { recipients, round, companyName } = body;

    if (!recipients?.length) {
      return NextResponse.json({ error: '수신자가 없습니다.' }, { status: 400 });
    }
    if (!round?.generated) {
      return NextResponse.json({ error: '발송할 뉴스레터 콘텐츠가 없습니다.' }, { status: 400 });
    }

    const items: SendNewsletterParams[] = recipients.map(r => ({
      to: r.email,
      participantName: r.name,
      subject: `[${companyName}] ${round.generated.subject} (Vol.${round.vol})`,
      html: buildEmailHtml(round.generated, {
        vol: round.vol,
        dateLabel: round.dateLabel,
        participantName: r.name,
        token: r.token,
      }),
    }));

    const result = await sendNewsletterBatch(items);

    // 발송 성공 → 각 수신 직책자의 진행 상태 갱신 (발송된 회차까지 접근 가능하도록)
    await Promise.all(recipients.map(async (r) => {
      if (!r.token) return;
      try {
        let p = await prisma.participant.findFirst({ where: { token: r.token } });
        if (!p && r.token.startsWith('nl-')) {
          const id = Number(r.token.slice(3));
          if (Number.isInteger(id)) {
            const byId = await prisma.participant.findUnique({ where: { id } });
            if (byId && !byId.token) p = byId;
          }
        }
        if (!p) return;
        const nextStep = Math.min(p.stepTotal, Math.max(p.stepCurrent, round.vol));
        await prisma.participant.update({
          where: { id: p.id },
          data: { stepCurrent: nextStep, deliveryStatus: p.deliveryStatus === '미발송' ? '발송완료' : p.deliveryStatus },
        });
      } catch (e) {
        console.error('[newsletter/send] participant 업데이트 실패:', e);
      }
    }));

    return NextResponse.json({
      success: true,
      sent: items.length,
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '이메일 발송 중 오류가 발생했습니다.';
    console.error('[newsletter/send] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
