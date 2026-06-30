import { create } from 'zustand';
import type { SavedNewsletterContent } from '@/components/newsletter/NewsletterRender';

export type NewsletterStatus = '제작 중' | '제작완료';

export interface Newsletter {
  id: number;
  title: string;
  companyId: number;
  companyName: string;
  leadershipType: string;
  status: NewsletterStatus;
  stepCount: number;
  positiveLeaders: { types: string[]; count: number };
  negativeLeaders: { types: string[]; count: number };
  totalRounds: number;
  completedRounds: number;
  type: 'general' | 'custom';
  leaderType: 'positive' | 'negative';
  totalLeaders: number;
  createdAt: string;
  updatedAt: string;
  savedRounds?: number[];
  // 제작완료 시 저장되는 회차별 생성 본문 (전체본문 + 요약본 미리보기용)
  generatedContent?: SavedNewsletterContent;
}

// 썸네일 — 새 디자인의 오버레이 히어로/섹션 이미지를 채우기 위한 안정적 목업 URL
const T = (seed: string) => `https://picsum.photos/seed/${seed}/1200/675`;

export const MOCK_GENERATED_CONTENT_1: import('@/components/newsletter/NewsletterRender').SavedNewsletterContent = {
  rounds: [
    {
      vol: 1,
      dateLabel: '2026년 4월 28일',
      leadershipLabel: '독재형',
      interactions: ['quiz', 'selfcheck'],
      surveys: ['always'],
      generated: {
        subject: '[1회차] 나는 왜 모든 결정을 혼자 내리는가',
        headline: '지시가 아닌 대화로, 팀이 따르고 싶은 리더가 되는 첫걸음',
        intro: '안녕하세요. 오늘은 여러분이 가장 자주 듣는 말 중 하나인 "시키는 대로 하면 되지"라는 표현에서 출발해볼게요. 리더로서 빠른 결정과 명확한 지시는 분명한 강점입니다. 하지만 팀원들이 그 지시를 따르되 마음으로 동참하지 않는다면, 그 성과는 얼마나 지속될 수 있을까요? 이번 1회차에서는 독단적 결정의 숨은 비용부터, 통제를 위임으로 바꾸는 작은 기술, 그리고 신뢰를 여는 첫 대화까지 차근차근 살펴봅니다.',
        sections: [
          {
            contentId: 'content-1-1',
            contentTitle: '왜 독단적 결정이 팀을 약하게 만드는가',
            emoji: '🧠',
            subtitle: '혼자 결정하는 리더, 팀은 무엇을 잃는가',
            thumbnail: T('jc-lead-decision'),
            intro: '리더가 모든 결정을 내리면, 팀원들은 점차 스스로 생각하기를 멈춥니다. "어차피 내 의견은 반영되지 않는다"는 학습된 무력감이 퍼지기 시작하죠.',
            body: [
              '하버드 경영대학원의 연구에 따르면, 구성원이 의사결정에 참여한 팀은 그렇지 않은 팀보다 실행 속도가 23% 빠릅니다. 참여한 결정에는 주인의식이 따라오기 때문입니다.',
              '독재형 리더십의 가장 큰 대가는 단기 성과가 아닌 장기 역량입니다. 팀원들이 "생각하는 근육"을 쓰지 않을수록, 복잡한 문제 앞에서 조직 전체가 리더 한 사람에게 의존하게 됩니다.',
            ],
            quote: '"사람들은 자신이 결정에 참여했을 때 그 결과에 책임을 진다." — Edwin Locke',
            keyTakeaway: '의사결정 독점은 단기적 효율을 얻는 대신 장기적 팀 역량과 주인의식을 잃는 거래입니다.',
            actionPlan: [
              '이번 주 팀 회의에서 작은 결정 하나를 팀원에게 위임해보세요.',
              '결정 전 "여러분의 생각은 어떤가요?"라고 먼저 물어보는 습관을 만드세요.',
            ],
          },
          {
            contentId: 'content-1-2',
            contentTitle: '통제에서 위임으로, 권한을 나누는 기술',
            emoji: '🤝',
            subtitle: '"내가 해야 안심"이라는 마음을 내려놓는 법',
            thumbnail: T('jc-lead-delegate'),
            intro: '위임이 어려운 이유는 능력 부족이 아니라 불안 때문입니다. "내가 직접 해야 제대로 된다"는 믿음이 모든 일을 리더에게 되돌립니다.',
            body: [
              '위임은 "일을 던지는 것"이 아니라 "권한과 맥락을 함께 주는 것"입니다. 무엇을(목표), 왜(이유), 어디까지(권한 범위)를 명확히 전달하면 팀원은 스스로 판단할 수 있습니다.',
              '처음부터 큰일을 맡길 필요는 없습니다. 위임은 신뢰의 근육을 키우는 훈련입니다. 작은 성공이 쌓이면 리더의 불안도, 팀원의 자신감도 함께 자랍니다.',
            ],
            dataStat: { value: '+31%', description: '권한 위임 수준이 높은 팀은 그렇지 않은 팀보다 구성원 몰입도가 평균 31% 높았습니다. (Gallup, 2023)' },
            keyTakeaway: '위임의 본질은 일을 넘기는 것이 아니라 판단할 권한과 맥락을 함께 건네는 것입니다.',
            actionPlan: [
              '지금 내가 쥐고 있는 업무 중 "사실은 팀원이 할 수 있는 일" 1가지를 적어보세요.',
              '그 일을 맡길 때 목표·이유·권한 범위 세 가지를 한 문장씩 정리해 전달해보세요.',
            ],
          },
          {
            contentId: 'content-1-3',
            contentTitle: '신뢰를 여는 첫 대화의 한 마디',
            emoji: '💡',
            subtitle: '관계를 바꾸는 것은 거창한 변화가 아니라 한 문장입니다',
            thumbnail: T('jc-lead-trust'),
            intro: '팀원과의 관계를 바꾸는 데 큰 결심은 필요 없습니다. 다음 회의에서 던지는 첫 질문 하나가 분위기를 바꿉니다.',
            body: [
              '"이번 건 어떻게 생각해요?"라는 질문은 단순하지만 강력합니다. 리더가 답을 정해두지 않았다는 신호이자, 당신의 생각이 중요하다는 메시지이기 때문입니다.',
            ],
            caseStudy: 'LG화학의 한 팀장은 매주 회의를 "내 지시"가 아닌 "팀원의 질문 3개"로 시작하도록 바꿨습니다. 3개월 후 팀원들이 먼저 아이디어를 가져오는 횟수가 2배로 늘었다고 합니다.',
            quote: '"신뢰는 속도다. 신뢰가 높아지면 비용은 내려가고 일은 빨라진다." — Stephen Covey',
            keyTakeaway: '신뢰는 거대한 선언이 아니라 매일의 작은 질문과 일관된 태도에서 쌓입니다.',
            actionPlan: [
              '다음 회의의 첫 마디를 지시가 아닌 질문으로 시작해보세요.',
              '팀원이 답할 때 끝까지 듣고, 바로 평가하지 말고 한 번 더 물어보세요.',
            ],
          },
        ],
        interactions: [],
        surveys: [],
        closing: '다음 회차에서는 "일방적 지시 없이도 방향을 잡는 법"을 다룹니다. 이번 주 한 가지 실천 과제를 꼭 시도해보시고, 어떤 변화가 있었는지 기록해두세요.',
      },
    },
    {
      vol: 2,
      dateLabel: '2026년 5월 5일',
      leadershipLabel: '독재형',
      interactions: ['scenario', 'reflection'],
      surveys: ['always'],
      generated: {
        subject: '[2회차] 팀원의 목소리를 듣는다는 것의 진짜 의미',
        headline: '경청은 양보가 아니다, 더 나은 결정으로 가는 전략이다',
        intro: '지난 회차에서 의사결정 독점의 대가를 살펴봤습니다. 이번에는 한 발 더 나아가, 팀원의 의견을 듣는 것이 왜 "부드러운 리더십"이 아닌 "더 강한 전략"인지 이야기해볼게요. 경청에 대한 오해를 깨고, 침묵하던 팀원의 입을 여는 질문법까지 함께 살펴봅니다.',
        sections: [
          {
            contentId: 'content-2-1',
            contentTitle: '경청이 권위를 약화시킨다는 오해',
            emoji: '👂',
            subtitle: '"들어주면 만만하게 보인다"는 생각, 정말 그럴까요?',
            thumbnail: T('jc-lead-listen'),
            intro: '많은 리더들이 팀원의 의견에 귀를 기울이면 자신의 권위가 흔들린다고 느낍니다. 하지만 실제로는 반대입니다.',
            body: [
              '구글의 "Project Aristotle" 연구는 5년간 180개 팀을 분석한 끝에, 최고 성과 팀의 공통점이 "심리적 안전감"임을 발견했습니다. 팀원이 자유롭게 말할 수 있는 환경을 만드는 리더가 더 높은 성과를 냈습니다.',
              '경청하는 리더는 더 많은 정보를 확보합니다. 현장의 목소리, 잠재적 위험, 새로운 아이디어 — 이 모든 것이 팀원들의 입에서 나옵니다. 리더가 입을 닫고 귀를 열 때, 조직의 집단 지성이 살아납니다.',
            ],
            dataStat: { value: '4.6배', description: '자신의 의견이 존중받는다고 느끼는 팀원은 그렇지 않은 팀원보다 최선을 다할 가능성이 4.6배 높습니다. (McKinsey, 2021)' },
            keyTakeaway: '경청은 리더의 약점이 아니라 더 좋은 정보를 수집하고 팀의 몰입을 높이는 강력한 전략입니다.',
            actionPlan: [
              '팀원이 말할 때 반박하고 싶은 충동을 5초 참고, 먼저 "좀 더 이야기해줘요"라고 말해보세요.',
              '이번 주 1:1 미팅에서 내가 말하는 시간이 40% 이하가 되도록 의식적으로 노력해보세요.',
            ],
          },
          {
            contentId: 'content-2-2',
            contentTitle: '침묵을 깨는 질문법',
            emoji: '🗝️',
            subtitle: '"의견 없어요?"로는 절대 의견이 나오지 않는 이유',
            thumbnail: T('jc-lead-question'),
            intro: '"다들 괜찮죠?"라고 물으면 모두가 고개를 끄덕입니다. 침묵은 동의가 아니라, 안전하지 않다는 신호일 때가 많습니다.',
            body: [
              '닫힌 질문("괜찮아요?")은 침묵을 부르고, 열린 질문("어떤 점이 걱정되나요?")은 대화를 엽니다. 질문의 형태를 바꾸는 것만으로 팀의 입이 열립니다.',
              '리더가 먼저 자신의 불확실함을 인정하면("나도 이 부분은 확신이 없어요") 팀원은 비로소 다른 의견을 꺼냅니다. 취약함의 공유가 안전감의 출발점입니다.',
            ],
            quote: '"틀릴 수 있다고 인정하는 리더 앞에서, 사람들은 비로소 진실을 말한다."',
            keyTakeaway: '침묵을 깨는 것은 더 센 압박이 아니라, 더 좋은 질문과 리더의 솔직함입니다.',
            actionPlan: [
              '다음 회의에서 "괜찮아요?" 대신 "어떤 점이 가장 걱정되나요?"로 물어보세요.',
              '의견이 없을 땐 "반대 의견을 일부러 한 명만 말해줄래요?"라고 역할을 부여해보세요.',
            ],
          },
        ],
        interactions: [],
        surveys: [],
        closing: '경청은 하루아침에 습관이 되지 않습니다. 작은 실천을 반복하는 것이 핵심입니다. 다음 회차에서는 "피드백을 주고받는 기술"로 이어집니다.',
      },
    },
    {
      vol: 3,
      dateLabel: '2026년 5월 12일',
      leadershipLabel: '독재형',
      interactions: ['reflection', 'dodont'],
      surveys: ['periodic'],
      generated: {
        subject: '[3회차] 비판이 아닌 성장으로 이어지는 피드백의 기술',
        headline: '팀원을 움직이는 피드백, 무엇이 다른가',
        intro: '지금까지 의사결정 참여와 경청에 대해 살펴봤습니다. 세 번째 주제는 리더십의 핵심 도구 중 하나인 "피드백"입니다. 지적과 피드백은 어떻게 다를까요? 그리고 팀원이 움직이게 만드는 피드백은 어떤 요소를 갖추고 있을까요? 한 번의 이벤트가 아니라 꾸준한 루틴으로 만드는 법까지 다룹니다.',
        sections: [
          {
            contentId: 'content-3-1',
            contentTitle: '지적과 피드백을 가르는 한 가지 차이',
            emoji: '💬',
            subtitle: '"왜 이렇게 했어요?"와 "어떻게 하면 더 좋아질까요?"의 차이',
            thumbnail: T('jc-lead-feedback'),
            intro: '지적은 과거의 잘못에 초점을 맞춥니다. 피드백은 미래의 개선에 초점을 맞춥니다. 같은 상황에서도 어떤 언어를 쓰느냐가 팀원의 반응을 완전히 바꿉니다.',
            body: [
              '효과적인 피드백의 공식: 상황(Situation) → 행동(Behavior) → 영향(Impact). "지난 월요일 발표에서(상황), 데이터 출처를 언급하지 않았을 때(행동), 임원들이 신뢰성을 의심했습니다(영향)."',
              '부정적 피드백만 받는 팀원은 방어적이 됩니다. 긍정 피드백과 부정 피드백의 황금 비율은 3:1입니다. 잘한 것 3가지를 인정한 후 1가지를 개선하면, 팀원은 비판을 공격으로 받아들이지 않습니다.',
            ],
            caseStudy: '삼성전자 한 부문장은 팀원과의 1:1 피드백 방식을 바꾼 후 6개월 만에 팀 이직률이 40% 감소했다고 밝혔습니다. 그의 변화: "왜 못했어?"에서 "어떤 어려움이 있었나요?"로 첫 질문을 바꾼 것이었습니다.',
            keyTakeaway: '피드백은 과거를 심판하는 것이 아니라 미래를 함께 설계하는 대화입니다. 언어 하나가 관계와 성과를 모두 바꿉니다.',
            actionPlan: [
              '이번 주 팀원에게 피드백을 줄 때 SBI 공식(상황-행동-영향)을 사용해보세요.',
              '긍정 피드백을 하루 최소 1회 실천하고, 구체적인 행동을 짚어 칭찬해보세요.',
            ],
          },
          {
            contentId: 'content-3-2',
            contentTitle: '피드백을 한 번의 이벤트가 아닌 루틴으로',
            emoji: '🔁',
            subtitle: '연말 평가 한 번보다, 매주 5분이 사람을 바꾼다',
            thumbnail: T('jc-lead-routine'),
            intro: '큰맘 먹고 1년에 한 번 하는 피드백은 부담스럽고, 늦습니다. 자주, 짧게, 가볍게가 핵심입니다.',
            body: [
              '주간 5분 체크인만으로도 충분합니다. "이번 주 잘된 것 하나, 막힌 것 하나, 내가 도울 것 하나" — 이 세 질문이 꾸준한 성장 대화를 만듭니다.',
            ],
            dataStat: { value: '주 1회', description: '주 1회 이상 피드백을 주고받는 팀원은 분기 1회 팀원보다 업무 몰입도가 3.2배 높았습니다. (Officevibe, 2022)' },
            keyTakeaway: '피드백의 힘은 강도가 아니라 빈도에서 나옵니다. 짧고 자주가 길고 드물게를 이깁니다.',
            actionPlan: [
              '매주 같은 요일에 팀원당 5분 체크인 시간을 캘린더에 고정해보세요.',
              '"잘된 것 / 막힌 것 / 도울 것" 세 질문 템플릿으로 대화를 시작해보세요.',
            ],
          },
        ],
        interactions: [],
        surveys: [],
        closing: '3회차까지 함께해주셔서 감사합니다. 의사결정 참여 → 경청 → 피드백, 이 세 가지 실천이 쌓이면 팀의 분위기가 바뀌기 시작합니다. 앞으로의 회차에서도 함께 성장해나가요.',
      },
    },
  ],
};

