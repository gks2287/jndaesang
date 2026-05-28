import { NextRequest, NextResponse } from 'next/server';
import type { ContentItem } from '@/lib/content';

const MOCK_POOL: ContentItem[] = [
  {
    id: 'c1',
    title: '리더십 자기인식 — 내가 모르는 나의 리더십',
    type: '글',
    url: 'https://example.com/articles/self-awareness',
    readingTime: 3,
    description: '자기인식이 부족한 리더가 조직에 미치는 영향과 개선 방법을 다룹니다.',
    tags: ['자기인식', '리더십'],
  },
  {
    id: 'c2',
    title: '독재형 리더의 변화 — 구글 Project Oxygen 사례',
    type: '글',
    url: 'https://example.com/articles/project-oxygen',
    readingTime: 4,
    description: '명령통제 방식에서 코칭형 리더십으로 전환한 구글의 연구 결과를 소개합니다.',
    tags: ['독재형', '코칭', '사례'],
  },
  {
    id: 'c3',
    title: '피드백 루프 — 효과적인 1:1 대화법',
    type: '영상',
    url: 'https://example.com/videos/feedback-loop',
    readingTime: 5,
    description: '심리적 안전감을 높이는 1:1 미팅 진행 방법을 영상으로 설명합니다.',
    tags: ['피드백', '1:1', '소통'],
  },
  {
    id: 'c4',
    title: '감정 조절 리더십 — 아미그달라 하이재킹 극복',
    type: '영상',
    url: 'https://example.com/videos/emotional-regulation',
    readingTime: 4,
    description: '스트레스 상황에서 감정적 반응을 조절하는 뇌과학 기반 기법을 소개합니다.',
    tags: ['감정기복형', '감정조절'],
  },
  {
    id: 'c5',
    title: '리더십 유형 자가진단 체크리스트',
    type: '인포그래픽',
    url: 'https://example.com/infographics/leadership-diagnosis',
    readingTime: 2,
    description: '5가지 부정적 리더십 유형의 징후를 한눈에 확인할 수 있는 체크리스트입니다.',
    tags: ['진단', '체크리스트'],
  },
  {
    id: 'c6',
    title: '심리적 안전감 구축 4단계',
    type: '인포그래픽',
    url: 'https://example.com/infographics/psychological-safety',
    readingTime: 2,
    description: 'Timothy Clark의 심리적 안전감 4단계 모델을 인포그래픽으로 정리했습니다.',
    tags: ['심리적안전감', '조직문화'],
  },
  {
    id: 'c7',
    title: '성과압박형 리더십의 명암',
    type: '카드뉴스',
    url: 'https://example.com/cardnews/performance-pressure',
    readingTime: 3,
    description: '단기 성과는 높지만 번아웃을 유발하는 성과압박형 리더십의 특징과 개선 방향.',
    tags: ['성과압박형', '번아웃'],
  },
  {
    id: 'c8',
    title: '소통 단절이 만드는 조직 문제',
    type: '카드뉴스',
    url: 'https://example.com/cardnews/communication-gap',
    readingTime: 3,
    description: '불통형 리더십으로 인한 정보 단절이 팀 성과에 미치는 영향을 카드뉴스로 요약.',
    tags: ['불통형', '소통'],
  },
  {
    id: 'c9',
    title: '위임의 기술 — 방관형 리더에서 임파워링 리더로',
    type: '글',
    url: 'https://example.com/articles/delegation',
    readingTime: 5,
    description: '방치와 위임을 구분하고 적절한 권한 이양을 통해 팀을 성장시키는 방법.',
    tags: ['방관형', '위임', '임파워링'],
  },
  {
    id: 'c10',
    title: '리더의 역할 재정의 — 관리자 vs 코치',
    type: '영상',
    url: 'https://example.com/videos/manager-vs-coach',
    readingTime: 4,
    description: '마이크로매니지먼트를 벗어나 코칭 리더십으로 전환하는 실전 사례를 다룹니다.',
    tags: ['코칭', '마이크로매니지먼트'],
  },
  {
    id: 'c11',
    title: '명확한 기대치 설정법 — OKR과 리더십',
    type: '글',
    url: 'https://example.com/articles/okr-leadership',
    readingTime: 3,
    description: '불명확형 리더십 개선을 위한 목표 설정 프레임워크 적용 가이드.',
    tags: ['불명확형', 'OKR', '목표설정'],
  },
  {
    id: 'c12',
    title: '팀원 동기부여 — 내재적 동기 vs 외재적 동기',
    type: '인포그래픽',
    url: 'https://example.com/infographics/motivation',
    readingTime: 2,
    description: '다니엘 핑크의 동기이론을 바탕으로 리더가 팀원 동기를 높이는 방법을 정리.',
    tags: ['동기부여', '자율성'],
  },
  {
    id: 'c13',
    title: '리더십 전환 30일 챌린지',
    type: '카드뉴스',
    url: 'https://example.com/cardnews/30-day-challenge',
    readingTime: 3,
    description: '매일 하나씩 실천할 수 있는 리더십 행동 변화 미션 30가지.',
    tags: ['실천', '변화', '습관'],
  },
  {
    id: 'c14',
    title: '360도 피드백 활용 가이드',
    type: '글',
    url: 'https://example.com/articles/360-feedback',
    readingTime: 4,
    description: '다면진단 결과를 팀 성장에 연결하는 피드백 대화 설계 방법.',
    tags: ['다면진단', '피드백', '성장'],
  },
  {
    id: 'c15',
    title: '갈등 해결 리더십 — TKI 모델 적용',
    type: '영상',
    url: 'https://example.com/videos/conflict-resolution',
    readingTime: 5,
    description: 'Thomas-Kilmann 갈등 모델을 활용해 팀 내 갈등을 건설적으로 해결하는 방법.',
    tags: ['갈등해결', '소통'],
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.toLowerCase() ?? '';
  const type = searchParams.get('type') ?? '';

  let items = MOCK_POOL;

  if (type) {
    items = items.filter((item) => item.type === type);
  }

  if (query) {
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }

  return NextResponse.json({ items });
}
