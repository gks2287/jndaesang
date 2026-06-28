'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useParticipantStore, participantToken, type LeadershipType } from '@/store/participantStore';
import { useNewsletterStore } from '@/store/newsletterStore';
import { renderGeneratedFullBody } from '@/components/newsletter/NewsletterRender';
import { DEFAULT_STORYLINE, STEP_COLORS } from '@/lib/storyline';

// ── 리더십 유형별 색상 (뱃지용) ──
const LEADERSHIP_COLOR: Record<string, string> = {
  '독재형': 'bg-red-100 text-red-700',
  '방관형': 'bg-orange-100 text-orange-700',
  '성과압박형': 'bg-purple-100 text-purple-700',
  '불통형': 'bg-pink-100 text-pink-700',
  '불명확형': 'bg-indigo-100 text-indigo-700',
  '감정기복형': 'bg-amber-100 text-amber-700',
  '완벽주의형': 'bg-violet-100 text-violet-700',
  '우유부단형': 'bg-rose-100 text-rose-700',
  '코칭형': 'bg-emerald-100 text-emerald-700',
  '민주형': 'bg-teal-100 text-teal-700',
  '서번트형': 'bg-cyan-100 text-cyan-700',
  '비전형': 'bg-sky-100 text-sky-700',
  '관계중심형': 'bg-blue-100 text-blue-700',
};

const LEADERSHIP_DESC: Record<string, { summary: string; coaching: string }> = {
  '코칭형':    { summary: '구성원의 잠재력을 이끌어내는 코칭 중심 리더십', coaching: '개인별 성장 목표를 함께 설정하고 정기적인 1:1 코칭 대화를 통해 강점을 극대화하세요.' },
  '민주형':    { summary: '구성원 참여와 합의를 중시하는 민주적 리더십', coaching: '의사결정 참여 범위를 명확히 하고, 효율적 합의 구조를 설계해 빠른 실행력도 함께 갖추세요.' },
  '서번트형':  { summary: '구성원을 먼저 섬기는 봉사 중심 리더십', coaching: '팀의 방향성과 목표를 명확히 제시하여 봉사 정신이 성과로 연결될 수 있도록 균형을 맞추세요.' },
  '비전형':    { summary: '미래 방향을 제시하고 영감을 주는 비전 리더십', coaching: '장기 비전을 단기 실행 과제로 구체화하고, 구성원이 일상에서 비전을 체감할 수 있게 연결하세요.' },
  '관계중심형': { summary: '신뢰와 유대감을 바탕으로 한 관계 중심 리더십', coaching: '관계 자산을 성과와 연결하고, 갈등 상황에서도 공정한 피드백을 제공하는 균형감을 키우세요.' },
  '독재형':    { summary: '일방적 지시와 통제 중심의 리더십', coaching: '구성원의 의견을 경청하고 자율성을 부여하는 참여형 의사결정 훈련이 필요합니다.' },
  '방관형':    { summary: '적극적 개입 없이 방치하는 리더십', coaching: '명확한 방향 제시와 피드백 루틴 수립, 구성원 성장에 대한 책임감 강화가 필요합니다.' },
  '불통형':    { summary: '소통 단절과 정보 독점 리더십', coaching: '열린 커뮤니케이션 채널 구축과 투명한 정보 공유, 적극적 경청 스킬 훈련이 필요합니다.' },
  '성과압박형': { summary: '결과 중심의 과도한 압박 리더십', coaching: '과정 중심의 지원과 심리적 안전감 조성, 번아웃 예방을 위한 균형 잡힌 목표 설정이 필요합니다.' },
  '감정기복형': { summary: '감정 조절 미숙으로 인한 불안정 리더십', coaching: '감정 인식과 자기조절 역량 강화, 스트레스 상황에서의 안정적인 리더십 발휘 훈련이 필요합니다.' },
  '완벽주의형': { summary: '과도한 완벽 기준으로 팀을 압박하는 리더십', coaching: '완벽이 아닌 적정 기준을 설정하고, 실패를 학습의 기회로 수용하는 심리적 유연성 훈련이 필요합니다.' },
  '우유부단형': { summary: '결정을 회피하고 방향 제시가 부족한 리더십', coaching: '의사결정 프레임워크를 습득하고, 불완전한 정보 속에서도 적시에 판단을 내리는 훈련이 필요합니다.' },
  '불명확형':  { summary: '리더십 유형이 명확히 분류되지 않은 상태', coaching: '자기 리더십 스타일을 파악하고, 강점과 약점을 구체적으로 인식하는 성찰 훈련이 필요합니다.' },
};

