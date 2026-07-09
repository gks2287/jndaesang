import { prisma } from '@/lib/db';

// AI 프롬프트에 주입하는 원문 상한 — 컨텍스트 초과 방지 (한글 기준 약 5만 자)
const MAX_RAW_TEXT_CHARS = 50000;

// 기업+연도의 최신 리더십 정보 버전에서 다면진단 보고서 원문을 조회.
// 원문이 없으면(직접 입력, 구버전 데이터 등) 빈 문자열 → 호출부는 기존 요약 기반으로 동작.
export async function getLeadershipRawText(companyId?: number, year?: number): Promise<string> {
  if (!Number.isInteger(companyId) || !Number.isInteger(year)) return '';
  try {
    const latest = await prisma.leadershipInfoVersion.findFirst({
      where: { companyId, year },
      orderBy: { createdAt: 'desc' },
      select: { rawText: true },
    });
    return (latest?.rawText ?? '').trim().slice(0, MAX_RAW_TEXT_CHARS);
  } catch (err) {
    console.error('[getLeadershipRawText]', err);
    return '';
  }
}

// 원문을 프롬프트 블록으로 포장. 원문이 없으면 빈 문자열.
export function buildRawTextBlock(rawText: string): string {
  if (!rawText) return '';
  return `\n\n[다면진단 보고서 원문 — 위 유형 요약보다 우선하는 근거 자료]\n${rawText}\n(위 원문에 실제로 서술된 내용을 근거로 작성하세요. 원문과 유형 요약이 다르면 원문을 우선하되, 원문에 없는 내용은 지어내지 마세요.)`;
}
