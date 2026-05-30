'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import { DEFAULT_STORYLINE, STEP_COLORS, type StorylineStep } from '@/lib/storyline';
import { LEADERSHIP_COLOR } from '@/lib/constants/leadershipColors';
import { type Round } from '@/lib/content';
import { getContentList, type ContentPoolItem, type ContentCategory } from '@/lib/api/contentPool';
import { useNewNewsletterDraftStore, type TopicSuggestion as DraftTopicSuggestion } from '@/store/newNewsletterDraftStore';
import { useParticipantStore, NEGATIVE_TYPES } from '@/store/participantStore';

type DeliveryInterval = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual';
type WizardStep = 1 | 2 | 3 | 4;
type TopicSuggestion = DraftTopicSuggestion;

type GeneratedNewsletterSection = {
  contentTitle: string;
  contentId: string;
  summary: string;
  keyTakeaway: string;
  emoji: string;
  youtubeUrl?: string;
};

type GeneratedInteraction = {
  type: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont';
  title: string;
  content: Record<string, unknown>;
};

type AlwaysSurveyQuestion = {
  type: 'rating';
  options: string[];
  followUp: string;
  followUpOptions: string[];
  openQuestion: string;
};

type PeriodicSurveyQuestion =
  | { type: 'scale'; question: string; scale: number }
  | { type: 'multiple'; question: string; options: string[] }
  | { type: 'open'; question: string };

type GeneratedSurvey = {
  type: 'always' | 'periodic';
  questions: (AlwaysSurveyQuestion | PeriodicSurveyQuestion)[];
};

type GeneratedNewsletter = {
  subject: string;
  headline: string;
  intro: string;
  sections: GeneratedNewsletterSection[];
  interactions: GeneratedInteraction[];
  surveys: GeneratedSurvey[];
  closing: string;
};

const DELIVERY_INTERVAL_OPTIONS: Array<{ value: DeliveryInterval; label: string; days: number; desc: string }> = [
  { value: 'weekly',     label: '주간',   days: 7,   desc: '7일마다' },
  { value: 'biweekly',   label: '격주',   days: 14,  desc: '14일마다' },
  { value: 'monthly',    label: '월 1회', days: 30,  desc: '30일마다' },
  { value: 'bimonthly',  label: '월 2회', days: 15,  desc: '15일마다' },
  { value: 'quarterly',  label: '분기',   days: 90,  desc: '90일마다' },
  { value: 'semiannual', label: '반기',   days: 180, desc: '180일마다' },
];
const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: '스토리라인' },
  { n: 2, label: '회차 설계' },
  { n: 3, label: '콘텐츠 구성' },
  { n: 4, label: '발송 주기' },
];

const POSITIVE_LEADERSHIP_TYPES = new Set(['코칭형', '민주형', '서번트형', '비전형', '관계중심형']);

const INTERACTION_LABELS: Record<string, string> = {
  quiz: '퀴즈',
  scenario: '선택형 시나리오',
  selfcheck: '셀프 진단/체크리스트',
  reflection: '회고 질문',
  dodont: 'Do & Don\'t 리스트',
};

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
      newsletterType: '일반형' as const,
      customTypes: [],
      customLeaderIds: [],
      generalLeaderIds: [],
    }))
  );
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

function calcScheduleDates(startDate: string, interval: DeliveryInterval, count: number): Date[] {
  const days = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === interval)?.days ?? 30;
  const start = new Date(startDate + 'T00:00:00');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * days);
    return d;
  });
}

function formatKoreanDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function calcTotalDuration(startDate: string, interval: DeliveryInterval, count: number): string {
  if (count <= 1) return '—';
  const days = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === interval)?.days ?? 30;
  const totalDays = (count - 1) * days;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + totalDays);
  const startStr = start.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const endStr = end.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const totalMonths = Math.round(totalDays / 30);
  return `${startStr} ~ ${endStr} (약 ${totalMonths}개월)`;
}

