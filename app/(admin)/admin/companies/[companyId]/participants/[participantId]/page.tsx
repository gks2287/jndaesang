'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCompanyStore } from '@/store/companyStore';
import { useParticipantStore, POSITIVE_TYPES, NEGATIVE_TYPES, type LeadershipType, type DeliveryStatus } from '@/store/participantStore';
import { useDiagnosisHistoryStore } from '@/store/diagnosisHistoryStore';
import { DEFAULT_STORYLINE, STEP_COLORS } from '@/lib/storyline';

const leadershipColor: Record<LeadershipType, string> = {
  '코칭형':    'bg-emerald-100 text-emerald-700',
  '민주형':    'bg-teal-100 text-teal-700',
  '서번트형':  'bg-cyan-100 text-cyan-700',
  '비전형':    'bg-sky-100 text-sky-700',
  '관계중심형': 'bg-blue-100 text-blue-700',
  '독재형':    'bg-red-100 text-red-600',
  '방관형':    'bg-orange-100 text-orange-600',
  '불통형':    'bg-pink-100 text-pink-600',
  '불명확형':  'bg-indigo-100 text-indigo-600',
  '성과압박형': 'bg-purple-100 text-purple-600',
  '감정기복형': 'bg-amber-100 text-amber-600',
  '완벽주의형': 'bg-violet-100 text-violet-600',
  '우유부단형': 'bg-rose-100 text-rose-600',
};