// ── 목 스텝 데이터 ──
const MOCK_STEPS = [
  { step: 1, title: '자기인식: 나의 리더십 패턴', sentAt: '2026-04-21', openedAt: '2026-04-22', interactionRate: 90, completed: true },
  { step: 2, title: '팀원의 시선: 360° 피드백 이해', sentAt: '2026-04-28', openedAt: '2026-04-29', interactionRate: 75, completed: true },
  { step: 3, title: '갈등 관리와 심리적 안전감', sentAt: '2026-05-12', openedAt: null, interactionRate: 0, completed: false },
  { step: 4, title: '변화를 이끄는 리더: 신뢰와 동기부여', sentAt: null, openedAt: null, interactionRate: 0, completed: false },
  { step: 5, title: '성장 지원: 코칭형 리더십', sentAt: null, openedAt: null, interactionRate: 0, completed: false },
];

// ── 목 활동 로그 ──
const MOCK_LOGS = [
  { date: '2026-05-07 14:32', action: '뉴스레터 열람', detail: 'Step 3 — 소통의 재발견', type: 'open', response: null },
  { date: '2026-05-07 14:45', action: '성찰 질문 제출', detail: '"나는 팀원의 말을 얼마나 끝까지 듣는가?"', type: 'interact', response: '솔직히 말하면 팀원이 말할 때 이미 내 답을 생각하고 있을 때가 많습니다. 앞으로는 말이 끝날 때까지 기다리고, 요약해서 확인하는 습관을 들이겠습니다.' },
  { date: '2026-05-07 14:50', action: '체크리스트 완료', detail: '경청 실천 3가지 항목 체크', type: 'interact', response: '✅ 회의 중 핸드폰 내려놓기\n✅ 팀원 발언 도중 끼어들지 않기\n☐ 발언 후 요약 확인하기' },
  { date: '2026-05-07 15:10', action: '상시설문 완료', detail: '뉴스레터 만족도 설문 제출', type: 'survey', response: { checks: ['콘텐츠 내용이 실무에 도움이 됐다', '읽기 쉽고 구성이 명확했다', '다음 회차도 받고 싶다'], unchecked: ['분량이 적당했다'], text: '내용 자체는 좋았는데 텍스트 위주라 읽다가 중간에 집중력이 떨어졌습니다.' } },
  { date: '2026-04-29 09:15', action: '뉴스레터 열람', detail: 'Step 2 — 팀원의 시선', type: 'open', response: null },
  { date: '2026-04-29 09:28', action: '퀴즈 응답', detail: '4/5문항 정답', type: 'interact', response: '1번 ✅  2번 ✅  3번 ✅  4번 ❌  5번 ✅' },
  { date: '2026-04-22 11:03', action: '뉴스레터 열람', detail: 'Step 1 — 자기인식', type: 'open', response: null },
  { date: '2026-04-22 11:20', action: '성찰 질문 제출', detail: '"내가 가장 자주 사용하는 리더십 패턴은?"', type: 'interact', response: '저는 결과 중심으로 생각하다 보니 과정보다 성과를 우선시하는 경향이 있습니다.' },
];

const LOG_ROUNDS: number[] = (() => {
  let cur = 0;
  return MOCK_LOGS.map(log => {
    const m = log.detail.match(/Step (\d+)/);
    if (m) cur = Number(m[1]);
    return cur;
  });
})();
const AVAILABLE_ROUNDS = [...new Set(LOG_ROUNDS)].filter(r => r > 0).sort((a, b) => a - b);

const logIcon = {
  open:     { bg: 'bg-blue-50',   icon: 'text-blue-500' },
  interact: { bg: 'bg-purple-50', icon: 'text-purple-500' },
  survey:   { bg: 'bg-gray-200',  icon: 'text-gray-600' },
};

type Tab = 'newsletter' | 'mypage';

