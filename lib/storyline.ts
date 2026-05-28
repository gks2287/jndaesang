export interface StorylineStep {
  step: number;
  title: string;
  subtitle: string;
  description: string;
}

export const DEFAULT_STORYLINE: StorylineStep[] = [
  {
    step: 1,
    title: '수용',
    subtitle: '성찰과 인정',
    description: '진단 결과에 대한 심리적 저항을 낮추고 데이터를 성장의 신호로 수용하는 콘텐츠',
  },
  {
    step: 2,
    title: '분석',
    subtitle: 'Gap 줄이기',
    description: '주관식 피드백과 세부 문항 분석을 통해 나의 강약점과 팀의 기대를 연결하는 콘텐츠',
  },
  {
    step: 3,
    title: '실행',
    subtitle: 'Small Win',
    description: '리더 스스로의 데이터 분석을 바탕으로 현장에서 즉시 실행 가능한 단기 행동 미션 제시',
  },
  {
    step: 4,
    title: '유지',
    subtitle: '습관화',
    description: '실행 과정에서의 고충을 케어하고, 긍정적 변화를 지속적인 습관으로 정착시키는 콘텐츠',
  },
  {
    step: 5,
    title: '확장',
    subtitle: '재준비',
    description: '1년의 변화 과정을 복기하고 차기 진단을 준비하며 리더십 자신감을 고취하는 콘텐츠',
  },
];

export const STEP_COLORS = [
  { badge: 'bg-emerald-500', cardBg: 'bg-emerald-50', border: 'border-emerald-200', titleColor: 'text-emerald-700', subtitleColor: 'text-emerald-600' },
  { badge: 'bg-blue-500',    cardBg: 'bg-blue-50',    border: 'border-blue-200',    titleColor: 'text-blue-700',    subtitleColor: 'text-blue-600' },
  { badge: 'bg-orange-500',  cardBg: 'bg-orange-50',  border: 'border-orange-200',  titleColor: 'text-orange-700',  subtitleColor: 'text-orange-600' },
  { badge: 'bg-purple-500',  cardBg: 'bg-purple-50',  border: 'border-purple-200',  titleColor: 'text-purple-700',  subtitleColor: 'text-purple-600' },
  { badge: 'bg-teal-500',    cardBg: 'bg-teal-50',    border: 'border-teal-200',    titleColor: 'text-teal-700',    subtitleColor: 'text-teal-600' },
] as const;