const MOCK: Newsletter[] = [
  {
    id: 1, title: '2026 상반기 독재형 리더십 코칭', companyId: 1, companyName: 'LG화학',
    leadershipType: '독재형', status: '제작 중', stepCount: 3,
    positiveLeaders: { types: ['코칭형', '민주형'], count: 8 },
    negativeLeaders: { types: ['독재형', '성과압박형'], count: 5 },
    totalRounds: 6, completedRounds: 3,
    type: 'general', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-04-15', updatedAt: '2026-05-16',
    savedRounds: [1, 2, 3],
    generatedContent: MOCK_GENERATED_CONTENT_1,
  },
  {
    id: 2, title: '2026 상반기 성과압박형 리더십 코칭', companyId: 1, companyName: 'LG화학',
    leadershipType: '성과압박형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['비전형'], count: 10 },
    negativeLeaders: { types: ['성과압박형'], count: 3 },
    totalRounds: 6, completedRounds: 6,
    type: 'custom', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-03-20', updatedAt: '2026-04-28',
  },
  {
    id: 3, title: '2026 불통형 리더십 개선 프로그램', companyId: 2, companyName: '현대모비스',
    leadershipType: '불통형', status: '제작 중', stepCount: 2,
    positiveLeaders: { types: ['지원형'], count: 6 },
    negativeLeaders: { types: ['불통형', '방관형'], count: 7 },
    totalRounds: 6, completedRounds: 2,
    type: 'general', leaderType: 'negative', totalLeaders: 13,
    createdAt: '2026-05-01', updatedAt: '2026-05-14',
  },
  {
    id: 4, title: '2026 방관형 리더십 코칭', companyId: 3, companyName: 'SK하이닉스',
    leadershipType: '방관형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['코칭형', '혁신형'], count: 9 },
    negativeLeaders: { types: ['방관형'], count: 4 },
    totalRounds: 6, completedRounds: 6,
    type: 'custom', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-02-10', updatedAt: '2026-03-25',
    savedRounds: [1, 3],
  },
  {
    id: 5, title: '2026 감정기복형 리더십 코칭', companyId: 6, companyName: 'KT&G',
    leadershipType: '감정기복형', status: '제작 중', stepCount: 4,
    positiveLeaders: { types: ['민주형'], count: 5 },
    negativeLeaders: { types: ['감정기복형', '독재형'], count: 8 },
    totalRounds: 6, completedRounds: 4,
    type: 'general', leaderType: 'negative', totalLeaders: 13,
    createdAt: '2026-04-20', updatedAt: '2026-05-12',
  },
  {
    id: 6, title: '2025 하반기 불명확형 리더십 코칭', companyId: 4, companyName: '포스코',
    leadershipType: '불명확형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['비전형', '지원형'], count: 11 },
    negativeLeaders: { types: ['불명확형'], count: 2 },
    totalRounds: 6, completedRounds: 6,
    type: 'custom', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2025-08-05', updatedAt: '2025-09-20',
  },
  {
    id: 7, title: '2026 독재형 리더십 코칭', companyId: 2, companyName: '현대모비스',
    leadershipType: '독재형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['코칭형'], count: 7 },
    negativeLeaders: { types: ['독재형', '불통형'], count: 6 },
    totalRounds: 6, completedRounds: 6,
    type: 'general', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-03-01', updatedAt: '2026-04-15',
  },
];

