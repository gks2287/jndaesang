import { NextRequest, NextResponse } from 'next/server';

type Topic = { title: string; description: string; reason: string };

const MOCK_TOPICS: Record<string, Topic[]> = {
  '독재형': [
    {
      title: '지시에서 영향력으로: 권위 대신 신뢰를 선택하라',
      description: '명령이 아닌 동기부여로 팀을 이끄는 리더십 전환 방법을 다룹니다.',
      reason: '독재형 리더는 지시·명령 중심의 소통으로 팀원의 자발성을 낮추는 경향이 있습니다. 강제력이 아닌 신뢰 기반 영향력으로 전환할 때 팀 몰입도와 성과가 함께 높아집니다.',
    },
    {
      title: '심리적 안전감이 만드는 고성과 팀',
      description: '두려움 없이 의견을 말할 수 있는 팀 환경을 구축하는 실전 전략을 소개합니다.',
      reason: '독재형 리더 아래에서는 팀원이 비판이나 실수를 두려워해 중요한 정보와 아이디어가 공유되지 않습니다. 심리적 안전감 구축이 이 패턴을 바꾸는 핵심입니다.',
    },
    {
      title: '위임의 기술: 통제에서 자율로',
      description: '팀원의 자율성을 높이고 리더의 역할을 재정의하는 위임 프레임워크를 제시합니다.',
      reason: '독재형 리더는 모든 것을 직접 결정·통제하려는 경향이 강합니다. 적절한 위임을 통해 팀원의 역량을 끌어올리고 리더 본인의 번아웃도 예방할 수 있습니다.',
    },
  ],
  '방관형': [
    {
      title: '존재감 있는 리더십: 팀을 이끄는 리더의 역할',
      description: '소극적 태도에서 벗어나 팀에 방향을 제시하는 리더십 행동 변화를 다룹니다.',
      reason: '방관형 리더는 팀 운영에 적극적으로 개입하지 않아 방향성이 불분명해지고 팀원이 혼란을 겪습니다. 리더의 적극적 존재감이 팀 안정감과 신뢰를 높입니다.',
    },
    {
      title: '피드백 문화 만들기: 지금 당장 시작하는 법',
      description: '정기적이고 건설적인 피드백을 통해 팀 성장을 이끄는 실천 방법을 소개합니다.',
      reason: '방관형 리더는 피드백 제공을 꺼리거나 미루는 경향이 있어 팀원이 성장 기회를 놓치게 됩니다. 작은 피드백 습관부터 시작해 팀 성장을 이끌 수 있습니다.',
    },
    {
      title: '갈등을 기회로: 리더의 조정 역할',
      description: '팀 내 갈등 상황에서 리더가 적극적으로 개입하고 조율하는 방법을 제시합니다.',
      reason: '방관형 리더는 팀 내 갈등에 개입을 꺼려 문제가 방치되고 팀 분위기가 악화되는 경우가 많습니다. 갈등을 성장의 기회로 전환하는 개입 방법을 다룹니다.',
    },
  ],
  '성과압박형': [
    {
      title: '지속 가능한 성과: 번아웃 없는 팀 만들기',
      description: '단기 성과보다 장기적 팀 역량 유지를 위한 균형 잡힌 리더십을 다룹니다.',
      reason: '성과압박형 리더는 단기 결과에 집중한 나머지 팀원의 번아웃과 이탈을 야기합니다. 지속 가능한 성과 구조를 만드는 것이 장기적으로 더 높은 성과를 냅니다.',
    },
    {
      title: '과정을 보는 리더십: 결과만이 전부가 아니다',
      description: '성과 지표 너머 팀원의 성장 과정을 함께 살피는 리더십 관점을 소개합니다.',
      reason: '성과압박형 리더는 숫자와 결과에만 집중해 팀원의 노력과 성장을 간과하기 쉽습니다. 과정을 인정하는 피드백이 팀원의 동기와 자발성을 높입니다.',
    },
    {
      title: '코칭 리더십: 답을 주지 말고 질문하라',
      description: '팀원 스스로 해답을 찾게 하는 코칭 기반 리더십 대화법을 제시합니다.',
      reason: '성과압박형 리더는 빠른 결과를 위해 지시 위주로 소통하는 경향이 있습니다. 코칭 질문을 통해 팀원의 자발적 문제 해결력을 키우면 성과도 함께 높아집니다.',
    },
  ],
  '불통형': [
    {
      title: '경청이 만드는 신뢰의 리더십',
      description: '말하기보다 듣기를 통해 팀원과의 신뢰를 쌓는 경청 기술을 다룹니다.',
      reason: '불통형 리더는 자신의 의견을 일방적으로 전달하고 팀원의 말을 충분히 듣지 않는 경향이 있습니다. 경청은 소통 문제를 해결하는 가장 빠른 출발점입니다.',
    },
    {
      title: '1on1 미팅으로 소통 격차 좁히기',
      description: '정기적인 1대1 대화를 통해 팀원과의 거리를 좁히는 실전 운영법을 소개합니다.',
      reason: '불통형 리더와 팀원 사이에는 정보 격차와 심리적 거리가 생기기 쉽습니다. 정기적 1on1은 개별 소통 채널을 열고 신뢰를 쌓는 가장 효과적인 방법입니다.',
    },
    {
      title: '소통 채널 다각화: 상황에 맞는 커뮤니케이션',
      description: '회의, 메신저, 보고서 등 다양한 채널을 상황에 맞게 활용하는 전략을 제시합니다.',
      reason: '불통형 리더는 특정 소통 방식만 고집해 다양한 팀원의 소통 스타일을 수용하지 못하는 경우가 많습니다. 채널을 다양화하면 소통 빈도와 질이 모두 높아집니다.',
    },
  ],
  '불명확형': [
    {
      title: '명확한 방향 제시: 팀이 움직이게 하는 리더의 언어',
      description: '모호한 지시를 구체적인 기대치로 전환하는 커뮤니케이션 방법을 다룹니다.',
      reason: '불명확형 리더의 모호한 지시는 팀원이 우선순위를 잡지 못하고 에너지를 낭비하게 만듭니다. 구체적이고 명확한 언어로 방향을 제시하는 것이 팀 효율의 핵심입니다.',
    },
    {
      title: '목표 설정과 우선순위: OKR 실전 적용',
      description: '팀의 에너지를 집중시키는 목표 설정 프레임워크와 우선순위 정렬 방법을 소개합니다.',
      reason: '불명확형 리더는 목표와 기준이 자주 바뀌어 팀원이 무엇에 집중해야 할지 모르는 상황을 만듭니다. OKR 같은 구조화된 목표 설정이 혼란을 줄여줍니다.',
    },
    {
      title: '기대치 정렬: 오해 없는 팀 운영의 시작',
      description: '리더와 팀원 간 기대치 불일치를 해소하고 명확한 역할 정의를 하는 방법을 제시합니다.',
      reason: '불명확형 리더로 인해 팀원은 "잘 하고 있는지" 기준을 알 수 없어 불안감이 높아집니다. 기대치를 명확히 합의하면 팀원의 자신감과 실행력이 높아집니다.',
    },
  ],
  '감정기복형': [
    {
      title: '감정 지능(EQ)으로 리더십 안정화',
      description: '자신의 감정을 인식하고 조절하는 EQ 역량이 리더십에 미치는 영향을 다룹니다.',
      reason: '감정기복형 리더는 기분에 따라 반응이 달라져 팀원이 눈치를 보며 소극적으로 행동하게 됩니다. 감정 인식과 조절 능력을 높이는 것이 이 패턴 개선의 출발점입니다.',
    },
    {
      title: '스트레스 상황에서 침착함 유지하기',
      description: '위기 상황에서도 일관된 리더십을 발휘하는 자기조절 전략과 루틴을 소개합니다.',
      reason: '감정기복형 리더의 감정 변화는 위기 상황에서 더 두드러져 팀 전체의 불안을 증폭시킵니다. 리더의 침착함은 팀의 심리적 안정과 위기 대응력에 직접 영향을 줍니다.',
    },
    {
      title: '리더의 감정이 팀 문화를 만든다',
      description: '리더의 감정 표현이 팀 분위기와 성과에 미치는 영향과 건강한 감정 표현법을 제시합니다.',
      reason: '감정기복형 리더의 부정적 감정 표현은 팀 전체 분위기를 좌우하며 심리적 안전감을 낮춥니다. 감정 표현의 방식을 바꾸는 것만으로도 팀 문화가 크게 개선됩니다.',
    },
  ],
};