export default function ParticipantNewsletterPage() {
  const { token } = useParams<{ token: string }>();
  const participants = useParticipantStore(s => s.participants);
  const newsletters = useNewsletterStore(s => s.newsletters);

  const participant = useMemo(
    () => participants.find(p => participantToken(p) === token),
    [participants, token],
  );

  const newsletter = useMemo(() => {
    if (!participant) return null;
    return newsletters.find(
      n => n.companyId === participant.companyId && n.leadershipType === participant.leadershipType,
    ) ?? null;
  }, [newsletters, participant]);

  const rounds = newsletter?.generatedContent?.rounds ?? [];
  const accessible = participant?.stepCurrent ?? 0;

  const [activeTab, setActiveTab] = useState<Tab>('newsletter');
  const [activeVol, setActiveVol] = useState<number>(
    Math.max(1, Math.min(accessible, rounds.length)),
  );
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [activeLogRound, setActiveLogRound] = useState<number | null>(null);

  if (!participant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-semibold text-gray-800">유효하지 않은 링크입니다</h1>
          <p className="text-sm text-gray-500">링크가 만료되었거나 잘못된 접근입니다.<br />담당 HR 담당자에게 문의해주세요.</p>
        </div>
      </div>
    );
  }

  const activeRound = rounds.find(r => r.vol === activeVol);
  const leaderColor = LEADERSHIP_COLOR[participant.leadershipType] ?? 'bg-gray-100 text-gray-600';
  const leaderInfo = LEADERSHIP_DESC[participant.leadershipType];
  const hasStarted = participant.stepCurrent > 0 || participant.deliveryStatus !== '미발송';
  const activeSteps = hasStarted ? MOCK_STEPS : [];
  const activeLogs = hasStarted ? MOCK_LOGS : [];
  const activeAvailableRounds = hasStarted ? AVAILABLE_ROUNDS : [];
  const progressPct = Math.round((participant.stepCurrent / participant.stepTotal) * 100);

  // ── 동료 비교 지표 계산 ──
  // 참여율 = stepCurrent / stepTotal, 인터랙션율 = 참여율 * 0.88 (mock 비례 계산)
  const calcRate = (p: typeof participant) =>
    p.stepTotal > 0 && p.deliveryStatus !== '미발송' ? (p.stepCurrent / p.stepTotal) * 100 : null;

  const myParticipationRate = Math.round((participant.stepCurrent / participant.stepTotal) * 100);
  const myInteractionRate = Math.round(myParticipationRate * 0.88);

  const samePositionGroup = participants.filter(
    p => p.id !== participant.id && p.position === participant.position && p.deliveryStatus !== '미발송' && p.stepTotal > 0,
  );
  const sameTypeGroup = participants.filter(
    p => p.id !== participant.id && p.leadershipType === participant.leadershipType && p.deliveryStatus !== '미발송' && p.stepTotal > 0,
  );

  const avgRate = (group: typeof participants) => {
    const vals = group.map(calcRate).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const positionParticipationAvg = avgRate(samePositionGroup);
  const typeParticipationAvg = avgRate(sameTypeGroup);
  const positionInteractionAvg = positionParticipationAvg !== null ? Math.round(positionParticipationAvg * 0.88) : null;
  const typeInteractionAvg = typeParticipationAvg !== null ? Math.round(typeParticipationAvg * 0.88) : null;

  const handleSelectRound = (vol: number) => {
    setActiveVol(vol);
    setActiveTab('newsletter');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 + 탭 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <img
              src="/logo-jc.png"
              alt="J&Company"
              className="h-8 object-contain"
              onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex border-t border-gray-100">
            {(['newsletter', 'mypage'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-[#2B9EE8] text-[#2B9EE8]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'newsletter' ? '뉴스레터' : '마이페이지'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {/* ── 뉴스레터 탭 ── */}
        {activeTab === 'newsletter' && (
          <div className="pb-12">
            {activeRound && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm font-bold text-[#2B9EE8] bg-[#EBF6FE] px-3 py-1.5 rounded-full">
                  {activeRound.vol}회차
                </span>
                <span className="text-xs text-gray-400">{activeRound.dateLabel}</span>
              </div>
            )}
            {activeRound ? (
              renderGeneratedFullBody(activeRound.generated, {
                vol: activeRound.vol,
                dateLabel: activeRound.dateLabel,
                leadershipLabel: activeRound.leadershipLabel,
                templateInteractions: activeRound.interactions,
                templateSurveys: activeRound.surveys,
              })
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center space-y-3">
                {accessible === 0 ? (
                  <>
                    <div className="text-4xl">✉️</div>
                    <p className="text-base font-semibold text-gray-700">아직 발송된 회차가 없습니다</p>
                    <p className="text-sm text-gray-400">첫 번째 뉴스레터가 발송되면 여기서 확인할 수 있습니다.</p>
                  </>
                ) : (
                  <>
                    <div className="text-4xl">📝</div>
                    <p className="text-base font-semibold text-gray-700">{activeVol}회차 콘텐츠를 준비 중입니다</p>
                    <p className="text-sm text-gray-400">곧 만나볼 수 있습니다. 조금만 기다려주세요.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 마이페이지 탭 ── */}
        {activeTab === 'mypage' && (
          <div className="space-y-5 pb-12">

            {/* 프로필 카드 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#2B9EE8]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#2B9EE8] text-xl font-bold">{participant.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900">{participant.name} {participant.position}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{newsletter?.companyName ?? ''} · {participant.department}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{participant.email}</p>
                </div>
              </div>

              {/* 진행 바 */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>코칭 진행률</span>
                  <span>{accessible} / {participant.stepTotal}회차 · {progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2B9EE8] rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 동료 비교 */}
            {hasStarted && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">동료 대비 나의 성과</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* 참여율 */}
                  <CompareCard
                    label="참여율"
                    myValue={myParticipationRate}
                    comparisons={[
                      { label: `동일 직급(${participant.position})`, value: positionParticipationAvg, count: samePositionGroup.length },
                      { label: `${participant.leadershipType} 평균`, value: typeParticipationAvg, count: sameTypeGroup.length },
                    ]}
                    color="#2B9EE8"
                  />
                  {/* 인터랙션율 */}
                  <CompareCard
                    label="인터랙션율"
                    myValue={myInteractionRate}
                    comparisons={[
                      { label: `동일 직급(${participant.position})`, value: positionInteractionAvg, count: samePositionGroup.length },
                      { label: `${participant.leadershipType} 평균`, value: typeInteractionAvg, count: sameTypeGroup.length },
                    ]}
                    color="#7C3AED"
                  />
                </div>
              </div>
            )}

            {/* 나의 배지 */}
            <BadgeSection stepCurrent={participant.stepCurrent} stepTotal={participant.stepTotal} hasStarted={hasStarted} />

            {/* 리더십 유형 + 코칭 방향 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">나의 리더십 진단 결과</h3>
              <div className={`rounded-xl px-4 py-3 ${leaderColor.split(' ')[0]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-base font-bold ${leaderColor.split(' ')[1]}`}>{participant.leadershipType}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${leaderColor}`}>진단 결과</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{leaderInfo?.summary ?? ''}</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">코칭 방향</p>
                <p className="text-xs text-gray-600 leading-relaxed">{leaderInfo?.coaching ?? ''}</p>
              </div>
            </div>

            {/* 스토리라인 진행 현황 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800">코칭 스토리라인</h3>
                <span className="text-xs font-semibold text-[#2B9EE8]">{progressPct}% 완료</span>
              </div>
              <div className="flex flex-col gap-0">
                {DEFAULT_STORYLINE.map((s, i) => {
                  const color = STEP_COLORS[i % STEP_COLORS.length];
                  const mock = activeSteps[i];
                  const isDone = mock?.completed ?? false;
                  const isSent = !!mock?.sentAt && !isDone;

                  return (
                    <div key={s.step} className="flex flex-col">
                      <div className={`rounded-2xl border-2 ${color.border} ${color.cardBg} p-3 flex items-start gap-3 relative`}>
                        <div className="absolute top-3 right-3">
                          {isDone ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">완료</span>
                          ) : isSent ? (
                            <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">진행 중</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">예정</span>
                          )}
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? 'bg-emerald-500' : color.badge}`}>
                          {isDone ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-white text-xs font-bold">{s.step}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-14">
                          <p className={`text-sm font-bold leading-tight ${color.titleColor}`}>{s.title}</p>
                          <p className={`text-[11px] font-semibold mb-1 ${color.subtitleColor}`}>{s.subtitle}</p>
                          <p className="text-xs text-gray-500 leading-snug">{s.description}</p>
                          {mock?.sentAt && (
                            <p className="text-[10px] text-gray-300 mt-1">{mock.sentAt} 발송</p>
                          )}
                        </div>
                      </div>
                      {i < DEFAULT_STORYLINE.length - 1 && (
                        <div className="flex items-center justify-center py-0.5">
                          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 활동 로그 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">나의 활동 기록</h3>
                <span className="text-xs text-gray-400">
                  {activeLogRound === null ? activeLogs.length : activeLogs.filter((_, i) => LOG_ROUNDS[i] === activeLogRound).length}건
                </span>
              </div>

              {/* 회차 필터 */}
              {activeAvailableRounds.length > 0 && (
                <div className="flex gap-1.5 mb-4 flex-wrap">
                  <button
                    onClick={() => { setActiveLogRound(null); setExpandedLog(null); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      activeLogRound === null ? 'bg-[#2B9EE8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {activeAvailableRounds.map(round => (
                    <button
                      key={round}
                      onClick={() => { setActiveLogRound(round); setExpandedLog(null); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        activeLogRound === round ? 'bg-[#2B9EE8] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {round}회차
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                {activeLogs.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-sm text-gray-400">
                    아직 활동 기록이 없습니다.
                  </div>
                )}
                {(activeLogRound === null ? activeLogs : activeLogs.filter((_, i) => LOG_ROUNDS[i] === activeLogRound))
                  .map((log, i) => {
                    const origIdx = activeLogRound === null ? i : activeLogs.indexOf(log);
                    const style = logIcon[log.type as keyof typeof logIcon];
                    const isInteract = log.type === 'interact' && log.response;
                    const isSurvey = log.type === 'survey' && log.response;
                    const isExpandable = isInteract || isSurvey;
                    const isExpanded = expandedLog === origIdx;
                    return (
                      <div
                        key={origIdx}
                        className={`px-3 py-2.5 rounded-xl transition-colors ${isExpandable ? 'cursor-pointer' : ''} hover:bg-gray-50`}
                        onClick={() => isExpandable && setExpandedLog(isExpanded ? null : origIdx)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                            {log.type === 'open' ? (
                              <svg className={`w-3.5 h-3.5 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            ) : log.type === 'survey' ? (
                              <svg className={`w-3.5 h-3.5 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                              </svg>
                            ) : (
                              <svg className={`w-3.5 h-3.5 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700">{log.action}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{log.detail}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-300 whitespace-nowrap">{log.date}</span>
                            {isExpandable && (
                              <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        {isInteract && isExpanded && (
                          <div className="mt-2.5 ml-10 bg-purple-50 rounded-lg px-3 py-2.5">
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{log.response as string}</p>
                          </div>
                        )}
                        {isSurvey && isExpanded && (() => {
                          const r = log.response as { checks: string[]; unchecked: string[]; text: string };
                          return (
                            <div className="mt-2.5 ml-10 bg-gray-100 rounded-lg px-3 py-3 space-y-3">
                              <div className="space-y-1.5">
                                {r.checks.map((item, j) => (
                                  <div key={j} className="flex items-center gap-2">
                                    <span className="text-emerald-500 text-xs font-bold">✓</span>
                                    <p className="text-xs text-gray-600">{item}</p>
                                  </div>
                                ))}
                                {r.unchecked.map((item, j) => (
                                  <div key={j} className="flex items-center gap-2">
                                    <span className="text-gray-300 text-xs font-bold">✗</span>
                                    <p className="text-xs text-gray-400">{item}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="border-t border-gray-200 pt-2.5">
                                <p className="text-[10px] font-semibold text-gray-400 mb-1">주관식 응답</p>
                                <p className="text-xs text-gray-600 leading-relaxed">{r.text}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* 회차 목록 */}
            {participant.stepTotal > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3">회차별 뉴스레터</h3>
                <div className="space-y-2">
                  {Array.from({ length: participant.stepTotal }, (_, i) => i + 1).map(vol => {
                    const isAccessible = vol <= accessible;
                    const hasContent = rounds.some(r => r.vol === vol);
                    const roundData = rounds.find(r => r.vol === vol);
                    const isCurrent = vol === activeVol;

                    return (
                      <button
                        key={vol}
                        disabled={!isAccessible}
                        onClick={() => isAccessible && handleSelectRound(vol)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors
                          ${isAccessible
                            ? isCurrent
                              ? 'bg-[#EBF6FE] border border-[#2B9EE8]/30'
                              : 'bg-gray-50 hover:bg-[#EBF6FE] border border-gray-100'
                            : 'bg-gray-50 border border-gray-100 opacity-50 cursor-not-allowed'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold w-6 ${isCurrent ? 'text-[#2B9EE8]' : 'text-gray-500'}`}>{vol}</span>
                          <div>
                            <p className={`text-sm font-semibold ${isCurrent ? 'text-[#2B9EE8]' : 'text-gray-700'}`}>
                              {vol}회차 {!isAccessible && '🔒'}
                            </p>
                            {roundData && <p className="text-xs text-gray-400 mt-0.5">{roundData.dateLabel}</p>}
                            {isAccessible && !hasContent && <p className="text-xs text-gray-400 mt-0.5">준비 중</p>}
                          </div>
                        </div>
                        {isAccessible && (
                          <span className="text-xs text-[#2B9EE8] font-medium">
                            {isCurrent ? '현재 보는 중' : '보기 →'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

// ── 배지 정의 ──
const BADGE_DEFS = [
  {
    id: 'first_open',
    emoji: '👋',
    name: '첫 걸음',
    desc: '첫 뉴스레터를 열람했습니다',
    unlock: (step: number) => step >= 1,
    color: 'from-blue-400 to-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
  },
  {
    id: 'half_way',
    emoji: '⚡',
    name: '절반의 완성',
    desc: '코칭 과정 50%를 달성했습니다',
    unlock: (step: number, total: number) => total > 0 && step / total >= 0.5,
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  {
    id: 'three_rounds',
    emoji: '🔥',
    name: '꾸준한 학습자',
    desc: '3회차 이상 코칭을 완료했습니다',
    unlock: (step: number) => step >= 3,
    color: 'from-orange-400 to-red-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
  },
  {
    id: 'reflection',
    emoji: '💭',
    name: '성찰가',
    desc: '성찰 질문에 응답했습니다',
    unlock: (_step: number, _total: number, started: boolean) => started,
    color: 'from-purple-400 to-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
  },
  {
    id: 'all_done',
    emoji: '🏆',
    name: '변화의 리더',
    desc: '전체 코칭 과정을 완료했습니다',
    unlock: (step: number, total: number) => total > 0 && step >= total,
    color: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
  },
  {
    id: 'interaction',
    emoji: '🎯',
    name: '인터랙션 마스터',
    desc: '모든 회차의 과제를 완료했습니다',
    unlock: (step: number, total: number) => total > 0 && step >= total,
    color: 'from-emerald-400 to-teal-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
] as const;

function BadgeSection({ stepCurrent, stepTotal, hasStarted }: { stepCurrent: number; stepTotal: number; hasStarted: boolean }) {
  const earned = BADGE_DEFS.filter(b => b.unlock(stepCurrent, stepTotal, hasStarted));
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">나의 배지</h3>
        <span className="text-xs text-gray-400">{earned.length} / {BADGE_DEFS.length} 획득</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {BADGE_DEFS.map(badge => {
          const isEarned = badge.unlock(stepCurrent, stepTotal, hasStarted);
          const isOpen = tooltip === badge.id;
          return (
            <button
              key={badge.id}
              onClick={() => setTooltip(isOpen ? null : badge.id)}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all text-center
                ${isEarned
                  ? `${badge.bg} ${badge.border} hover:shadow-md`
                  : 'bg-gray-50 border-gray-200 opacity-50 grayscale'
                }`}
            >
              {/* 이모지 원형 */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl
                ${isEarned ? `bg-gradient-to-br ${badge.color} shadow-sm` : 'bg-gray-200'}
              `}>
                {isEarned ? badge.emoji : '🔒'}
              </div>
              <p className={`text-[11px] font-bold leading-tight ${isEarned ? badge.text : 'text-gray-400'}`}>
                {badge.name}
              </p>
              {/* 툴팁 */}
              {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-2 z-10 leading-relaxed shadow-lg">
                  {isEarned ? badge.desc : '아직 획득하지 못한 배지입니다'}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {earned.length === 0 && (
        <p className="text-center text-xs text-gray-400 mt-2">뉴스레터를 열람하면 첫 배지를 받을 수 있어요!</p>
      )}
    </div>
  );
}

function CompareCard({
  label,
  myValue,
  comparisons,
  color,
}: {
  label: string;
  myValue: number;
  comparisons: { label: string; value: number | null; count: number }[];
  color: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      {/* 내 값 */}
      <div>
        <div className="flex items-end gap-1.5 mb-1.5">
          <span className="text-2xl font-bold" style={{ color }}>{myValue}%</span>
          <span className="text-xs text-gray-400 mb-0.5">나</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${myValue}%`, backgroundColor: color }} />
        </div>
      </div>
      {/* 비교 그룹들 */}
      {comparisons.map((c, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400 truncate max-w-[80%]">{c.label}</span>
            <span className="text-[11px] font-semibold text-gray-500">
              {c.value !== null ? `${c.value}%` : '—'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-400 opacity-60"
              style={{ width: c.value !== null ? `${c.value}%` : '0%' }}
            />
          </div>
          {c.count > 0 && (
            <p className="text-[9px] text-gray-300 mt-0.5">{c.count}명 기준</p>
          )}
        </div>
      ))}
    </div>
  );
}