interface NewsletterStore {
  newsletters: Newsletter[];
  addNewsletter: (data: Omit<Newsletter, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNewsletter: (id: number, data: Partial<Omit<Newsletter, 'id'>>) => void;
  removeNewsletter: (id: number) => void;
  toggleRoundSaved: (id: number, roundNum: number) => void;
}

export const useNewsletterStore = create<NewsletterStore>((set, get) => ({
  newsletters: MOCK,
  addNewsletter: (data) => {
    const current = get().newsletters;
    const id = current.length > 0 ? Math.max(...current.map(n => n.id)) + 1 : 1;
    const now = new Date().toISOString().slice(0, 10);
    set({ newsletters: [{ ...data, id, createdAt: now, updatedAt: now }, ...current] });
  },
  updateNewsletter: (id, data) => {
    const now = new Date().toISOString().slice(0, 10);
    set({
      newsletters: get().newsletters.map(n =>
        n.id === id ? { ...n, ...data, updatedAt: now } : n
      ),
    });
  },
  removeNewsletter: (id) => {
    set({ newsletters: get().newsletters.filter(n => n.id !== id) });
  },
  toggleRoundSaved: (id, roundNum) => {
    set({
      newsletters: get().newsletters.map(n => {
        if (n.id !== id) return n;
        const saved = new Set(n.savedRounds ?? []);
        saved.has(roundNum) ? saved.delete(roundNum) : saved.add(roundNum);
        return { ...n, savedRounds: [...saved].sort((a, b) => a - b) };
      }),
    });
  },
}));
