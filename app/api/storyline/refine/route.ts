import { NextRequest, NextResponse } from 'next/server';
import { type StorylineStep } from '@/lib/storyline';

function mockRefine(storyline: StorylineStep[], prompt: string): StorylineStep[] {
  let result = storyline.map(s => ({ ...s }));

  // "X를/을 Y로/으로 바꿔/변경/수정" 패턴 → title 또는 subtitle 교체
  const replaceMatch = prompt.match(/(.+?)[을를]\s*(.+?)(?:으로|로)\s*(?:바꿔|변경|수정)/);
  if (replaceMatch) {
    const from = replaceMatch[1].trim();
    const to = replaceMatch[2].trim();
    result = result.map(s => ({
      ...s,
      title: s.title === from ? to : s.title,
      subtitle: s.subtitle === from ? to : s.subtitle,
    }));
  }

  // "N단계로 줄이기/늘리기" 패턴 → 단계 수 조정
  const countMatch = prompt.match(/(\d+)\s*단계/);
  if (countMatch) {
    const target = parseInt(countMatch[1]);
    if (target >= 2 && target <= 10) {
      if (target < result.length) {
        result = result.slice(0, target);
      } else {
        while (result.length < target) {
          result.push({ step: result.length + 1, title: `${result.length + 1}단계`, subtitle: '', description: '' });
        }
      }
    }
  }

  return result.map((s, i) => ({ ...s, step: i + 1 }));
}

export async function POST(req: NextRequest) {
  const { currentStoryline, prompt } = await req.json() as {
    currentStoryline: StorylineStep[];
    prompt: string;
  };

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ storyline: mockRefine(currentStoryline, prompt), source: 'mock' });
  }

  const systemPrompt = `당신은 기업 리더십 코칭 뉴스레터 콘텐츠 전략가입니다.
현재 스토리라인 구조와 사용자의 수정 요청을 바탕으로 새로운 스토리라인을 제안해주세요.
반드시 아래 JSON 형식으로만 응답하세요:
{"storyline": [{"step": 1, "title": "단계명", "subtitle": "부제", "description": "설명"}, ...]}`;

  const userMessage = `현재 스토리라인:
${JSON.stringify(currentStoryline, null, 2)}

수정 요청: ${prompt}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(data.choices[0].message.content) as { storyline: StorylineStep[] };
    return NextResponse.json({ storyline: parsed.storyline, source: 'openai' });
  } catch (err) {
    console.error('OpenAI API failed:', err);
    return NextResponse.json({ error: 'AI 수정 실패' }, { status: 500 });
  }
}
