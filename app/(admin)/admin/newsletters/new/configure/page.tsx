'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import { DEFAULT_STORYLINE, STEP_COLORS, type StorylineStep } from '@/lib/storyline';
import { LEADERSHIP_COLOR } from '@/lib/constants/leadershipColors';
import { type Round } from '@/lib/content';
import { getContentList, type ContentPoolItem, type ContentCategory } from '@/lib/api/contentPool';
import { useNewNewsletterDraftStore, type TopicSuggestion as DraftTopicSuggestion } from '@/store/newNewsletterDraftStore';

type DeliverySchedule = '주 1회' | '격주' | '월 1회';
type WizardStep = 1 | 2 | 3 | 4;
type TopicSuggestion = DraftTopicSuggestion;

const DELIVERY_SCHEDULES: DeliverySchedule[] = ['주 1회', '격주', '월 1회'];
const DIST_PRIORITY = [2, 3, 1, 0];

const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: '스토리라인' },
  { n: 2, label: '회차 설계' },
  { n: 3, label: '콘텐츠 구성' },
  { n: 4, label: '발송 주기' },
];

function calcDistribution(total: number, stepCount: number): { stepIndex: number; count: number }[] {
  const dist = Array.from({ length: stepCount }, (_, i) => ({ stepIndex: i, count: 1 }));
  let extras = total - stepCount;
  if (extras <= 0) return dist;
  const pool = DIST_PRIORITY.filter(i => i < stepCount && i !== 4);
  if (pool.length === 0) return dist;
  let pi = 0;
  while (extras > 0) {
    dist[pool[pi % pool.length]].count++;
    extras--;
    pi++;
  }
  return dist;
}