function ConfigureContent() {
  const router = useRouter();
  const addNewsletter = useNewsletterStore(s => s.addNewsletter);
  const companies = useCompanyStore(s => s.companies);

  const configDraft = useNewNewsletterDraftStore();
  const allParticipants = useParticipantStore(s => s.participants);

  const targetCompanies = companies.filter(c => configDraft.companyIds.includes(c.id));
  const leadershipTypes: string[] = [];
  const isAllPositive = false;
  const isMixed = false;

  const selectedParticipants = allParticipants.filter(p => configDraft.companyIds?.includes(p.companyId) ?? false);

  const [showCompanyModal, setShowCompanyModal] = useState(configDraft.companyIds.length === 0);
  const [modalCompanySearch, setModalCompanySearch] = useState('');

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  function handleCancel() {
    localStorage.removeItem('newsletter_draft_saved');
    configDraft.resetDraft();
    router.push('/admin/newsletters');
  }

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

  // 아코디언 열림 상태 (1=주제선정, 2=콘텐츠, 3=인터랙션, 4=만족도)
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([2]));

  // 뉴스레터 유형 선택 (0번 섹션, 뉴스레터 전체 적용)
  const [typeOpen, setTypeOpen] = useState(true);

  // 콘텐츠 풀
  const [contentPoolOpen, setContentPoolOpen] = useState(false);
  const [contentPoolItems, setContentPoolItems] = useState<ContentPoolItem[]>([]);
  const [contentPoolLoading, setContentPoolLoading] = useState(false);
  const [contentPoolQuery, setContentPoolQuery] = useState('');
  const [contentPoolCategoryFilter, setContentPoolCategoryFilter] = useState<ContentCategory | ''>('');
  const [contentPreviewItem, setContentPreviewItem] = useState<ContentPoolItem | null>(null);
  const [contentSuggestLoading, setContentSuggestLoading] = useState<boolean[]>([]);

  // ── 4단계: 발송 주기 ──
  const [deliveryInterval, setDeliveryInterval] = useState<DeliveryInterval | null>(null);
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate());

  // ── 저장/임시저장 토스트 ──
  const [showDraftToast, setShowDraftToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('임시저장 완료');

  // ── 미리보기 모달 ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState(0);
  const [previewOpenGroups, setPreviewOpenGroups] = useState<Set<number>>(new Set([0]));
  const [generatedContent, setGeneratedContent] = useState<Record<number, GeneratedNewsletter>>({});
  const [generatingRounds, setGeneratingRounds] = useState<Set<number>>(new Set());
  const [previewContentTab, setPreviewContentTab] = useState<Record<number, 'email' | 'full'>>({});

  // ── draft store 동기화 ──
  useEffect(() => {
    configDraft.setDraft({
      wizardStep, customStoryline, suggestions, rounds,
      totalRounds, roundDistribution,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, customStoryline, suggestions, rounds, totalRounds, roundDistribution]);

  // 회차 전환 시 ①만 열린 상태로 리셋
  useEffect(() => {
    setOpenSections(new Set([2]));
  }, [activeRoundIdx]);

  function toggleSection(n: number) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function togglePreviewGroup(stepIdx: number) {
    setPreviewOpenGroups(prev => {
      const next = new Set(prev);
      next.has(stepIdx) ? next.delete(stepIdx) : next.add(stepIdx);
      return next;
    });
  }

  async function handleGenerateRound(roundIdx: number) {
    const round = rounds[roundIdx];
    if (!round) return;
    setGeneratingRounds(prev => new Set([...prev, roundIdx]));
    try {
      const res = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: {
            id: round.id,
            topic: round.topic,
            stepLabel: customStoryline[round.stepIndex]?.title ?? '',
            contents: round.contents,
            interactions: round.interactions,
            surveys: round.surveys,
          },
          leadershipType: leadershipTypes.join(', ') || '리더십',
          companyName: targetCompanies.map(c => c.name).join(', ') || '대상 기업',
        }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const data: GeneratedNewsletter = await res.json();
      setGeneratedContent(prev => ({ ...prev, [roundIdx]: data }));
      setPreviewContentTab(prev => ({ ...prev, [roundIdx]: 'email' }));
    } catch (e) {
      console.error('뉴스레터 생성 오류:', e);
    } finally {
      setGeneratingRounds(prev => {
        const s = new Set(prev);
        s.delete(roundIdx);
        return s;
      });
    }
  }

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

  function adjustCount(stepIdx: number, delta: number) {
    setRoundDistribution(prev =>
      prev.map(d => d.stepIndex === stepIdx ? { ...d, count: Math.max(0, d.count + delta) } : d)
    );
  }

  function handleTotalRoundsChange(val: number) {
    const min = customStoryline.length;
    const next = Math.max(min, val);
    setTotalRounds(next);
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
          kind: '일반형',
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

  function toggleInteraction(roundIdx: number, val: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont') {
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

  async function suggestContentsForRound(roundIdx: number, topic: string) {
    if (!topic.trim()) return;
    setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = true; return n; });
    try {
      const res = await fetch('/api/contents/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          leadershipType: leadershipTypes[0] ?? '',
          storyStage: customStoryline[rounds[roundIdx]?.stepIndex ?? 0]?.title ?? '',
          existingIds: rounds[roundIdx]?.contents.map(c => c.id) ?? [],
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as { contents: ContentPoolItem[] };
      if (!data.contents?.length) return;
      setRounds(prev =>
        prev.map((r, i) =>
          i !== roundIdx ? r : {
            ...r,
            contents: [...r.contents, ...data.contents.filter(s => !r.contents.some(c => c.id === s.id))],
          }
        )
      );
    } catch {
      // silently fail
    } finally {
      setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = false; return n; });
    }
  }

  // ── 네비게이션 ──
  function canGoNext(): boolean {
    if (wizardStep === 1) return configDraft.companyIds.length > 0;
    if (wizardStep === 2) return distSum === totalRounds && totalRounds >= customStoryline.length;
    if (wizardStep === 3) return true;
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
      : '미지정';
    const autoTitle = `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim();
    addNewsletter({
      title: autoTitle,
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status,
      stepCount: customStoryline.length,
      positiveLeaders: { types: [], count: 0 },
      negativeLeaders: { types: [leadershipType], count: 0 },
      totalRounds: customStoryline.length,
      completedRounds: status === '제작완료' ? customStoryline.length : 0,
      type: 'general',
      leaderType: 'negative',
      totalLeaders: 0,
    });
    configDraft.resetDraft();
    router.push(`/admin/newsletters?tab=${encodeURIComponent(status)}`);
  }

  function handleSaveInPlace() {
    localStorage.setItem('newsletter_draft_saved', JSON.stringify({ savedByUser: true }));
    setToastMessage('저장되었습니다');
    setShowDraftToast(true);
    setTimeout(() => setShowDraftToast(false), 1500);
  }

  function handleDraftSave() {
    // savedByUser 플래그 저장 → 복구 팝업 억제용
    localStorage.setItem('newsletter_draft_saved', JSON.stringify({ savedByUser: true }));
    // mock 뉴스레터 목록에 추가
    const company = targetCompanies[0];
    const leadershipType = leadershipTypes.length > 0
      ? leadershipTypes[0]
      : '미지정';
    addNewsletter({
      title: `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim(),
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status: '제작 중',
      stepCount: customStoryline.length,
      positiveLeaders: { types: [], count: 0 },
      negativeLeaders: { types: [leadershipType], count: 0 },
      totalRounds: customStoryline.length,
      completedRounds: 0,
      type: 'general',
      leaderType: 'negative',
      totalLeaders: 0,
    });
    // sessionStorage(Zustand) 클리어 → 이후 새로 만들기 시 팝업 안 뜸
    configDraft.resetDraft();
    setToastMessage('임시저장 완료');
    setShowDraftToast(true);
    setTimeout(() => {
      setShowDraftToast(false);
      router.push('/admin/newsletters?tab=' + encodeURIComponent('제작 중'));
    }, 1500);
  }

  function handleComplete() {
    if (!deliveryInterval || !startDate) return;
    setPreviewTab(0);
    setPreviewOpenGroups(new Set([0]));
    setPreviewOpen(true);
  }

  function handleConfirmCreate() {
    if (!deliveryInterval || !startDate) return;
    const schedDates = calcScheduleDates(startDate, deliveryInterval, rounds.length);
    console.log('[뉴스레터 생성 완료]', {
      meta: { targetCompanies, leadershipTypes },
      storyline: customStoryline,
      totalRounds,
      roundDistribution,
      rounds,
      delivery: {
        interval: deliveryInterval,
        startDate,
        schedule: rounds.map((r, idx) => ({
          round: idx + 1,
          date: schedDates[idx]?.toISOString().split('T')[0] ?? '',
          stepTitle: customStoryline[r.stepIndex]?.title ?? '',
        })),
      },
    });
    handleSave('제작완료');
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
            대상 설정
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">콘텐츠 구성</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-sm font-medium text-gray-400 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            나가기
          </button>
          <button
            onClick={handleSaveInPlace}
            className="text-sm font-medium border border-[#55A4DA] text-[#55A4DA] px-4 py-1.5 rounded-lg hover:bg-[#55A4DA]/5 transition-colors"
          >
            저장
          </button>
          <button
            onClick={handleDraftSave}
            className="text-sm font-medium bg-[#55A4DA] hover:bg-[#3A8BC4] text-white px-4 py-1.5 rounded-lg transition-colors"
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
          대상 리더 <span className="font-semibold text-gray-700">{selectedParticipants.length}명</span>
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
        <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex flex-col">
          <div className="w-full px-8 py-6 flex flex-col flex-1 justify-center">
            <div className="mb-4 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800 mb-1">뉴스레터 스토리라인</h2>
              <p className="text-xs text-gray-400">5단계 코칭 여정으로 리더의 변화를 이끕니다. 구조를 확인한 뒤 다음으로 진행하세요.</p>
            </div>
              <div className="flex flex-col lg:flex-row items-stretch gap-0">
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
              <div className="pt-4 flex justify-end">
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  편집
                </button>
              </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════
          2단계: 회차 설계
      ════════════════════════════════ */}
      {wizardStep === 2 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC]">
          <div className="w-full px-8 py-6 flex flex-col gap-4 h-full">

            {/* 헤더 */}
            <div className="flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800 mb-1">회차 설계</h2>
              <p className="text-xs text-gray-400">총 발송 회차를 설정하고, 각 단계별 회차 수를 배분하세요. 단계당 최소 1회차가 필요합니다.</p>
            </div>

            {/* 좌우 패널 */}
            <div className="flex gap-4 flex-1 min-h-0">

              {/* 좌측: 총 회차 + 단계별 배분 */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

                {/* 총 발송 회차 */}
                <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">총 발송 회차</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => handleTotalRoundsChange(totalRounds - 1)}
                        disabled={totalRounds <= customStoryline.length}
                        className="w-9 h-9 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-lg"
                      >
                        −
                      </button>
                      <div className="text-center">
                        <span className="text-4xl font-black text-gray-800">{totalRounds}</span>
                        <p className="text-xs text-gray-400 mt-0.5">회차</p>
                      </div>
                      <button
                        onClick={() => handleTotalRoundsChange(totalRounds + 1)}
                        className="w-9 h-9 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-all font-bold text-lg"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">최소 {customStoryline.length}회차</p>
                  </div>
                </div>

                {/* 단계별 배분 */}
                <div className="flex-1 px-6 py-5 flex flex-col min-h-0">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex-shrink-0">단계별 회차 배분</p>
                  <div className="flex-1 space-y-2.5 overflow-y-auto">
                    {customStoryline.map((s, i) => {
                      const color = STEP_COLORS[i % STEP_COLORS.length];
                      const dist = roundDistribution.find(d => d.stepIndex === i);
                      const count = dist?.count ?? 1;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[10px] font-bold">{s.step}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${color.titleColor}`}>{s.title}</p>
                            {s.subtitle && <p className="text-[10px] text-gray-400 truncate">{s.subtitle}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => adjustCount(i, -1)}
                              disabled={count <= 1}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold"
                            >
                              −
                            </button>
                            <span className="w-7 text-center text-sm font-bold text-gray-700">{count}</span>
                            <button
                              onClick={() => adjustCount(i, 1)}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-all text-sm font-bold"
                            >
                              +
                            </button>
                            <span className="text-xs text-gray-400 w-6">회차</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-500">합계</span>
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
                      {distSum !== totalRounds && (
                        <span className="text-[11px] font-normal ml-1">
                          ({distSum > totalRounds ? `${distSum - totalRounds}회 초과` : `${totalRounds - distSum}회 부족`})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* 우측: 회차 미리보기 */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">회차 미리보기</p>
                  {distSum === totalRounds && (
                    <span className="text-[11px] text-gray-400">총 {totalRounds}회차</span>
                  )}
                </div>
                {distSum === totalRounds ? (
                  <div className="flex-1 overflow-y-auto">
                    <div className="divide-y divide-gray-50">
                      {makeRoundsFromDistribution(roundDistribution).map((r, idx) => {
                        const s = customStoryline[r.stepIndex];
                        const color = STEP_COLORS[r.stepIndex % STEP_COLORS.length];
                        return (
                          <div key={idx} className="flex items-center gap-3 px-5 py-2.5">
                            <span className="text-xs text-gray-400 w-12 flex-shrink-0">{idx + 1}회차</span>
                            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge} text-white flex-shrink-0`}>
                              {s?.step}단계
                            </div>
                            <span className="text-xs text-gray-600 truncate">{s?.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-gray-300">배분을 완료하면 미리보기가 표시됩니다.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          3단계: 콘텐츠 구성 (회차별 통합)
      ════════════════════════════════ */}
      {wizardStep === 3 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex">

          {/* 왼쪽: 회차 목록 (w-72, 독립 스크롤) */}
          <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">회차 목록</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {rounds.map((r, idx) => {
                const s = customStoryline[r.stepIndex];
                const color = STEP_COLORS[r.stepIndex % STEP_COLORS.length];
                const isActive = idx === activeRoundIdx;
                const isDone = r.topic.trim().length > 0;
                return (
                  <button
                    key={idx}
                    onClick={() => switchRound(idx)}
                    className={`w-full text-left px-4 py-2 transition-colors ${
                      isActive ? 'bg-[#55A4DA]/5 border-r-2 border-[#55A4DA]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
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
          </div>

          {/* 오른쪽: 아코디언 패널 (독립 스크롤) */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
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
                <div className="space-y-2">

                  {/* 회차 헤더 */}
                  <div className="flex items-center gap-3 pb-1">
                    <div className={`w-8 h-8 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-bold">{s?.step}</span>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${color.titleColor}`}>{activeRoundIdx + 1}회차 구성</p>
                      <p className="text-[11px] text-gray-400">{s?.title} · {s?.subtitle}</p>
                    </div>
                  </div>

                  {/* ⓪ 뉴스레터 유형 선택 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setTypeOpen(prev => !prev)}
                      className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-[#55A4DA] flex-shrink-0">1</span>
                      <p className="text-sm font-bold text-gray-800 flex-1 text-left">뉴스레터 유형</p>
                      {rounds[activeRoundIdx]?.newsletterType ? (
                        <span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">
                          {rounds[activeRoundIdx].newsletterType}
                          {rounds[activeRoundIdx].newsletterType === '맞춤형' && rounds[activeRoundIdx].customTypes.length > 0
                            ? ` · ${rounds[activeRoundIdx].customTypes.join(', ')}`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] text-red-400 flex-shrink-0">필수</span>
                      )}
                      <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${typeOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className={`grid transition-all duration-200 ${typeOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="border-t border-gray-100 p-5 space-y-2">
                          <p className="text-xs text-gray-400 mb-3">이 회차의 발송 유형을 선택하세요.</p>
                          {([
                            { val: '일반형' as const, desc: '선택된 기업의 모든 리더에게 공통으로 발송' },
                            { val: '맞춤형' as const, desc: '특정 리더십 유형에게만 맞춤화된 내용 발송' },
                          ]).map(({ val, desc }) => {
                            const checked = rounds[activeRoundIdx]?.newsletterType === val;
                            return (
                              <button
                                key={val}
                                onClick={() => {
                                  if (val === '일반형') {
                                    setRounds(prev => prev.map((r, i) => i !== activeRoundIdx ? r : {
                                      ...r,
                                      newsletterType: '일반형',
                                      customTypes: [],
                                      customLeaderIds: [],
                                      generalLeaderIds: selectedParticipants.map(p => p.id),
                                    }));
                                  } else {
                                    setRounds(prev => prev.map((r, i) => i !== activeRoundIdx ? r : {
                                      ...r,
                                      newsletterType: '맞춤형',
                                      customTypes: r.customTypes,
                                    }));
                                  }
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                                  checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                                }`}>
                                  {checked && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{val}</p>
                                  <p className="text-[11px] text-gray-400">{desc}</p>
                                </div>
                              </button>
                            );
                          })}

                          {/* 맞춤형 선택 시 부정 유형 선택 UI */}
                          {rounds[activeRoundIdx]?.newsletterType === '맞춤형' && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                              <p className="text-xs font-semibold text-gray-600 mb-2">맞춤형 대상 유형 선택 <span className="text-gray-400 font-normal">(1개)</span></p>
                              {NEGATIVE_TYPES.map(type => {
                                const count = selectedParticipants.filter(p => p.leadershipType === type).length;
                                const isChecked = rounds[activeRoundIdx]?.customTypes.includes(type) ?? false;
                                return (
                                  <button
                                    key={type}
                                    onClick={() => {
                                      setRounds(prev => prev.map((r, i) => {
                                        if (i !== activeRoundIdx) return r;
                                        const next = isChecked
                                          ? r.customTypes.filter(t => t !== type)
                                          : [...r.customTypes, type];
                                        const customLeaderIds = selectedParticipants.filter(p => next.includes(p.leadershipType)).map(p => p.id);
                                        const generalLeaderIds = selectedParticipants.filter(p => !next.includes(p.leadershipType)).map(p => p.id);
                                        return { ...r, customTypes: next, customLeaderIds, generalLeaderIds };
                                      }));
                                    }}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all ${
                                      isChecked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                      isChecked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                                    }`}>
                                      {isChecked && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`text-sm font-semibold flex-1 ${isChecked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{type}</span>
                                    <span className="text-[11px] text-gray-400 flex-shrink-0">{count}명</span>
                                  </button>
                                );
                              })}

                              {/* 수신자 요약 */}
                              {rounds[activeRoundIdx]?.customTypes.length > 0 && (() => {
                                const r = rounds[activeRoundIdx];
                                const customCount = r.customLeaderIds.length;
                                const generalCount = r.generalLeaderIds.length;
                                const customSummary = r.customTypes.map(t => {
                                  const n = selectedParticipants.filter(p => p.leadershipType === t).length;
                                  return `${t} ${n}명`;
                                }).join(' + ');
                                return (
                                  <div className="mt-2 px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                                    <p className="text-xs text-gray-700 leading-relaxed">
                                      <span className="font-semibold text-[#2E7DB5]">{customSummary}</span>
                                      <span className="text-gray-400"> (맞춤형, 총 {customCount}명) + 나머지 </span>
                                      <span className="font-semibold text-gray-700">{generalCount}명</span>
                                      <span className="text-gray-400"> (일반형)</span>
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ① 주제 선정 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleSection(2)}
                      className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-[#55A4DA] flex-shrink-0">2</span>
                      <p className="text-sm font-bold text-gray-800 flex-1 text-left">주제 선정</p>
                      {r.topic.trim() ? (
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">필수</span>
                      )}
                      <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${openSections.has(2) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className={`grid transition-all duration-200 ${openSections.has(2) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="border-t border-gray-100 p-5 space-y-4">
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
                          {suggestions.length > 0 && (
                            <div className="space-y-2">
                              {suggestions.map((topic, idx) => {
                                const isSelected = r.topic === topic.title;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setRoundTopic(activeRoundIdx, topic.title);
                                      if (!rounds[activeRoundIdx]?.contents.length) {
                                        void suggestContentsForRound(activeRoundIdx, topic.title);
                                      }
                                    }}
                                    className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                                      isSelected ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                      isSelected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                                    }`}>
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-semibold leading-snug ${isSelected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>{topic.title}</p>
                                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{topic.description}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div>
                            <p className="text-[11px] text-gray-400 mb-1.5">직접 입력 또는 추천 주제 수정</p>
                            <input
                              type="text"
                              value={r.topic}
                              onChange={e => setRoundTopic(activeRoundIdx, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && r.topic.trim()) {
                                  void suggestContentsForRound(activeRoundIdx, r.topic.trim());
                                }
                              }}
                              placeholder="뉴스레터 주제를 입력하세요 (Enter로 AI 콘텐츠 추천)"
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ② 콘텐츠 선택 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div
                      onClick={() => toggleSection(3)}
                      className="px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-bold text-[#55A4DA] flex-shrink-0">3</span>
                      <p className="text-sm font-bold text-gray-800 flex-1">콘텐츠 선택</p>
                      {r.contents.length > 0 ? (
                        <span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{r.contents.length}개 선택됨</span>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); openContentPool(); }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-xs font-bold rounded-lg transition-colors ml-2 flex-shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        콘텐츠 풀
                      </button>
                      <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${openSections.has(3) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className={`grid transition-all duration-200 ${openSections.has(3) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="border-t border-gray-100 p-4">
                          {r.contents.length === 0 && !contentSuggestLoading[activeRoundIdx] ? (
                            <button
                              onClick={openContentPool}
                              className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex flex-col items-center gap-1.5"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                              </svg>
                              콘텐츠 풀에서 선택하세요
                            </button>
                          ) : (
                            <div className="space-y-2">
                              {r.contents.map(item => (
                                <div key={item.id} className="border border-gray-100 rounded-xl px-3 pt-2.5 pb-2 group bg-gray-50">
                                  <div className="flex items-center gap-3">
                                    {item.thumbnail && (
                                      <img src={item.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-200" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          item.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                        }`}>{item.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span>
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
                                  {item.body && (
                                    <button
                                      onClick={() => setContentPreviewItem(item)}
                                      className="mt-1.5 text-[11px] text-[#55A4DA] hover:text-[#2E7DB5] font-medium transition-colors"
                                    >
                                      내용 보기 →
                                    </button>
                                  )}
                                </div>
                              ))}
                              {contentSuggestLoading[activeRoundIdx] && (
                                <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-dashed border-[#55A4DA]/40 bg-[#55A4DA]/5">
                                  <svg className="w-3.5 h-3.5 animate-spin text-[#55A4DA] flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                  <p className="text-xs text-[#55A4DA] font-medium">AI가 콘텐츠를 선택하는 중...</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ③ 인터랙션 요소 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleSection(4)}
                      className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-[#55A4DA] flex-shrink-0">4</span>
                      <p className="text-sm font-bold text-gray-800 flex-1 text-left">인터랙션 요소</p>
                      {r.interactions.length > 0 ? (
                        <span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">
                          {r.interactions.map(v => INTERACTION_LABELS[v] ?? v).join(' · ')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>
                      )}
                      <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${openSections.has(4) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className={`grid transition-all duration-200 ${openSections.has(4) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="border-t border-gray-100 p-5 space-y-2">
                          <p className="text-xs text-gray-400 mb-3">학습 참여도를 높이는 인터랙션 요소를 선택하세요. 복수 선택 가능합니다.</p>
                          {([
                            { val: 'quiz' as const, label: '퀴즈', desc: '학습 내용 확인 퀴즈' },
                            { val: 'scenario' as const, label: '선택형 시나리오', desc: '상황을 주고 A/B/C 중 선택하면 유형별 피드백을 주는 인터랙션' },
                            { val: 'selfcheck' as const, label: '셀프 진단/체크리스트', desc: '정답 없이 스스로를 점검하는 체크리스트 (예: 나는 팀원 의견을 충분히 듣는가?)' },
                            { val: 'reflection' as const, label: '회고 질문', desc: '성찰을 유도하는 열린 질문 (예: 이번 주 바꾸고 싶은 내 행동은?)' },
                            { val: 'dodont' as const, label: 'Do & Don\'t 리스트', desc: '해야 할 것과 하지 말아야 할 것을 명확하게 정리한 실천 가이드' },
                          ]).map(({ val, label, desc }) => {
                            const checked = r.interactions.includes(val);
                            return (
                              <button
                                key={val}
                                onClick={() => toggleInteraction(activeRoundIdx, val)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                  checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                  </div>

                  {/* ④ 만족도 조사 */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleSection(5)}
                      className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-bold text-[#55A4DA] flex-shrink-0">5</span>
                      <p className="text-sm font-bold text-gray-800 flex-1 text-left">만족도 조사</p>
                      {r.surveys.length > 0 ? (
                        <span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">
                          {r.surveys.map(v => v === 'always' ? '상시' : '정기').join(' · ')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>
                      )}
                      <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${openSections.has(5) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className={`grid transition-all duration-200 ${openSections.has(5) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="border-t border-gray-100 p-5 space-y-2">
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
                                  checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="w-full px-8 py-6 space-y-5">

            {/* 헤더 */}
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1">발송 주기 설정</h2>
              <p className="text-xs text-gray-400">주기와 시작일을 선택하면 전체 발송 일정이 자동으로 계산됩니다.</p>
            </div>

            {/* ① 발송 주기 카드 선택 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">발송 주기</p>
              <div className="grid grid-cols-3 gap-3">
                {DELIVERY_INTERVAL_OPTIONS.map(opt => {
                  const isSelected = deliveryInterval === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setDeliveryInterval(opt.value)}
                      className={`relative flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#55A4DA] flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <p className={`text-base font-bold ${isSelected ? 'text-[#55A4DA]' : 'text-gray-800'}`}>{opt.label}</p>
                      <p className={`text-xs ${isSelected ? 'text-[#55A4DA]/70' : 'text-gray-400'}`}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ② 시작일 선택 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">첫 번째 회차 발송일</p>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
              />
            </div>

            {/* ③ 발송 일정 미리보기 */}
            {deliveryInterval && startDate && rounds.length > 0 && (() => {
              const schedDates = calcScheduleDates(startDate, deliveryInterval, rounds.length);
              return (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">발송 일정 미리보기</p>
                    <span className="text-[11px] text-gray-400">총 {rounds.length}회차</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-20">회차</th>
                        <th className="text-left px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">발송일</th>
                        <th className="text-left px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">스토리라인 단계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rounds.map((r, idx) => {
                        const s = customStoryline[r.stepIndex];
                        const color = STEP_COLORS[r.stepIndex % STEP_COLORS.length];
                        const date = schedDates[idx];
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-2.5 text-xs font-semibold text-gray-500">{idx + 1}회차</td>
                            <td className="px-6 py-2.5 text-xs text-gray-800">{date ? formatKoreanDate(date) : '—'}</td>
                            <td className="px-6 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge} text-white`}>
                                {s?.title}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-500">
                      총 발송 기간: <span className="font-semibold text-gray-700">{calcTotalDuration(startDate, deliveryInterval, rounds.length)}</span>
                    </p>
                  </div>
                </div>
              );
            })()}


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
              <div className="flex gap-1.5 overflow-x-auto">
                {(['', '아티클', '인터뷰', '책 추천', '성공 사례', '카드뉴스', '웹툰', '영상'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setContentPoolCategoryFilter(cat);
                      void loadContentPool(contentPoolQuery, cat);
                    }}
                    className={`flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
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
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${
                        alreadyAdded
                          ? 'border-gray-100 bg-gray-50 opacity-50'
                          : 'border-gray-200 hover:border-[#55A4DA] hover:bg-[#55A4DA]/5'
                      }`}
                    >
                      <div
                        onClick={() => !alreadyAdded && addContentToRound(item)}
                        className={`flex items-start gap-3 px-4 pt-3 pb-2 ${alreadyAdded ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {item.thumbnail && (
                          <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                            }`}>{item.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span>
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
                      </div>
                      {item.body && (
                        <div className="px-4 pb-2.5">
                          <button
                            onClick={() => setContentPreviewItem(item)}
                            className="text-[11px] text-[#55A4DA] hover:text-[#2E7DB5] font-medium transition-colors"
                          >
                            내용 보기 →
                          </button>
                        </div>
                      )}
                    </div>
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

      {/* ════════════════════════════════
          콘텐츠 내용 보기 모달
      ════════════════════════════════ */}
      {contentPreviewItem && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    contentPreviewItem.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                  }`}>{contentPreviewItem.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span>
                  <span className="text-[10px] text-gray-400">{contentPreviewItem.category} · {contentPreviewItem.duration}분</span>
                </div>
                <h3 className="text-sm font-bold text-gray-800 leading-snug">{contentPreviewItem.title}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-400">{contentPreviewItem.author}</span>
                  {contentPreviewItem.tags.slice(0, 4).map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setContentPreviewItem(null)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{contentPreviewItem.body}</p>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setContentPreviewItem(null)}
                className="px-5 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          미리보기 모달
      ════════════════════════════════ */}
      {previewOpen && (() => {
        const schedDates = deliveryInterval && startDate
          ? calcScheduleDates(startDate, deliveryInterval, rounds.length)
          : [];
        const stepGroups = customStoryline
          .map((step, stepIdx) => ({
            step,
            stepIdx,
            rounds: rounds
              .map((r, globalIdx) => ({ ...r, globalIdx }))
              .filter(r => r.stepIndex === stepIdx),
          }))
          .filter(g => g.rounds.length > 0);
        const activeRound = rounds[previewTab];
        const activeStep = activeRound ? customStoryline[activeRound.stepIndex] : null;
        const activeColor = activeRound ? STEP_COLORS[activeRound.stepIndex % STEP_COLORS.length] : null;
        const intervalLabel = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === deliveryInterval)?.label ?? '—';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

              {/* 헤더 */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-gray-800">뉴스레터 미리보기</h2>
                  <p className="text-xs text-gray-400 mt-0.5">생성 전 전체 구성을 확인하세요.</p>
                </div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  닫기
                </button>
              </div>

              {/* 스크롤 본문 */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* A: 상단 요약 */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-[11px] text-gray-400 mb-1">대상 기업</p>
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {targetCompanies.length > 0 ? targetCompanies.map(c => c.name).join(', ') : '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-[11px] text-gray-400 mb-1">총 회차</p>
                      <p className="text-sm font-bold text-gray-800">{rounds.length}회차</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-[11px] text-gray-400 mb-1">발송 주기</p>
                      <p className="text-sm font-bold text-gray-800">{intervalLabel}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-5 flex-wrap">
                      {leadershipTypes.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-400">리더십 유형</span>
                          <div className="flex gap-1">
                            {leadershipTypes.map(t => (
                              <span key={t} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEADERSHIP_COLOR[t] ?? 'bg-gray-100 text-gray-600'}`}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">시작일</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {startDate ? formatKoreanDate(new Date(startDate + 'T00:00:00')) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">총 발송 기간</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {deliveryInterval && startDate ? calcTotalDuration(startDate, deliveryInterval, rounds.length) : '—'}
                        </span>
                      </div>
                    </div>
                    {selectedParticipants.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <span className="text-[11px] text-gray-400 flex-shrink-0">수신 리더</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedParticipants.slice(0, 5).map(p => (
                            <span key={p.id} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {p.name} {p.position}
                            </span>
                          ))}
                          {selectedParticipants.length > 5 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              +{selectedParticipants.length - 5}명
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* B: 스토리라인 단계별 회차 묶음 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">스토리라인 단계별 구성</h3>
                  <div className="space-y-2.5">
                    {stepGroups.map(({ step, stepIdx, rounds: groupRounds }) => {
                      const color = STEP_COLORS[stepIdx % STEP_COLORS.length];
                      const isOpen = previewOpenGroups.has(stepIdx);
                      const rangeText = groupRounds.length === 1
                        ? `${groupRounds[0].globalIdx + 1}회차`
                        : `${groupRounds[0].globalIdx + 1}~${groupRounds[groupRounds.length - 1].globalIdx + 1}회차`;
                      return (
                        <div key={stepIdx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <button
                            onClick={() => togglePreviewGroup(stepIdx)}
                            className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-xs font-bold">{step.step}</span>
                            </div>
                            <div className="flex-1 text-left">
                              <p className={`text-sm font-bold ${color.titleColor}`}>{step.title}</p>
                              <p className="text-[11px] text-gray-400">{step.subtitle}</p>
                            </div>
                            <span className="text-[11px] text-gray-400 flex-shrink-0">{rangeText} · {groupRounds.length}개</span>
                            <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <div className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                            <div className="overflow-hidden">
                              <div className="border-t border-gray-100 divide-y divide-gray-50">
                                {groupRounds.map(r => {
                                  const date = schedDates[r.globalIdx];
                                  return (
                                    <div key={r.id} className="px-5 py-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-700">{r.globalIdx + 1}회차</span>
                                        {r.topic.trim()
                                          ? <span className="text-xs text-gray-600">{r.topic}</span>
                                          : <span className="text-[11px] text-gray-300 italic">주제 미선정</span>
                                        }
                                      </div>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-[11px] text-gray-400">콘텐츠 {r.contents.length}개</span>
                                        {r.interactions.length > 0 && (
                                          <span className="text-[11px] text-[#55A4DA]">
                                            {r.interactions.map(v => INTERACTION_LABELS[v] ?? v).join(' · ')}
                                          </span>
                                        )}
                                        {r.surveys.length > 0 && (
                                          <span className="text-[11px] text-purple-500">
                                            {r.surveys.map(v => v === 'always' ? '상시조사' : '정기조사').join(' · ')}
                                          </span>
                                        )}
                                        {date && (
                                          <span className="text-[11px] text-gray-400">📅 {formatKoreanDate(date)}</span>
                                        )}
                                        {r.newsletterType === '맞춤형' && r.customTypes.length > 0 ? (
                                          <span className="text-[11px] text-amber-600 font-semibold">
                                            {r.customTypes.join('+')} {r.customLeaderIds.length}명(맞춤) + {r.generalLeaderIds.length}명(일반)
                                          </span>
                                        ) : (
                                          <span className="text-[11px] text-gray-400">
                                            전체 {selectedParticipants.length}명 수신
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* C: 뉴스레터 프리뷰 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">뉴스레터 PREVIEW</h3>
                  {/* 회차 탭 */}
                  <div className="flex gap-1.5 overflow-x-auto pb-2 flex-nowrap mb-4">
                    {rounds.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewTab(idx)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          previewTab === idx
                            ? 'bg-[#55A4DA] text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {idx + 1}회차
                      </button>
                    ))}
                  </div>
                  {/* AI 생성 영역 */}
                  {activeRound && (() => {
                    const isGenerating = generatingRounds.has(previewTab);
                    const generated = generatedContent[previewTab];
                    const contentTab = previewContentTab[previewTab] ?? 'email';
                    const firstThumbnail = activeRound.contents[0]?.thumbnail ?? '';
                    const schedDate = schedDates[previewTab];

                    if (isGenerating) {
                      return (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <svg className="w-8 h-8 text-[#55A4DA] animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <p className="text-sm text-gray-500 font-medium">AI가 뉴스레터를 작성 중입니다...</p>
                        </div>
                      );
                    }

                    if (!generated) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-12 h-12 rounded-full bg-[#55A4DA]/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-gray-700 mb-1">{previewTab + 1}회차 뉴스레터</p>
                            <p className="text-xs text-gray-400">AI가 이 회차의 뉴스레터 본문을 생성합니다.</p>
                          </div>
                          <button
                            onClick={() => handleGenerateRound(previewTab)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            AI 뉴스레터 생성하기
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {/* 서브탭 + 다시생성 */}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            {(['email', 'full'] as const).map(tab => (
                              <button
                                key={tab}
                                onClick={() => setPreviewContentTab(prev => ({ ...prev, [previewTab]: tab }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  contentTab === tab
                                    ? 'bg-[#55A4DA] text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {tab === 'email' ? '이메일 미리보기' : '전체 본문'}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => handleGenerateRound(previewTab)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            다시 생성
                          </button>
                        </div>

                        {/* 이메일 미리보기 탭 */}
                        {contentTab === 'email' && (
                          <div style={{ backgroundColor: '#F0F7FF' }} className="rounded-2xl overflow-hidden max-w-md mx-auto shadow-md border border-[#D6EAF8]">
                            {/* 헤더 */}
                            <div className="px-5 py-3.5 flex items-center justify-between bg-white border-b border-[#D6EAF8]">
                              <div className="flex items-center gap-2">
                                <img src="/logo-jc.png" alt="J&Company" className="h-6 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <span className="text-sm font-black text-gray-800 tracking-wider">J&COMPANY</span>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-gray-400">Vol.{previewTab + 1}</p>
                                {schedDate && <p className="text-[10px] text-gray-400 mt-0.5">{formatKoreanDate(schedDate)}</p>}
                              </div>
                            </div>
                            {/* 히어로 — 썸네일 + 헤드라인 (클릭 시 전체 본문으로) */}
                            <div
                              className="relative cursor-pointer"
                              onClick={() => setPreviewContentTab(prev => ({ ...prev, [previewTab]: 'full' }))}
                            >
                              {firstThumbnail ? (
                                <div className="relative w-full h-44 overflow-hidden">
                                  <img src={firstThumbnail} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                  <p className="absolute bottom-0 left-0 right-0 px-5 pb-4 text-base font-black text-white leading-snug">{generated.headline}</p>
                                </div>
                              ) : (
                                <div className="relative w-full h-44 bg-gradient-to-br from-[#2B9EE8] to-[#1a6fad] flex items-end px-5 pb-4">
                                  <p className="text-base font-black text-white leading-snug">{generated.headline}</p>
                                </div>
                              )}
                            </div>
                            {/* 인트로 */}
                            <div className="px-5 pt-4 pb-3">
                              <p className="text-xs text-gray-600 leading-relaxed">{generated.intro}</p>
                            </div>
                            <div className="mx-5 border-t border-[#D6EAF8]" />
                            {/* 이번 호 내용 */}
                            <div className="px-5 py-4">
                              <p className="text-xs font-bold text-gray-700 mb-3">이번 호에서 다루는 내용 👇</p>
                              <div className="grid grid-cols-2 gap-2">
                                {generated.sections.map(sec => (
                                  <div key={sec.contentId} className="bg-white rounded-xl p-3 border border-[#D6EAF8] space-y-1.5 flex flex-col">
                                    <p className="text-base leading-none">{sec.emoji}</p>
                                    <p className="text-xs font-bold text-gray-800 leading-snug line-clamp-2">{sec.contentTitle}</p>
                                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 flex-1">{sec.summary}</p>
                                    <div className="border-t border-gray-100 pt-1.5">
                                      <p className="text-[11px] text-[#2B9EE8] font-semibold leading-snug line-clamp-1">{sec.keyTakeaway}</p>
                                    </div>
                                    <button
                                      onClick={() => setPreviewContentTab(prev => ({ ...prev, [previewTab]: 'full' }))}
                                      className="text-[10px] text-[#2B9EE8] font-bold text-left"
                                    >
                                      자세히 →
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mx-5 border-t border-[#D6EAF8]" />
                            {/* CTA */}
                            <div className="px-5 py-4">
                              <button
                                onClick={() => setPreviewContentTab(prev => ({ ...prev, [previewTab]: 'full' }))}
                                className="w-full py-2.5 bg-[#2B9EE8] hover:bg-[#1a8ad4] text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                              >
                                ✨ 전체 뉴스레터 읽기 →
                              </button>
                            </div>
                            <div className="mx-5 border-t border-[#D6EAF8]" />
                            {/* 푸터 */}
                            <div className="px-5 py-3 flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-gray-600">J&Company 코칭팀</span>
                              <div className="flex gap-3">
                                <span className="text-[10px] text-gray-400 cursor-pointer hover:underline">수신거부</span>
                                <span className="text-[10px] text-gray-400 cursor-pointer hover:underline">문의하기</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 전체 본문 탭 */}
                        {contentTab === 'full' && (
                          <div style={{ backgroundColor: '#F0F7FF' }} className="rounded-2xl overflow-hidden max-w-2xl mx-auto shadow-md border border-[#D6EAF8]">
                            {/* 헤더 */}
                            <div className="px-6 py-3.5 flex items-center justify-between bg-white border-b border-[#D6EAF8]">
                              <div className="flex items-center gap-2">
                                <img src="/logo-jc.png" alt="J&Company" className="h-6 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <span className="text-sm font-black text-gray-800 tracking-wider">J&COMPANY</span>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-gray-400">Vol.{previewTab + 1} · {schedDate ? formatKoreanDate(schedDate) : '—'}</p>
                                {leadershipTypes.length > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{leadershipTypes.join(', ')}</p>}
                              </div>
                            </div>
                            {/* 히어로 */}
                            <div className="relative w-full h-44 overflow-hidden">
                              {firstThumbnail ? (
                                <>
                                  <img src={firstThumbnail} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                </>
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#2B9EE8] to-[#1a6fad]" />
                              )}
                              <div className="absolute bottom-0 left-0 right-0 px-6 pb-3">
                                <p className="text-[10px] text-white/60 mb-0.5 uppercase tracking-widest">이번 호 제목</p>
                                <p className="text-sm font-black text-white leading-snug">{generated.subject}</p>
                              </div>
                            </div>
                            <div className="px-6 py-6 space-y-5">
                              {/* 헤드라인 + 인트로 */}
                              <div className="bg-white rounded-2xl p-5 border border-[#D6EAF8]">
                                <p className="text-base font-black text-gray-800 leading-snug mb-2">{generated.headline}</p>
                                <p className="text-sm text-gray-600 leading-relaxed">{generated.intro}</p>
                              </div>
                              {/* CONTENTS 구분 */}
                              <div className="flex items-center gap-3">
                                <div className="flex-1 border-t border-[#D6EAF8]" />
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">CONTENTS</span>
                                <div className="flex-1 border-t border-[#D6EAF8]" />
                              </div>
                              {/* 섹션별 본문 */}
                              {generated.sections.map(sec => (
                                <div key={sec.contentId} className="bg-white rounded-2xl p-5 border border-[#D6EAF8] space-y-3">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl flex-shrink-0 mt-0.5">{sec.emoji}</span>
                                    <p className="text-sm font-black text-gray-800 leading-snug">{sec.contentTitle}</p>
                                  </div>
                                  <p className="text-sm text-gray-600 leading-relaxed">{sec.summary}</p>
                                  <div className="bg-[#F0FDF4] border border-emerald-200 rounded-xl px-4 py-3">
                                    <p className="text-[11px] font-bold text-emerald-700 mb-0.5">💡 핵심 포인트</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{sec.keyTakeaway}</p>
                                  </div>
                                  {sec.youtubeUrl && (
                                    <div className="aspect-video rounded-xl overflow-hidden bg-black">
                                      <iframe src={sec.youtubeUrl} className="w-full h-full" allowFullScreen title={sec.contentTitle} />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {/* INTERACTION 구분 */}
                              {generated.interactions.length > 0 && (
                                <>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 border-t border-[#D6EAF8]" />
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">INTERACTION</span>
                                    <div className="flex-1 border-t border-[#D6EAF8]" />
                                  </div>
                                  {generated.interactions.map((ia, idx) => {
                                    if (ia.type === 'quiz') {
                                      const c = ia.content as { question: string; options: string[]; answer: number };
                                      return (
                                        <div key={idx} className="bg-[#EBF5FF] rounded-2xl p-5 border border-blue-200 space-y-3">
                                          <div className="flex items-center gap-2"><span className="text-lg">🧠</span><p className="text-sm font-bold text-gray-800">{ia.title}</p></div>
                                          <p className="text-sm text-gray-700 leading-relaxed">{c.question}</p>
                                          <div className="space-y-2">
                                            {(c.options ?? []).map((opt, i) => (
                                              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-xl border border-blue-100 text-sm text-gray-700">
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />{opt}
                                              </div>
                                            ))}
                                          </div>
                                          <button className="text-xs font-bold text-[#2B9EE8] hover:underline">정답 확인하기 →</button>
                                        </div>
                                      );
                                    }
                                    if (ia.type === 'scenario') {
                                      const c = ia.content as { situation: string; options: { label: string; result: string }[] };
                                      return (
                                        <div key={idx} className="bg-[#EBF5FF] rounded-2xl p-5 border border-blue-200 space-y-3">
                                          <div className="flex items-center gap-2"><span className="text-lg">🎭</span><p className="text-sm font-bold text-gray-800">{ia.title}</p></div>
                                          <p className="text-sm text-gray-700 leading-relaxed">{c.situation}</p>
                                          <div className="space-y-2">
                                            {(c.options ?? []).map((opt, i) => (
                                              <button key={i} className="w-full text-left px-4 py-2.5 bg-white rounded-xl border border-blue-100 text-sm text-gray-700 hover:bg-blue-50 transition-colors">{opt.label}</button>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (ia.type === 'selfcheck') {
                                      const c = ia.content as { items: string[] };
                                      return (
                                        <div key={idx} className="bg-[#EBF5FF] rounded-2xl p-5 border border-blue-200 space-y-3">
                                          <div className="flex items-center gap-2"><span className="text-lg">✅</span><p className="text-sm font-bold text-gray-800">{ia.title}</p></div>
                                          <div className="space-y-2">
                                            {(c.items ?? []).map((item, i) => (
                                              <div key={i} className="flex items-start gap-2.5">
                                                <div className="w-4 h-4 rounded border-2 border-blue-300 flex-shrink-0 mt-0.5 bg-white" />
                                                <p className="text-sm text-gray-700">{item}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (ia.type === 'reflection') {
                                      const c = ia.content as { questions: string[] };
                                      return (
                                        <div key={idx} className="bg-[#EBF5FF] rounded-2xl p-5 border border-blue-200 space-y-3">
                                          <div className="flex items-center gap-2"><span className="text-lg">💭</span><p className="text-sm font-bold text-gray-800">{ia.title}</p></div>
                                          <div className="space-y-2">
                                            {(c.questions ?? []).map((q, i) => (
                                              <div key={i} className="bg-white rounded-xl px-4 py-3 border border-blue-100">
                                                <p className="text-[11px] font-bold text-[#2B9EE8] mb-0.5">Q{i + 1}</p>
                                                <p className="text-sm text-gray-700">{q}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (ia.type === 'dodont') {
                                      const c = ia.content as { do: string[]; dont: string[] };
                                      return (
                                        <div key={idx} className="bg-[#EBF5FF] rounded-2xl p-5 border border-blue-200 space-y-3">
                                          <div className="flex items-center gap-2"><span className="text-lg">📋</span><p className="text-sm font-bold text-gray-800">{ia.title}</p></div>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white rounded-xl p-3 border border-emerald-200">
                                              <p className="text-xs font-bold text-emerald-600 mb-2">✅ Do</p>
                                              <ul className="space-y-1.5">
                                                {(c.do ?? []).map((item, i) => (
                                                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5"><span className="text-emerald-500 flex-shrink-0 mt-0.5">•</span>{item}</li>
                                                ))}
                                              </ul>
                                            </div>
                                            <div className="bg-white rounded-xl p-3 border border-red-200">
                                              <p className="text-xs font-bold text-red-500 mb-2">❌ Don't</p>
                                              <ul className="space-y-1.5">
                                                {(c.dont ?? []).map((item, i) => (
                                                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5"><span className="text-red-400 flex-shrink-0 mt-0.5">•</span>{item}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </>
                              )}
                              {/* SURVEY 구분 */}
                              {generated.surveys.length > 0 && (
                                <>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 border-t border-[#D6EAF8]" />
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">SURVEY</span>
                                    <div className="flex-1 border-t border-[#D6EAF8]" />
                                  </div>
                                  {generated.surveys.map((survey, idx) => {
                                    if (survey.type === 'always') {
                                      const q = survey.questions[0] as { type: 'rating'; options: string[]; followUp: string; followUpOptions: string[]; openQuestion: string };
                                      return (
                                        <div key={idx} className="bg-[#FFFBEB] rounded-2xl p-5 border border-amber-200 space-y-4">
                                          <p className="text-sm font-bold text-gray-800">📊 이번 뉴스레터 어떠셨나요?</p>
                                          <div className="flex gap-2">
                                            {(q.options ?? []).map((opt, i) => (
                                              <button key={i} className="flex-1 flex flex-col items-center gap-1 py-2.5 bg-white rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors">
                                                <span className="text-xl">{['😐', '😊', '🤩'][i]}</span>
                                                <span className="text-[10px] text-gray-600">{opt}</span>
                                              </button>
                                            ))}
                                          </div>
                                          <div>
                                            <p className="text-xs font-semibold text-gray-700 mb-2">{q.followUp}</p>
                                            <div className="space-y-1.5">
                                              {(q.followUpOptions ?? []).map((opt, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                  <div className="w-4 h-4 rounded border-2 border-amber-300 flex-shrink-0 bg-white" />
                                                  <p className="text-xs text-gray-700">{opt}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-xs font-semibold text-gray-700 mb-1.5">{q.openQuestion}</p>
                                            <div className="w-full h-14 bg-white rounded-lg border border-amber-200 px-3 py-2 text-xs text-gray-400 flex items-start">답변을 입력해 주세요...</div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    if (survey.type === 'periodic') {
                                      const questions = survey.questions as PeriodicSurveyQuestion[];
                                      return (
                                        <div key={idx} className="bg-[#FFFBEB] rounded-2xl p-5 border border-amber-200 space-y-5">
                                          <p className="text-sm font-bold text-gray-800">📊 정기 만족도 조사</p>
                                          {questions.map((q, i) => (
                                            <div key={i}>
                                              <p className="text-xs font-semibold text-gray-700 mb-2">Q{i + 1}. {q.question}</p>
                                              {q.type === 'scale' && (
                                                <div>
                                                  <div className="flex gap-1">
                                                    {Array.from({ length: q.scale }, (_, n) => (
                                                      <button key={n} className="flex-1 py-1.5 text-xs bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">{n + 1}</button>
                                                    ))}
                                                  </div>
                                                  <div className="flex justify-between mt-1">
                                                    <span className="text-[10px] text-gray-400">매우 불만족</span>
                                                    <span className="text-[10px] text-gray-400">매우 만족</span>
                                                  </div>
                                                </div>
                                              )}
                                              {q.type === 'multiple' && (
                                                <div className="flex flex-wrap gap-1.5">
                                                  {q.options.map((opt, j) => (
                                                    <button key={j} className="px-3 py-1 text-xs bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">{opt}</button>
                                                  ))}
                                                </div>
                                              )}
                                              {q.type === 'open' && (
                                                <div className="w-full h-14 bg-white rounded-lg border border-amber-200 px-3 py-2 text-xs text-gray-400 flex items-start">답변을 입력해 주세요...</div>
                                              )}
                                            </div>
                                          ))}
                                          <button className="w-full py-2.5 bg-[#2B9EE8] hover:bg-[#1a8ad4] text-white text-sm font-semibold rounded-xl transition-colors">제출하기</button>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </>
                              )}
                              {/* 클로징 */}
                              <div className="bg-white rounded-2xl p-5 border border-[#D6EAF8]">
                                <p className="text-sm text-gray-600 leading-relaxed italic mb-2">{generated.closing}</p>
                                <p className="text-xs text-gray-400 font-semibold">J&Company 코칭팀 드림</p>
                              </div>
                              {/* 푸터 */}
                              <div className="flex items-center justify-between pb-1">
                                <img src="/logo-jc.png" alt="J&Company" className="h-5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <div className="flex gap-3">
                                  <span className="text-[10px] text-gray-400 cursor-pointer hover:underline">수신거부</span>
                                  <span className="text-[10px] text-gray-400 cursor-pointer hover:underline">문의하기</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* 푸터 */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  수정하러 돌아가기
                </button>
                <button
                  onClick={handleConfirmCreate}
                  className="flex items-center gap-2 px-6 py-2 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                >
                  생성 확정
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── 기업 선택 모달 ── */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            {/* 헤더 */}
            <div className="px-6 py-5 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800">대상 기업 선택</h2>
              <p className="text-xs text-gray-400 mt-1">뉴스레터를 발송할 기업을 선택해주세요.</p>
            </div>
            {/* 검색 */}
            <div className="px-6 pt-4 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="기업명 검색"
                  value={modalCompanySearch}
                  onChange={e => setModalCompanySearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                  autoFocus
                />
              </div>
            </div>
            {/* 기업 그리드 */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {companies
                  .filter(c => !modalCompanySearch.trim() || c.name.includes(modalCompanySearch.trim()))
                  .map(c => {
                    const selected = configDraft.companyIds[0] === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => configDraft.setDraft({ companyIds: selected ? [] : [c.id] })}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all ${
                          selected
                            ? 'border-[#55A4DA] bg-[#55A4DA]/5 shadow-sm'
                            : 'border-gray-200 hover:border-[#55A4DA]/40 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{c.initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${selected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>{c.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{c.industry}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                        }`}>
                          {selected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
            {/* 푸터 */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                onClick={() => {
                  if (configDraft.companyIds.length > 0) setShowCompanyModal(false);
                }}
                disabled={configDraft.companyIds.length === 0}
                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                  configDraft.companyIds.length > 0
                    ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 임시저장 토스트 ── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-gray-800">저장하지 않고 나가시겠습니까?</h3>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">작업 내용이 사라집니다.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
              >
                계속 작업
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {showDraftToast && (
        <div className="fixed top-4 right-4 z-[100] bg-gray-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
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
        {wizardStep === 4 && (
          <button
            onClick={handleComplete}
            disabled={!deliveryInterval || !startDate}
            className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-1.5 rounded-lg transition-colors ${
              deliveryInterval && startDate
                ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            생성 완료
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