const DEFAULT_TOPICS: Topic[] = [
  {
    title: '리더십 역량 개발의 첫 걸음',
    description: '자기 인식에서 시작하는 리더십 성장의 기초를 다룹니다.',
    reason: '효과적인 리더십 개선은 자신의 현재 패턴을 인식하는 데서 시작합니다.',
  },
  {
    title: '팀을 성장시키는 리더의 역할',
    description: '팀원의 역량 개발을 지원하는 리더십 접근법을 소개합니다.',
    reason: '리더의 핵심 역할 중 하나는 팀원이 스스로 성장할 수 있는 환경을 만드는 것입니다.',
  },
  {
    title: '변화를 이끄는 리더십 전략',
    description: '조직 변화 상황에서 팀을 효과적으로 이끄는 방법을 제시합니다.',
    reason: '불확실한 환경에서 팀이 방향을 잃지 않도록 리더가 변화를 주도하는 역할이 중요합니다.',
  },
];

export async function POST(req: NextRequest) {
  const { leadershipTypes, companyName, kind } = await req.json() as {
    leadershipTypes: string[];
    companyName: string;
    kind: string;
  };

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const types = leadershipTypes?.filter(Boolean) ?? [];
    let topics: Topic[];
    if (types.length === 0) {
      topics = DEFAULT_TOPICS.slice(0, 2);
    } else if (types.length === 1) {
      topics = (MOCK_TOPICS[types[0]] ?? DEFAULT_TOPICS).slice(0, 2);
    } else {
      // 유형이 여러 개면 각 유형에서 1개씩 뽑아 최대 2개
      topics = types
        .slice(0, 2)
        .map(t => (MOCK_TOPICS[t] ?? DEFAULT_TOPICS)[0]);
    }
    return NextResponse.json({ topics, source: 'mock' });
  }

  const typeLabel = leadershipTypes?.join(', ') ?? '리더십';
  const prompt = `당신은 기업 리더십 교육 뉴스레터 기획자입니다.
${companyName} 기업의 ${typeLabel} 유형(${kind}) 리더를 대상으로 하는 맞춤형 뉴스레터 주제 2가지를 제안해주세요.
각 주제는 4-5분 분량의 뉴스레터로 다룰 수 있어야 하며, 실용적이고 행동 가능한 내용이어야 합니다.
reason 필드에는 "${typeLabel} 유형"의 구체적인 특성과 문제 패턴을 언급하며, 왜 이 주제가 해당 유형의 리더에게 필요한지 2-3문장으로 설명해주세요.
반드시 다음 JSON 형식으로만 응답해주세요:
{"topics": [{"title": "주제명", "description": "한 줄 설명", "reason": "이 유형에 추천하는 이유 2-3문장"}, ...]}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const parsed = JSON.parse(data.choices[0].message.content) as { topics: Topic[] };
    return NextResponse.json({ topics: parsed.topics, source: 'openai' });
  } catch (err) {
    console.error('OpenAI API failed:', err);
    return NextResponse.json({ error: 'AI 추천 실패' }, { status: 500 });
  }
}