const leadershipDesc: Record<LeadershipType, { summary: string; coaching: string }> = {
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

const deliveryBadge: Record<DeliveryStatus, { bg: string; text: string; dot: string }> = {
  '열람':     { bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-400' },
  '발송완료': { bg: 'bg-yellow-50',  text: 'text-yellow-600',  dot: 'bg-yellow-400' },
  '미발송':   { bg: 'bg-gray-100',   text: 'text-gray-400',    dot: 'bg-gray-300' },
  '완료':     { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
};

// 목 뉴스레터 스텝 데이터
const MOCK_STEPS = [
  { step: 1, title: '자기인식: 나의 리더십 패턴', sentAt: '2026-04-21', openedAt: '2026-04-22', interactionRate: 90, completed: true },
  { step: 2, title: '팀원의 시선: 360° 피드백 이해', sentAt: '2026-04-28', openedAt: '2026-04-29', interactionRate: 75, completed: true },
  { step: 3, title: '갈등 관리와 심리적 안전감', sentAt: '2026-05-12', openedAt: null, interactionRate: 0, completed: false },
  { step: 4, title: '변화를 이끄는 리더: 신뢰와 동기부여', sentAt: null, openedAt: null, interactionRate: 0, completed: false },
  { step: 5, title: '성장 지원: 코칭형 리더십', sentAt: null, openedAt: null, interactionRate: 0, completed: false },
];

// 목 활동 로그
const MOCK_LOGS = [
  { date: '2026-05-07 14:32', action: '뉴스레터 열람', detail: 'Step 3 — 소통의 재발견', type: 'open', response: null },
  { date: '2026-05-07 14:45', action: '성찰 질문 제출', detail: '"나는 팀원의 말을 얼마나 끝까지 듣는가?"', type: 'interact', response: '솔직히 말하면 팀원이 말할 때 이미 내 답을 생각하고 있을 때가 많습니다. 앞으로는 말이 끝날 때까지 기다리고, 요약해서 확인하는 습관을 들이겠습니다.' },
  { date: '2026-05-07 14:50', action: '체크리스트 완료', detail: '경청 실천 3가지 항목 체크', type: 'interact', response: '✅ 회의 중 핸드폰 내려놓기\n✅ 팀원 발언 도중 끼어들지 않기\n☐ 발언 후 요약 확인하기' },
  { date: '2026-05-07 15:10', action: '상시설문 완료', detail: '뉴스레터 만족도 설문 제출', type: 'survey', response: { checks: ['콘텐츠 내용이 실무에 도움이 됐다', '읽기 쉽고 구성이 명확했다', '다음 회차도 받고 싶다'], unchecked: ['분량이 적당했다'], text: '내용 자체는 좋았는데 텍스트 위주라 읽다가 중간에 집중력이 떨어졌습니다. 짧은 영상이나 인포그래픽 같은 게 중간에 있으면 더 좋을 것 같아요.' } },
  { date: '2026-04-29 09:15', action: '뉴스레터 열람', detail: 'Step 2 — 팀원의 시선', type: 'open', response: null },
  { date: '2026-04-29 09:28', action: '퀴즈 응답', detail: '4/5문항 정답', type: 'interact', response: '1번 ✅  2번 ✅  3번 ✅  4번 ❌  5번 ✅\n오답: 피드백 전달 시 적절한 타이밍에 관한 문항' },
  { date: '2026-04-22 11:03', action: '뉴스레터 열람', detail: 'Step 1 — 자기인식', type: 'open', response: null },
  { date: '2026-04-22 11:20', action: '성찰 질문 제출', detail: '"내가 가장 자주 사용하는 리더십 패턴은?"', type: 'interact', response: '저는 결과 중심으로 생각하다 보니 과정보다 성과를 우선시하는 경향이 있습니다. 팀원들이 왜 힘들어하는지 좀 더 들여다볼 필요가 있다고 느꼈습니다.' },
];

const logIcon = {
  open:     { bg: 'bg-blue-50',    icon: 'text-blue-500' },
  interact: { bg: 'bg-purple-50',  icon: 'text-purple-500' },
  survey:   { bg: 'bg-gray-200',   icon: 'text-gray-600' },
};

// 각 로그가 속한 회차(step) 계산 — 열람 로그의 "Step N" 기준으로 그룹핑
const LOG_ROUNDS: number[] = (() => {
  let cur = 0;
  return MOCK_LOGS.map(log => {
    const m = log.detail.match(/Step (\d+)/);
    if (m) cur = Number(m[1]);
    return cur;
  });
})();
const AVAILABLE_ROUNDS = [...new Set(LOG_ROUNDS)].filter(r => r > 0).sort((a, b) => a - b);

const ALL_LEADERSHIP_TYPES: LeadershipType[] = [...POSITIVE_TYPES, ...NEGATIVE_TYPES];
const POSITIONS = ['부장', '차장', '과장', '대리', '팀장', '이사', '상무', '전무', '본부장'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['미발송', '발송완료', '열람', '완료'];

export default function ParticipantDetailPage() {
  const params = useParams();
  const companyId = Number(params.companyId);
  const participantId = Number(params.participantId);

  const company = useCompanyStore(s => s.companies.find(c => c.id === companyId));
  const participant = useParticipantStore(s => s.participants.find(p => p.id === participantId));
  const updateParticipant = useParticipantStore(s => s.updateParticipant);
  const companyParticipants = useParticipantStore(s => s.participants.filter(p => p.companyId === companyId));
  const rawHistory = useDiagnosisHistoryStore(s => s.history);
  const diagnosisHistory = useMemo(
    () => rawHistory.filter(h => h.participantId === participantId).sort((a, b) => b.id - a.id),
    [rawHistory, participantId],
  );

  // 훅은 조기 return 이전에 모두 호출해야 함 (participant 로딩 프레임에서 훅 개수 불일치 방지)
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: participant?.name ?? '',
    department: participant?.department ?? '',
    position: participant?.position ?? '',
    email: participant?.email ?? '',
    leadershipType: (participant?.leadershipType ?? '독재형') as LeadershipType,
    assessmentRound: participant?.assessmentRound ?? 1,
    deliveryStatus: (participant?.deliveryStatus ?? '미발송') as DeliveryStatus,
  });

  if (!company || !participant) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        존재하지 않는 직책자입니다.
      </div>
    );
  }

  const badge = deliveryBadge[participant.deliveryStatus];
  const leaderColor = leadershipColor[participant.leadershipType] ?? 'bg-gray-100 text-gray-600';
  const leaderInfo = leadershipDesc[participant.leadershipType];

  // 유형 드롭다운 옵션: 이 기업 직책자에게 실제 지정된 유형(파일 워딩) + 현재 값 (없으면 표준 목록)
  const assignedTypes = Array.from(new Set(companyParticipants.map(p => p.leadershipType).filter(Boolean)));
  const typeOptions = Array.from(new Set([
    ...(assignedTypes.length > 0 ? assignedTypes : ALL_LEADERSHIP_TYPES),
    participant.leadershipType,
  ].filter(Boolean)));

  // 아직 뉴스레터가 발송되지 않은 직책자는 빈 상태로 표시
  const hasStarted = participant.stepCurrent > 0 || participant.deliveryStatus !== '미발송';
  const activeSteps = hasStarted ? MOCK_STEPS : [];
  const activeLogs = hasStarted ? MOCK_LOGS : [];
  const activeLogRounds = hasStarted ? LOG_ROUNDS : [];
  const activeAvailableRounds = hasStarted ? AVAILABLE_ROUNDS : [];

  const progressPct = Math.round((participant.stepCurrent / participant.stepTotal) * 100);

  function openEdit() {
    if (!participant) return;
    setEditForm({
      name: participant.name,
      department: participant.department,
      position: participant.position,
      email: participant.email,
      leadershipType: participant.leadershipType,
      assessmentRound: participant.assessmentRound,
      deliveryStatus: participant.deliveryStatus,
    });
    setEditOpen(true);
  }

  function handleEditSave() {
    updateParticipant(participantId, editForm);
    setEditOpen(false);
  }

  const completedSteps = activeSteps.filter(s => s.completed).length;
  const avgInteraction = completedSteps > 0
    ? activeSteps.filter(s => s.completed).reduce((acc, s) => acc + s.interactionRate, 0) / completedSteps
    : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[17px] text-gray-400 font-semibold">
          <Link href="/admin/dashboard" className="hover:text-gray-600 transition-colors">진단대상</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/admin/companies/${companyId}/participants`} className="hover:text-gray-600 transition-colors">{company.name}</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-bold">{participant.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={openEdit} className="text-sm font-medium text-white bg-[#55A4DA] hover:bg-[#3A8BC4] px-4 py-2 rounded-lg transition-colors">
            정보 수정
          </button>
        </div>
      </div>

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

        {/* ── 상단: 직책자 프로필 카드 ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-5">
            {/* 아바타 */}
            <div className="w-16 h-16 rounded-2xl bg-[#55A4DA]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#55A4DA] text-2xl font-bold">{participant.name[0]}</span>
            </div>

            {/* 기본 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{participant.name}</h1>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  {participant.deliveryStatus}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{participant.department} · {participant.position}</p>
              <p className="text-sm text-gray-400 mt-0.5">{participant.email}</p>
            </div>

            {/* 우측 메타 */}
            <div className="flex-shrink-0 text-right space-y-1">
              <p className="text-xs text-gray-400">소속 고객사</p>
              <p className="text-sm font-semibold text-gray-700">{company.name}</p>
              <p className="text-xs text-gray-400 mt-2">마지막 열람</p>
              <p className="text-sm font-semibold text-gray-700">
                {participant.lastOpenedAt ?? '—'}
              </p>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-gray-100 my-5" />

          {/* 리더십 진단 결과 + 코칭 방향 */}
          <div className="flex gap-4 mb-5">
            <div className={`flex-1 rounded-xl px-4 py-3 flex items-end gap-4 ${leaderColor.split(' ')[0]}`}>
              <div className="flex-shrink-0">
                <p className="text-xs font-semibold text-gray-500 mb-1">리더십 유형</p>
                <p className={`text-xl font-bold ${leaderColor.split(' ')[1]}`}>{participant.leadershipType}</p>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{leaderInfo?.summary ?? ''}</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">코칭 방향</p>
              <p className="text-xs text-gray-600 leading-relaxed">{leaderInfo?.coaching ?? ''}</p>
            </div>
          </div>

          {/* 통계 4개 */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="뉴스레터 진척도"
              value={`${participant.stepCurrent}회차`}
              suffix={`/ ${participant.stepTotal}회차`}
              sub="최근 완료 기준"
              color="text-gray-800"
            />
            <StatCard
              label="스토리라인"
              value={`${completedSteps}단계`}
              suffix={`/ ${participant.stepTotal}단계`}
              sub="완료 기준"
              color={completedSteps > 0 ? 'text-emerald-600' : 'text-gray-400'}
            />
            <StatCard
              label="평균 참여도"
              value={hasStarted ? '68%' : '0%'}
              sub="발송 기준"
              color={hasStarted ? 'text-gray-800' : 'text-gray-400'}
              percent={hasStarted ? 68 : 0}
            />
            <StatCard
              label="평균 인터랙션"
              value={`${Math.round(avgInteraction)}%`}
              sub="완료 스텝 기준"
              color={avgInteraction > 0 ? 'text-purple-600' : 'text-gray-400'}
              percent={Math.round(avgInteraction)}
            />
          </div>
        </div>

        {/* ── 중단: 뉴스레터 스토리라인 ── */}
        <div className="grid grid-cols-1 gap-5">

          {/* 뉴스레터 스토리라인 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800">뉴스레터 스토리라인</h2>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-[#55A4DA] h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs font-semibold text-[#55A4DA]">{progressPct}%</span>
              </div>
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
                      {/* 상태 뱃지 */}
                      <div className="absolute top-3 right-3">
                        {isDone ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            완료 · {mock.interactionRate}%
                          </span>
                        ) : isSent ? (
                          <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">발송완료</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">미발송</span>
                        )}
                      </div>

                      {/* 스텝 번호 뱃지 */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? 'bg-emerald-500' : color.badge}`}>
                        {isDone ? (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-white text-xs font-bold">{s.step}</span>
                        )}
                      </div>

                      {/* 텍스트 */}
                      <div className="flex-1 min-w-0 pr-16">
                        <p className={`text-sm font-bold leading-tight ${color.titleColor}`}>{s.title}</p>
                        <p className={`text-[11px] font-semibold mb-1 ${color.subtitleColor}`}>{s.subtitle}</p>
                        <p className="text-xs text-gray-500 leading-snug">{s.description}</p>
                        {mock?.sentAt && (
                          <p className="text-[10px] text-gray-300 mt-1">{mock.sentAt} 발송</p>
                        )}
                      </div>
                    </div>

                    {/* 화살표 */}
                    {i < DEFAULT_STORYLINE.length - 1 && (
                      <div className="flex items-center justify-center py-0.5 flex-shrink-0">
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
        </div>

        {/* ── 하단: 활동 로그 ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">활동 로그</h2>
            <span className="text-xs text-gray-400">
              {activeRound === null ? activeLogs.length : activeLogs.filter((_, i) => activeLogRounds[i] === activeRound).length}건
            </span>
          </div>

          {/* 회차 탭 */}
          <div className="flex gap-1 mb-4 flex-wrap">
            <button
              onClick={() => { setActiveRound(null); setExpandedLog(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeRound === null
                  ? 'bg-[#55A4DA] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {activeAvailableRounds.map(round => {
              const step = activeSteps.find(s => s.step === round);
              const rate = step?.interactionRate ?? 0;
              const isActive = activeRound === round;
              return (
                <button
                  key={round}
                  onClick={() => { setActiveRound(round); setExpandedLog(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#55A4DA] text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {round}회차
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : rate > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {rate}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {activeLogs.length === 0 && (
              <div className="flex items-center justify-center h-20 text-sm text-gray-400">
                아직 활동 기록이 없습니다.
              </div>
            )}
            {(activeRound === null ? activeLogs : activeLogs.filter((_, i) => activeLogRounds[i] === activeRound))
            .map((log, i) => {
              const origIdx = activeRound === null ? i : activeLogs.indexOf(log);
              const style = logIcon[log.type as keyof typeof logIcon];
              const isInteract = log.type === 'interact' && log.response;
              const isSurvey = log.type === 'survey' && log.response;
              const isExpandable = isInteract || isSurvey;
              const isExpanded = expandedLog === origIdx;
              return (
                <div key={origIdx}
                  className={`px-3 py-2.5 rounded-xl transition-colors ${isInteract ? 'cursor-pointer hover:bg-purple-50/60' : isSurvey ? 'cursor-pointer hover:bg-gray-100/60' : 'hover:bg-gray-50'}`}
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

      </div>

      {/* ── 정보 수정 모달 ── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-800">직책자 정보 수정</h2>
              <button onClick={() => setEditOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 폼 */}
            <div className="px-6 py-5 space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>

              {/* 부서 / 직책 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">부서</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">직책</label>
                  <select
                    value={editForm.position}
                    onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
                  >
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>

              {/* 리더십 유형 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">리더십 유형</label>
                <select
                  value={editForm.leadershipType}
                  onChange={e => setEditForm(f => ({ ...f, leadershipType: e.target.value as LeadershipType }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
                >
                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* 진단 회차 / 발송 상태 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">진단 회차</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editForm.assessmentRound}
                    onChange={e => setEditForm(f => ({ ...f, assessmentRound: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">발송 상태</label>
                  <select
                    value={editForm.deliveryStatus}
                    onChange={e => setEditForm(f => ({ ...f, deliveryStatus: e.target.value as DeliveryStatus }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
                  >
                    {DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button onClick={handleEditSave} className="px-4 py-2 text-sm font-bold text-white bg-[#55A4DA] hover:bg-[#3A8BC4] rounded-lg transition-colors">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SemiCircle({ percent, color }: { percent: number; color: string }) {
  return (
    <svg viewBox="0 0 80 44" className={`w-20 h-11 ${color}`}>
      <path
        d="M 4 40 A 36 36 0 0 1 76 40"
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="8"
        strokeLinecap="butt"
      />
      <path
        d="M 4 40 A 36 36 0 0 1 76 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="butt"
        pathLength="100"
        strokeDasharray={`${percent} 100`}
      />
    </svg>
  );
}

function StatCard({ label, value, sub, color, suffix, percent }: { label: string; value: string; sub: string; color: string; suffix?: string; percent?: number }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3.5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className={`text-xl font-bold ${color}`}>
            {value}
            {suffix && <span className="text-sm font-medium text-gray-400 ml-1">{suffix}</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
        {percent !== undefined && (
          <SemiCircle percent={percent} color={color} />
        )}
      </div>
    </div>
  );
}
