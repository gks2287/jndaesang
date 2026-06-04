import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';

export async function POST(req: NextRequest) {
  try {
    const { question, type, responses } = await req.json() as {
      question: string;
      type: string;
      responses: string[];
    };

    const responseList = responses.map((r, i) => `${i + 1}. ${r}`).join('\n');

    const prompt = `다음은 리더십 코칭 프로그램 참여자들의 응답입니다.

[질문 유형]: ${type}
[질문]: ${question}

[응답 목록]:
${responseList}

위 응답들을 분석하여 3~4문장으로 간결하게 요약해주세요.
- 응답자들 사이에서 공통적으로 나타나는 패턴이나 경향
- 눈에 띄는 키워드나 주제
- 전반적인 분위기나 인식 수준
요약 결과만 출력하고, 머리말이나 부연 설명은 붙이지 마세요.`;

    const summary = await callClaude(
      prompt,
      '당신은 HR 데이터 분석 전문가입니다. 리더십 코칭 응답 데이터를 분석하여 간결하고 통찰력 있는 요약을 제공합니다.',
    );

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[summarize-responses]', err);
    return NextResponse.json({ error: '요약 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
