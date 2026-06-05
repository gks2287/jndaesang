import { NextResponse } from 'next/server';
import { buildEmailHtml, sendNewsletterBatch, type SendNewsletterParams } from '@/lib/email';
import type { GeneratedNewsletter } from '@/components/newsletter/NewsletterRender';

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
