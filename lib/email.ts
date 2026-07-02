import { Resend } from 'resend';
import type { GeneratedNewsletter } from '@/components/newsletter/NewsletterRender';

const resend = new Resend(process.env.RESEND_API_KEY);

// 발신 주소 — 인증된 도메인 사용. 환경변수가 비었거나 Resend가 거부하는 형식('&' 포함 등)이면 안전한 plain 기본값 사용.
const RAW_FROM = (process.env.RESEND_FROM_EMAIL ?? '').trim();
const FROM_EMAIL = RAW_FROM && RAW_FROM.includes('@') && !RAW_FROM.includes('&')
  ? RAW_FROM
  : 'newsletter@jnhrcompany.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** 요약본 이메일 HTML 생성 */
export function buildEmailHtml(generated: GeneratedNewsletter, opts: { vol: number; dateLabel: string; participantName: string; token?: string }): string {
  const { vol, dateLabel, participantName, token } = opts;
  const fullUrl = token ? `${APP_URL}/newsletter/${token}` : APP_URL;
  const mypageUrl = token ? `${APP_URL}/newsletter/${token}/mypage` : APP_URL;

  const sectionCards = generated.sections.map(sec => `
    <tr><td style="padding:0 0 12px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px">
        <tr><td style="padding:16px">
          <span style="display:inline-block;font-size:10px;font-weight:700;color:#2B9EE8;background:#EAF4FC;padding:2px 8px;border-radius:20px;margin-bottom:8px">📌 리더십 인사이트</span>
          <p style="margin:0;font-size:14px;font-weight:700;color:#2C2C2C;line-height:1.5">${sec.emoji} ${escapeHtml(sec.contentTitle)}</p>
          <p style="margin:6px 0 0;font-size:14px;color:#6B7280;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(sec.summary ?? sec.intro ?? sec.body?.[0] ?? sec.mainBody ?? '')}</p>
        </td></tr>
      </table>
    </td></tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(generated.subject)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6">
<tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:448px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">

  <!-- 헤더 -->
  <tr><td style="padding:32px 24px 8px;text-align:center">
    <img src="${APP_URL}/logo-jc.png" alt="J&Company" height="48" style="display:block;margin:0 auto">
    <p style="margin:8px 0 0;font-size:11px;color:#9CA3AF">Vol.${vol}${dateLabel ? ` · ${escapeHtml(dateLabel)}` : ''}</p>
  </td></tr>

  <!-- 인사말 -->
  <tr><td style="padding:16px 24px 0;text-align:center">
    <p style="margin:0;font-size:13px;color:#6B7280">${escapeHtml(participantName)}님을 위한 리더십 인사이트</p>
  </td></tr>

  <!-- 헤드라인 + 인트로 -->
  <tr><td style="padding:20px 24px 0;text-align:center">
    <span style="display:inline-block;font-size:10px;font-weight:700;color:#2B9EE8;background:#EAF4FC;padding:4px 10px;border-radius:20px;margin-bottom:12px">📌 리더십 인사이트</span>
    <h1 style="margin:0;font-size:20px;font-weight:700;color:#2C2C2C;line-height:1.4">${escapeHtml(generated.headline)}</h1>
    <p style="margin:12px 0 0;font-size:14px;color:#6B7280;line-height:1.7">${escapeHtml(generated.intro)}</p>
  </td></tr>

  <!-- CTA 버튼 -->
  <tr><td style="padding:20px 24px 0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td>
        <a href="${fullUrl}" style="display:block;padding:14px;background:#2B9EE8;color:#FFFFFF;text-align:center;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px">전체 뉴스레터 읽기 →</a>
      </td></tr>
      <tr><td style="padding-top:10px">
        <a href="${mypageUrl}" style="display:block;padding:14px;background:#FFFFFF;border:1px solid #2B9EE8;color:#2B9EE8;text-align:center;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px">마이페이지 바로가기</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- 콘텐츠 미리보기 -->
  <tr><td style="padding:32px 24px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F3F4F6;padding-top:24px">
      <tr><td style="padding:0 0 16px">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="border-left:4px solid #2B9EE8;padding-left:12px">
            <span style="font-size:16px;vertical-align:middle">📰</span>
            <span style="font-size:16px;font-weight:600;color:#2C2C2C;vertical-align:middle;margin-left:4px">이번 호에서 다룰 내용</span>
          </td>
        </tr></table>
      </td></tr>
      ${sectionCards}
    </table>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="padding:20px 24px;border-top:1px solid #F3F4F6">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${APP_URL}/logo-jc.png" alt="J&Company" height="20" style="opacity:0.7"></td>
      <td style="text-align:right">
        <a href="${mypageUrl}" style="font-size:12px;color:#6B7280;text-decoration:none;margin-left:16px">마이페이지</a>
        <a href="mailto:support@jcompany.co.kr" style="font-size:12px;color:#6B7280;text-decoration:none;margin-left:16px">문의하기</a>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface SendNewsletterParams {
  to: string;
  participantName: string;
  subject: string;
  html: string;
}

/** 단건 이메일 발송 */
export async function sendNewsletterEmail(params: SendNewsletterParams) {
  const { data, error } = await resend.emails.send({
    from: `J&Company <${FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) throw new Error(error.message);
  return data;
}

/** 다건 이메일 일괄 발송 (Resend batch — 최대 100건) */
export async function sendNewsletterBatch(items: SendNewsletterParams[]): Promise<{ data: unknown[] }> {
  if (items.length === 0) return { data: [] };
  if (items.length > 100) {
    const results: unknown[] = [];
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100);
      const res = await sendNewsletterBatch(chunk);
      results.push(...(res.data ?? []));
    }
    return { data: results };
  }

  const { data, error } = await resend.batch.send(
    items.map(item => ({
      from: `J&Company <${FROM_EMAIL}>`,
      to: item.to,
      subject: item.subject,
      html: item.html,
    }))
  );

  if (error) throw new Error(error.message);
  return { data: data ? [data] : [] };
}
