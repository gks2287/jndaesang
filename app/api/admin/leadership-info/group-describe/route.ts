import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';

type TypeInfo = { type: string; definition?: string; characteristics?: string; developmentPoints?: string };
type GroupInput = { key: string; types: string[]; typeInfos: TypeInfo[] };
type GroupDescription = { summary: string; characteristics: string; developmentPoints: string };

const SYSTEM_PROMPT = `당신은 조직 리더십 코칭 콘텐츠 기획자입니다.
여러 리더십 유형을 하나로 묶은 '그룹'에 대해, 각 유형의 학습된 정보를 종합해 그룹 단위 설명을 도출합니다.
반드시 제공된 유형 정보에 근거한 내용만 사용하고, 문서에 없는 내용은 절대 지어내지 마세요.
유형 이름은 제공된 워딩을 그대로 사용하고 임의로 바꾸지 마세요.`;

function buildPrompt(companyName: string, groups: GroupInput[]): string {
  const groupsBlock = groups
    .map((g, gi) => {
      const infos = g.typeInfos
        .filter(i => i.type?.trim())
        .map(
          i =>
            `  - ${i.type}\n` +
            (i.definition?.trim() ? `    · 정의: ${i.definition}\n` : '') +
            (i.characteristics?.trim() ? `    · 특성: ${i.characteristics}\n` : '') +
            (i.developmentPoints?.trim() ? `    · 개발 포인트: ${i.developmentPoints}\n` : ''),
        )
        .join('');
      return `[그룹 ${gi + 1}] key: ${g.key}\n구성 유형: ${g.types.join(', ')}\n유형 정보:\n${infos || '  (제공된 정보 없음)'}`;
    })
    .join('\n\n');

  return `기업명: ${companyName}
아래 각 그룹에 대해, 구성 유형들의 정보를 종합한 그룹 단위 설명을 도출하세요.

[도출 규칙]
- summary: 그룹을 한 문장으로 요약/정의 (구성 유형들의 공통 리더십 성향 기준).
- characteristics: 그룹의 특성을 2~3문장으로 종합. 여러 유형이면 공통 주제를 묶고, 단일 유형이면 그 유형 특성을 그룹 관점으로 정리.
- developmentPoints: 그룹의 개발 포인트/코칭 방향을 1~2문장으로 종합.
- 제공된 유형 정보에 근거한 내용만 쓰고, 없는 내용은 지어내지 마세요. 정보가 부족하면 있는 범위 내에서 간결히 작성.

[그룹 목록]
${groupsBlock}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 금지. key는 위에 제시된 그룹 key를 그대로 사용:
{"descriptions":{"<key>":{"summary":"...","characteristics":"...","developmentPoints":"..."}}}`;
}

export async function POST(req: NextRequest) {
  try {
    const { companyName, groups } = (await req.json()) as {
      companyName?: string;
      groups?: GroupInput[];
    };

    const validGroups = (groups ?? []).filter(g => g?.key && Array.isArray(g.types) && g.types.length > 0);
    if (validGroups.length === 0) {
      return NextResponse.json({ error: '설명을 생성할 그룹이 없습니다.' }, { status: 400 });
    }

    const raw = await callClaude(buildPrompt(companyName?.trim() || '대상 기업', validGroups), SYSTEM_PROMPT);
    const parsed = safeParseJson<{ descriptions: Record<string, GroupDescription> }>(raw);

    // 응답을 요청한 그룹 key 기준으로만 정리 (누락 key는 빈 값으로 채우지 않고 생략)
    const out: Record<string, GroupDescription> = {};
    for (const g of validGroups) {
      const d = parsed.descriptions?.[g.key];
      if (!d) continue;
      out[g.key] = {
        summary: (d.summary ?? '').trim(),
        characteristics: (d.characteristics ?? '').trim(),
        developmentPoints: (d.developmentPoints ?? '').trim(),
      };
    }

    return NextResponse.json({ descriptions: out });
  } catch (err) {
    console.error('[admin/leadership-info/group-describe]', err);
    return NextResponse.json({ error: '그룹 설명 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