function makeRoundsFromDistribution(dist: { stepIndex: number; count: number }[]): Round[] {
  const sorted = [...dist].sort((a, b) => a.stepIndex - b.stepIndex);
  let id = 1;
  return sorted.flatMap(({ stepIndex, count }) =>
    Array.from({ length: count }, () => ({
      id: id++,
      stepIndex,
      topic: '',
      contents: [],
      interactions: [],
      surveys: [],
    }))
  );
}

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addNewsletter = useNewsletterStore(s => s.addNewsletter);
  const companies = useCompanyStore(s => s.companies);

  const kind = searchParams.get('kind') ?? '일반형';
  const companyIdsParam = searchParams.get('companyIds') ?? '';
  const typesParam = searchParams.get('types') ?? '';
  const deptsParam = searchParams.get('depts') ?? '';
  const leadersCount = Number(searchParams.get('leaders') ?? 0);

  const companyIdList = companyIdsParam
    ? companyIdsParam.split(',').map(Number).filter(Boolean)
    : [];
  const targetCompanies = companies.filter(c => companyIdList.includes(c.id));
  const leadershipTypes = typesParam ? typesParam.split(',').filter(Boolean) : [];

  const configDraft = useNewNewsletterDraftStore();

  // ── 위저드 단계 ──
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    Math.min(configDraft.wizardStep, 4) as WizardStep
  );

  // ── 1단계: 스토리라인 편집 ──
  const [customStoryline, setCustomStoryline] = useState<StorylineStep[]>(configDraft.customStoryline);
  const [isEditingStoryline, setIsEditingStoryline] = useState(false);
  const [draftStoryline, setDraftStoryline] = useState<StorylineStep[]>(DEFAULT_STORYLINE);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [aiRefineError, setAiRefineError] = useState<string | null>(null);

  // ── 2단계: 회차 설계 ──
  const [totalRounds, setTotalRounds] = useState<number>(
    configDraft.totalRounds > 0 ? configDraft.totalRounds : configDraft.customStoryline.length
  );
  const [roundDistribution, setRoundDistribution] = useState<{ stepIndex: number; count: number }[]>(
    configDraft.roundDistribution.length > 0
      ? configDraft.roundDistribution
      : configDraft.customStoryline.map((_, i) => ({ stepIndex: i, count: 1 }))
  );

  // ── 3단계: 콘텐츠 구성 (회차별 통합) ──
  const [rounds, setRounds] = useState<Round[]>(configDraft.rounds);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);

  // 주제 선정
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>(configDraft.suggestions);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // 콘텐츠 풀
  const [contentPoolOpen, setContentPoolOpen] = useState(false);
  const [contentPoolItems, setContentPoolItems] = useState<ContentPoolItem[]>([]);
  const [contentPoolLoading, setContentPoolLoading] = useState(false);
  const [contentPoolQuery, setContentPoolQuery] = useState('');
  const [contentPoolCategoryFilter, setContentPoolCategoryFilter] = useState<ContentCategory | ''>('');

  // ── 4단계: 발송 주기 ──
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule>(configDraft.deliverySchedule);

  // ── draft store 동기화 ──
  useEffect(() => {
    configDraft.setDraft({
      wizardStep, customStoryline, suggestions, rounds,
      totalRounds, roundDistribution, deliverySchedule,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, customStoryline, suggestions, rounds, totalRounds, roundDistribution, deliverySchedule]);

  // ── 1단계: 스토리라인 편집 함수 ──
  function openEditModal() {
    setDraftStoryline(customStoryline.map(s => ({ ...s })));
    setAiPrompt('');
    setAiRefineError(null);
    setIsEditingStoryline(true);
  }

  function saveStoryline() {
    setCustomStoryline(draftStoryline.map((s, i) => ({ ...s, step: i + 1 })));
    setIsEditingStoryline(false);
  }

  function updateDraftStep(idx: number, field: keyof Omit<StorylineStep, 'step'>, value: string) {
    setDraftStoryline(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function addDraftStep() {
    setDraftStoryline(prev => [
      ...prev,
      { step: prev.length + 1, title: '새 단계', subtitle: '', description: '' },
    ]);
  }

  function removeDraftStep(idx: number) {
    if (draftStoryline.length <= 2) return;
    setDraftStoryline(prev =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }))
    );
  }

  async function refineWithAI() {
    if (!aiPrompt.trim()) return;
    setIsAiRefining(true);
    setAiRefineError(null);
    try {
      const res = await fetch('/api/storyline/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStoryline: draftStoryline, prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error('API 오류');
      const data = await res.json() as { storyline: StorylineStep[] };
      setDraftStoryline(data.storyline);
      setAiPrompt('');
    } catch {
      setAiRefineError('AI 수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAiRefining(false);
    }
  }

  // ── 2단계: 회차 설계 함수 ──
  const distSum = roundDistribution.reduce((s, d) => s + d.count, 0);

  function applyAIDistribution() {
    setRoundDistribution(calcDistribution(totalRounds, customStoryline.length));
  }

  function adjustCount(stepIdx: number, delta: number) {
    setRoundDistribution(prev =>
      prev.map(d => d.stepIndex === stepIdx ? { ...d, count: Math.max(0, d.count + delta) } : d)
    );
  }

  function handleTotalRoundsChange(val: number) {
    const min = customStoryline.length;
    const next = Math.max(min, val);
    setTotalRounds(next);
    setRoundDistribution(calcDistribution(next, customStoryline.length));
  }

  // ── 3단계: 주제 선정 함수 ──
  async function fetchTopicsForRound(roundIdx: number) {
    setIsLoadingTopics(true);
    setTopicError(null);
    setSuggestions([]);
    try {
      const currentRound = rounds[roundIdx];
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadershipTypes,
          companyName: targetCompanies[0]?.name ?? '',
          kind,
          stepTitle: currentRound ? customStoryline[currentRound.stepIndex]?.title : '',
          roundIndex: roundIdx + 1,
        }),
      });
      if (!res.ok) throw new Error('API 오류');
      const data = await res.json() as { topics: TopicSuggestion[] };
      setSuggestions(data.topics ?? []);
    } catch {
      setTopicError('주제 추천을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoadingTopics(false);
    }
  }

  function setRoundTopic(roundIdx: number, topic: string) {
    setRounds(prev => prev.map((r, i) => i === roundIdx ? { ...r, topic } : r));
  }

  function toggleInteraction(roundIdx: number, val: 'quiz' | 'simulation') {
    setRounds(prev =>
      prev.map((r, i) => {
        if (i !== roundIdx) return r;
        const has = r.interactions.includes(val);
        return {
          ...r,
          interactions: has ? r.interactions.filter(v => v !== val) : [...r.interactions, val],
        };
      })
    );
  }

  function toggleSurvey(roundIdx: number, val: 'always' | 'periodic') {
    setRounds(prev =>
      prev.map((r, i) => {
        if (i !== roundIdx) return r;
        const has = r.surveys.includes(val);
        return {
          ...r,
          surveys: has ? r.surveys.filter(v => v !== val) : [...r.surveys, val],
        };
      })
    );
  }

  // ── 3단계: 콘텐츠 풀 함수 ──
  const loadContentPool = useCallback(async (q: string, cat: ContentCategory | '') => {
    setContentPoolLoading(true);
    try {
      const filter = cat ? { q: q || undefined, category: cat } : { q: q || undefined };
      const items = await getContentList(filter);
      setContentPoolItems(items);
    } finally {
      setContentPoolLoading(false);
    }
  }, []);

  function openContentPool() {
    setContentPoolQuery('');
    setContentPoolCategoryFilter('');
    void loadContentPool('', '');
    setContentPoolOpen(true);
  }

  function addContentToRound(item: ContentPoolItem) {
    setRounds(prev =>
      prev.map((r, i) =>
        i !== activeRoundIdx ? r : {
          ...r,
          contents: r.contents.some(c => c.id === item.id) ? r.contents : [...r.contents, item],
        }
      )
    );
  }

  function removeContentFromRound(roundIdx: number, itemId: string) {
    setRounds(prev =>
      prev.map((r, i) =>
        i !== roundIdx ? r : { ...r, contents: r.contents.filter(c => c.id !== itemId) }
      )
    );
  }

  // ── 네비게이션 ──
  function canGoNext(): boolean {
    if (wizardStep === 2) return distSum === totalRounds && totalRounds >= customStoryline.length;
    if (wizardStep === 3) return rounds.every(r => r.topic.trim().length > 0);
    return true;
  }

  function goNext() {
    if (wizardStep >= 4 || !canGoNext()) return;
    if (wizardStep === 2) {
      setRounds(makeRoundsFromDistribution(roundDistribution));
      setActiveRoundIdx(0);
      setSuggestions([]);
    }
    setWizardStep(prev => (prev + 1) as WizardStep);
  }

  function goPrev() {
    if (wizardStep > 1) setWizardStep(prev => (prev - 1) as WizardStep);
    else router.push('/admin/newsletters/new');
  }

  function handleSave(status: '제작 중' | '제작완료') {
    const company = targetCompanies[0];
    const leadershipType = leadershipTypes.length > 0
      ? leadershipTypes[0]
      : deptsParam ? '부서별' : '미지정';
    const autoTitle = `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim();
    addNewsletter({
      title: autoTitle,
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status,
      stepCount: customStoryline.length,
    });
    configDraft.resetDraft();
    router.push(`/admin/newsletters?tab=${encodeURIComponent(status)}`);
  }

  function switchRound(idx: number) {
    setActiveRoundIdx(idx);
    setSuggestions([]);
    setTopicError(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 상단 토퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <Link href="/admin/newsletters" className="hover:text-gray-700 hover:underline transition-colors">
            뉴스레터 제작
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/admin/newsletters/new" className="hover:text-gray-700 hover:underline transition-colors">
            새로 만들기
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">콘텐츠 구성</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/newsletters')}
            className="text-sm font-medium text-gray-500 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => handleSave('제작 중')}
            className="text-sm font-medium text-gray-700 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            임시저장
          </button>
        </div>
      </div>

      {/* ── 컨텍스트 뱃지 바 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-2.5 flex items-center gap-4 flex-shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">대상 기업</span>
          <div className="flex gap-1">
            {targetCompanies.length > 0
              ? targetCompanies.map(c => (
                  <span key={c.id} className="font-semibold px-2 py-0.5 bg-[#55A4DA]/10 text-[#55A4DA] rounded-full">
                    {c.name}
                  </span>
                ))
              : <span className="text-gray-400">—</span>}
          </div>
        </div>
        {leadershipTypes.length > 0 && (
          <>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-400">리더십 유형</span>
              <div className="flex gap-1">
                {leadershipTypes.map(t => (
                  <span key={t} className={`font-semibold px-2 py-0.5 rounded-full ${LEADERSHIP_COLOR[t] ?? 'bg-gray-100 text-gray-600'}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-gray-500">
          {kind} · 대상 리더 <span className="font-semibold text-gray-700">{leadersCount}명</span>
        </span>
      </div>

      {/* ── 스테퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-center flex-shrink-0">
        <div className="flex items-center">
          {WIZARD_STEPS.map((s, i) => {
            const isDone = s.n < wizardStep;
            const isActive = s.n === wizardStep;
            return (
              <div key={s.n} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-[#55A4DA] text-white'
                      : isActive
                      ? 'bg-[#55A4DA] text-white ring-4 ring-[#55A4DA]/20'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s.n}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${
                    isActive ? 'text-[#55A4DA]' : isDone ? 'text-[#55A4DA]/70' : 'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`w-16 h-px mx-3 mb-4 transition-colors ${isDone ? 'bg-[#55A4DA]' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════
          1단계: 스토리라인
      ════════════════════════════════ */}
      {wizardStep === 1 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto px-6 py-10">
            <div className="mb-8">
              <h2 className="text-base font-bold text-gray-800 mb-1">뉴스레터 스토리라인</h2>
              <p className="text-xs text-gray-400">5단계 코칭 여정으로 리더의 변화를 이끕니다. 구조를 확인한 뒤 다음으로 진행하세요.</p>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch gap-0 mb-8">
              {customStoryline.map((s, i) => {
                const color = STEP_COLORS[i % STEP_COLORS.length];
                return (
                  <div key={s.step} className="flex flex-col lg:flex-row items-stretch flex-1 min-w-0">
                    <div className={`flex-1 rounded-2xl border-2 ${color.border} ${color.cardBg} p-5 flex flex-col gap-3`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{s.step}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-bold leading-tight ${color.titleColor}`}>{s.title}</p>
                          <p className={`text-[11px] font-semibold ${color.subtitleColor}`}>{s.subtitle}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed flex-1">{s.description}</p>
                    </div>
                    {i < customStoryline.length - 1 && (
                      <div className="flex items-center justify-center lg:px-2 py-2 lg:py-0 flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-300 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <svg className="w-4 h-4 text-gray-300 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 bg-[#55A4DA]/5 border border-[#55A4DA]/20 rounded-xl px-4 py-3 flex-1">
                <svg className="w-4 h-4 text-[#55A4DA] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-[#2E7DB5]">이 스토리라인은 {targetCompanies[0]?.name ?? '해당 고객사'}의 모든 뉴스레터에 공통으로 적용됩니다.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  편집
                </button>
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-3 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  이 구조로 진행
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          2단계: 회차 설계
      ════════════════════════════════ */}
      {wizardStep === 2 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1">회차 설계</h2>
              <p className="text-xs text-gray-400">총 발송 회차를 설정하고, 각 단계별 회차 수를 배분하세요. 단계당 최소 1회차가 필요합니다.</p>
            </div>

            {/* 총 회차 설정 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">총 발송 회차</p>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => handleTotalRoundsChange(totalRounds - 1)}
                  disabled={totalRounds <= customStoryline.length}
                  className="w-10 h-10 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-lg"
                >
                  −
                </button>
                <div className="text-center">
                  <span className="text-4xl font-black text-gray-800">{totalRounds}</span>
                  <p className="text-xs text-gray-400 mt-1">회차</p>
                </div>
                <button
                  onClick={() => handleTotalRoundsChange(totalRounds + 1)}
                  className="w-10 h-10 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-all font-bold text-lg"
                >
                  +
                </button>
              </div>
              <p className="text-center text-[11px] text-gray-400 mt-3">
                최소 {customStoryline.length}회차 (각 단계당 1회차)
              </p>
            </div>

            {/* 단계별 배분 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">단계별 회차 배분</p>
                <button
                  onClick={applyAIDistribution}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#55A4DA]/10 hover:bg-[#55A4DA]/20 text-[#55A4DA] text-xs font-bold transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI 자동 배분
                </button>
              </div>

              <div className="space-y-3">
                {customStoryline.map((s, i) => {
                  const color = STEP_COLORS[i % STEP_COLORS.length];
                  const dist = roundDistribution.find(d => d.stepIndex === i);
                  const count = dist?.count ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-xs font-bold">{s.step}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${color.titleColor}`}>{s.title}</p>
                        {s.subtitle && <p className="text-[11px] text-gray-400 truncate">{s.subtitle}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => adjustCount(i, -1)}
                          disabled={count <= 1}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-gray-700">{count}</span>
                        <button
                          onClick={() => adjustCount(i, 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-all text-sm font-bold"
                        >
                          +
                        </button>
                        <span className="text-xs text-gray-400 w-8 text-right">회차</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">배분 합계</span>
                <div className={`flex items-center gap-1.5 text-sm font-bold ${
                  distSum === totalRounds ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {distSum === totalRounds ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {distSum} / {totalRounds}회차
                </div>
              </div>
              {distSum !== totalRounds && (
                <p className="mt-2 text-[11px] text-red-500">
                  배분 합계({distSum}회차)와 총 회차({totalRounds}회차)가 일치해야 합니다.
                </p>
              )}
            </div>

            {/* 회차 미리보기 */}
            {distSum === totalRounds && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">회차 미리보기</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {makeRoundsFromDistribution(roundDistribution).map((r, idx) => {
                    const s = customStoryline[r.stepIndex];
                    const color = STEP_COLORS[r.stepIndex % STEP_COLORS.length];
                    return (
                      <div key={idx} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="text-xs text-gray-400 w-12 flex-shrink-0">{idx + 1}회차</span>
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge} text-white`}>
                          {s?.step}단계
                        </div>
                        <span className="text-xs text-gray-600 truncate">{s?.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          3단계: 콘텐츠 구성 (회차별 통합)
      ════════════════════════════════ */}
      {wizardStep === 3 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex">

          {/* 왼쪽: 회차 목록 */}
          <div className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">회차 목록</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {rounds.map((r, idx) => {
                const s = customStoryline[r.stepIndex];
                const color = STEP_COLORS[r.stepIndex % STEP_COLORS.length];
                const isActive = idx === activeRoundIdx;
                const isDone = r.topic.trim().length > 0;
                return (
                  <button
                    key={idx}
                    onClick={() => switchRound(idx)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isActive ? 'bg-[#55A4DA]/5 border-r-2 border-[#55A4DA]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 상태 아이콘 */}
                        {isActive ? (
                          <div className="w-4 h-4 rounded-full border-2 border-[#55A4DA] flex items-center justify-center flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#55A4DA]" />
                          </div>
                        ) : isDone ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-semibold ${isActive ? 'text-[#55A4DA]' : 'text-gray-700'}`}>
                          {idx + 1}회차
                        </span>
                      </div>
                      <div className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${color.badge} text-white flex-shrink-0`}>
                        {s?.title}
                      </div>
                    </div>
                    <p className={`text-[11px] truncate pl-6 ${isDone ? 'text-gray-500' : 'text-gray-300'}`}>
                      {isDone ? r.topic : '주제 미선정'}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400">주제 완료</span>
                <span className={`text-[11px] font-bold ${
                  rounds.every(r => r.topic.trim().length > 0) ? 'text-emerald-600' : 'text-gray-500'
                }`}>
                  {rounds.filter(r => r.topic.trim().length > 0).length} / {rounds.length}
                </span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 회차별 구성 패널 */}
          <div className="flex-1 overflow-y-auto p-6">
            {rounds.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                2단계에서 회차를 먼저 설계해주세요.
              </div>
            ) : (() => {
              const r = rounds[activeRoundIdx];
              if (!r) return null;
              const s = customStoryline[r.stepIndex];
              const color = STEP_COLORS[r.stepIndex % STEP_COLORS.length];
              return (
                <div className="max-w-xl space-y-4">

                  {/* 회차 헤더 */}
                  <div className="flex items-center gap-3 pb-2">
                    <div className={`w-8 h-8 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-bold">{s?.step}</span>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${color.titleColor}`}>{activeRoundIdx + 1}회차 구성</p>
                      <p className="text-[11px] text-gray-400">{s?.title} · {s?.subtitle}</p>
                    </div>
                  </div>

                  {/* ① 주제 선정 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#55A4DA] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">①</span>
                      <p className="text-sm font-bold text-gray-800">주제 선정</p>
                      {r.topic.trim() && (
                        <svg className="w-4 h-4 text-emerald-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="p-5 space-y-4">
                      {/* AI 추천 버튼 */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">이 회차 · 단계에 맞는 주제를 AI가 추천합니다.</p>
                        <button
                          onClick={() => fetchTopicsForRound(activeRoundIdx)}
                          disabled={isLoadingTopics}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ml-3 ${
                            isLoadingTopics
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'
                          }`}
                        >
                          {isLoadingTopics ? (
                            <>
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              생성 중...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              {suggestions.length > 0 ? '다시 추천' : 'AI 추천받기'}
                            </>
                          )}
                        </button>
                      </div>

                      {topicError && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                          <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-red-600 flex-1">{topicError}</p>
                          <button onClick={() => fetchTopicsForRound(activeRoundIdx)} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">
                            재시도
                          </button>
                        </div>
                      )}

                      {/* 추천 카드 */}
                      {suggestions.length > 0 && (
                        <div className="space-y-2">
                          {suggestions.map((topic, idx) => {
                            const isSelected = r.topic === topic.title;
                            return (
                              <button
                                key={idx}
                                onClick={() => setRoundTopic(activeRoundIdx, topic.title)}
                                className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                  isSelected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold leading-snug ${isSelected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>
                                    {topic.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{topic.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* 직접 입력 */}
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1.5">직접 입력 또는 추천 주제 수정</p>
                        <input
                          type="text"
                          value={r.topic}
                          onChange={e => setRoundTopic(activeRoundIdx, e.target.value)}
                          placeholder="뉴스레터 주제를 입력하세요"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ② 콘텐츠 선택 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#55A4DA] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">②</span>
                        <p className="text-sm font-bold text-gray-800">콘텐츠 선택</p>
                        <span className="text-[11px] text-gray-400">(선택사항)</span>
                      </div>
                      <button
                        onClick={openContentPool}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        콘텐츠 풀
                      </button>
                    </div>
                    <div className="p-4">
                      {r.contents.length === 0 ? (
                        <button
                          onClick={openContentPool}
                          className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex flex-col items-center gap-1.5"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                          콘텐츠 풀에서 선택하세요
                        </button>
                      ) : (
                        <div className="space-y-2">
                          {r.contents.map(item => (
                            <div key={item.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-3 py-2.5 group bg-gray-50">
                              {item.thumbnail && (
                                <img src={item.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-200" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    item.type === '자사' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                  }`}>{item.type}</span>
                                  <span className="text-[10px] text-gray-400">{item.category} · {item.duration}분</span>
                                </div>
                                <p className="text-xs font-semibold text-gray-700 truncate">{item.title}</p>
                              </div>
                              <button
                                onClick={() => removeContentFromRound(activeRoundIdx, item.id)}
                                className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ③ 인터랙션 요소 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#55A4DA] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">③</span>
                      <p className="text-sm font-bold text-gray-800">인터랙션 요소</p>
                      <span className="text-[11px] text-gray-400">(선택사항)</span>
                    </div>
                    <div className="p-5 space-y-2">
                      <p className="text-xs text-gray-400 mb-3">학습 참여도를 높이는 인터랙션 요소를 선택하세요.</p>
                      {([
                        { val: 'quiz' as const, label: '퀴즈', desc: '학습 내용 확인 퀴즈' },
                        { val: 'simulation' as const, label: '시뮬레이션', desc: '상황별 의사결정 시뮬레이션' },
                      ]).map(({ val, label, desc }) => {
                        const checked = r.interactions.includes(val);
                        return (
                          <button
                            key={val}
                            onClick={() => toggleInteraction(activeRoundIdx, val)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                              checked
                                ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                            }`}>
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{label}</p>
                              <p className="text-[11px] text-gray-400">{desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ④ 만족도 조사 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#55A4DA] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">④</span>
                      <p className="text-sm font-bold text-gray-800">만족도 조사</p>
                      <span className="text-[11px] text-gray-400">(선택사항)</span>
                    </div>
                    <div className="p-5 space-y-2">
                      <p className="text-xs text-gray-400 mb-3">이 회차에 포함할 만족도 조사를 선택하세요. 중복 선택 가능합니다.</p>
                      {([
                        { val: 'always' as const, label: '상시 만족도 조사', desc: '매 회차 발송 후 수집' },
                        { val: 'periodic' as const, label: '정기 만족도 조사', desc: '주기적으로 심층 수집' },
                      ]).map(({ val, label, desc }) => {
                        const checked = r.surveys.includes(val);
                        return (
                          <button
                            key={val}
                            onClick={() => toggleSurvey(activeRoundIdx, val)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                              checked
                                ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                            }`}>
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{label}</p>
                              <p className="text-[11px] text-gray-400">{desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          4단계: 발송 주기
      ════════════════════════════════ */}
      {wizardStep === 4 && (
        <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] overflow-y-auto py-12">
          <div className="w-full max-w-md px-6 space-y-8">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1.5">발송 주기 선택</h2>
              <p className="text-xs text-gray-400">뉴스레터를 얼마나 자주 발송할지 선택하세요.</p>
            </div>
            <div className="space-y-3">
              {DELIVERY_SCHEDULES.map(s => (
                <button
                  key={s}
                  onClick={() => setDeliverySchedule(s)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    deliverySchedule === s
                      ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#55A4DA]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    deliverySchedule === s ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                  }`}>
                    {deliverySchedule === s && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleSave('제작완료')}
              className="w-full py-3.5 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              생성 완료
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          스토리라인 편집 모달
      ════════════════════════════════ */}
      {isEditingStoryline && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">스토리라인 편집</h2>
                <p className="text-xs text-gray-400 mt-0.5">단계 추가·삭제·순서 변경 및 내용 수정이 가능합니다.</p>
              </div>
              <button onClick={() => setIsEditingStoryline(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-[#55A4DA]/5 border border-[#55A4DA]/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-xs font-bold text-[#2E7DB5]">AI 보조 편집</p>
                </div>
                <p className="text-[11px] text-gray-500">뉴스레터 스토리라인을 어떻게 바꾸고 싶은지 입력하세요.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isAiRefining && refineWithAI()}
                    placeholder="수정 요청을 입력하세요..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
                  />
                  <button
                    onClick={refineWithAI}
                    disabled={!aiPrompt.trim() || isAiRefining}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      !aiPrompt.trim() || isAiRefining
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white'
                    }`}
                  >
                    {isAiRefining ? '수정 중...' : 'AI 수정'}
                  </button>
                </div>
                {aiRefineError && <p className="text-[11px] text-red-500">{aiRefineError}</p>}
              </div>

              <div className="space-y-2.5">
                {draftStoryline.map((s, idx) => {
                  const color = STEP_COLORS[idx % STEP_COLORS.length];
                  return (
                    <div key={idx} className={`rounded-xl border-2 ${color.border} ${color.cardBg} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{idx + 1}</span>
                        </div>
                        <button
                          onClick={() => removeDraftStep(idx)}
                          disabled={draftStoryline.length <= 2}
                          className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          value={s.title}
                          onChange={e => updateDraftStep(idx, 'title', e.target.value)}
                          placeholder="단계명 (예: 수용)"
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:border-current focus:ring-1 focus:ring-current/20 transition ${color.titleColor}`}
                        />
                        <input
                          value={s.subtitle}
                          onChange={e => updateDraftStep(idx, 'subtitle', e.target.value)}
                          placeholder="부제 (예: 성찰과 인정)"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                        />
                        <textarea
                          value={s.description}
                          onChange={e => updateDraftStep(idx, 'description', e.target.value)}
                          placeholder="단계 설명을 입력하세요"
                          rows={2}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 resize-none focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addDraftStep}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors font-medium"
              >
                + 단계 추가
              </button>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setIsEditingStoryline(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveStoryline}
                className="px-5 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          콘텐츠 풀 모달
      ════════════════════════════════ */}
      {contentPoolOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">콘텐츠 풀</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeRoundIdx + 1}회차 · {rounds[activeRoundIdx]?.topic || '—'}
                </p>
              </div>
              <button onClick={() => setContentPoolOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-2.5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={contentPoolQuery}
                  onChange={e => {
                    setContentPoolQuery(e.target.value);
                    void loadContentPool(e.target.value, contentPoolCategoryFilter);
                  }}
                  placeholder="제목, 작성자, 태그 검색..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>
              <div className="flex gap-1.5">
                {(['', '아티클', '영상', '기타'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setContentPoolCategoryFilter(cat);
                      void loadContentPool(contentPoolQuery, cat);
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      contentPoolCategoryFilter === cat
                        ? 'bg-[#55A4DA] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {cat === '' ? '전체' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {contentPoolLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="w-4 h-4 animate-spin text-[#55A4DA]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">불러오는 중...</span>
                </div>
              ) : contentPoolItems.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  검색 결과가 없습니다.
                </div>
              ) : (
                contentPoolItems.map(item => {
                  const currentRound = rounds[activeRoundIdx];
                  const alreadyAdded = currentRound?.contents.some(c => c.id === item.id) ?? false;
                  return (
                    <button
                      key={item.id}
                      onClick={() => !alreadyAdded && addContentToRound(item)}
                      disabled={alreadyAdded}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                        alreadyAdded
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-[#55A4DA] hover:bg-[#55A4DA]/5'
                      }`}
                    >
                      {item.thumbnail && (
                        <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.type === '자사' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                          }`}>{item.type}</span>
                          <span className="text-[10px] text-gray-400">{item.category}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{item.author} · {item.duration}분</span>
                          {item.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                onClick={() => setContentPoolOpen(false)}
                className="px-5 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 하단 네비게이션 ── */}
      <div className="bg-white border-t border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={goPrev}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </button>

        {wizardStep < 4 && (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-1.5 rounded-lg transition-colors ${
              canGoNext()
                ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            다음
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        로딩 중...
      </div>
    }>
      <ConfigureContent />
    </Suspense>
  );
}
