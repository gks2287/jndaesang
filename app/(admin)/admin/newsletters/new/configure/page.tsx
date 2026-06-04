'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import { DEFAULT_STORYLINE, STEP_COLORS, type StorylineStep } from '@/lib/storyline';
import { LEADERSHIP_COLOR } from '@/lib/constants/leadershipColors';
import { type Round, type CustomGroup, makeCustomGroup } from '@/lib/content';
import { getContentList, type ContentPoolItem, type ContentCategory } from '@/lib/api/contentPool';
import { useNewNewsletterDraftStore, type TopicSuggestion as DraftTopicSuggestion } from '@/store/newNewsletterDraftStore';
import { useParticipantStore, POSITIVE_TYPES, NEGATIVE_TYPES } from '@/store/participantStore';
import {
  renderGeneratedFullBody,
  renderInteractionTemplates,
  renderSurveyTemplates,
  renderNewsletterEmailPreview,
  type GeneratedNewsletter,
  type SavedNewsletterContent,
  type SavedNewsletterRound,
} from '@/components/newsletter/NewsletterRender';

type DeliveryInterval = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual';
type WizardStep = 1 | 2 | 3 | 4 | 5;
type TopicSuggestion = DraftTopicSuggestion;

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
  { n: 3, label: '유형 배분' },
  { n: 4, label: '콘텐츠 구성' },
  { n: 5, label: '발송 주기' },
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
      generalTypes: [],
      customLeaderIds: [],
      generalLeaderIds: [],
      customGroups: [],
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

  const selectedParticipants = allParticipants.filter(p => configDraft.companyIds?.includes(p.companyId) ?? false);
  const positiveParticipants = selectedParticipants.filter(p => POSITIVE_TYPES.includes(p.leadershipType));
  const negativeParticipants = selectedParticipants.filter(p => NEGATIVE_TYPES.includes(p.leadershipType));

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  function handleCancel() {
    localStorage.removeItem('newsletter_draft_saved');
    configDraft.resetDraft();
    router.push('/admin/newsletters');
  }

  // ── 위저드 단계 ──
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    Math.min(configDraft.wizardStep, 5) as WizardStep
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

  // ── 3단계: 리더십 유형 배분 ──
  const [distributionRoundIdx, setDistributionRoundIdx] = useState(0);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // ── 4단계: 콘텐츠 구성 (회차별 통합) ──
  const [rounds, setRounds] = useState<Round[]>(configDraft.rounds);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);
  // 좌측 실시간 미리보기 대상 탭 ('general' 또는 그룹 id)
  const [previewTargetId, setPreviewTargetId] = useState<string>('general');
  // 좌측 실시간 미리보기 표시 모드 (전체 본문 / 요약본)
  const [livePreviewMode, setLivePreviewMode] = useState<'full' | 'email'>('full');
  // AI 자동 채움 중복 실행 가드 (`${roundIdx}:${targetId}`)
  const autoFilledRef = useRef<Set<string>>(new Set());
  // 좌측 실시간 미리보기 본문 (generate API 결과, `${roundIdx}:${targetId}` 키)
  const [livePreviewContent, setLivePreviewContent] = useState<Record<string, GeneratedNewsletter>>({});
  const [livePreviewGenerating, setLivePreviewGenerating] = useState<Set<string>>(new Set());
  // 백그라운드 준비 중인 대상 (주제 추천 + 콘텐츠 서칭 단계, `${roundIdx}:${targetId}`)
  const [preparingTargets, setPreparingTargets] = useState<Set<string>>(new Set());
  const livePreviewTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // 대상별 마지막 생성 시그니처 (key → sig). 현재 구성과 다르면 재생성 (A→B→A 되돌림도 정상 반영)
  const livePreviewSigRef = useRef<Record<string, string>>({});
  // Step 3 → 4 진입 시 전 회차 자동 구성 로딩 오버레이

  // 주제 선정
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>(configDraft.suggestions);
  // 주제 추천 대상: 'general' 또는 그룹 id
  const [suggestionsTarget, setSuggestionsTarget] = useState<string>('general');
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // 아코디언 접힘 상태 (key가 들어있으면 접힘 / 없으면 펼침) — 그룹/일반형 공용
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 긍정 리더 펼침 (Step 3)
  const [positiveExpanded, setPositiveExpanded] = useState(false);
  // 부정 리더 유형 칩 펼침 (Step 3) — 키 absent = 접힘(기본)
  const [expandedTypeChips, setExpandedTypeChips] = useState<Set<string>>(new Set());

  // 콘텐츠 풀
  const [contentPoolOpen, setContentPoolOpen] = useState(false);
  const [contentPoolForCustom, setContentPoolForCustom] = useState(false);
  const [contentPoolGroupId, setContentPoolGroupId] = useState<string | null>(null);
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
  // 최신 생성 결과 미러 (사전 생성 루프에서 stale closure 없이 참조)
  const generatedContentRef = useRef<Record<number, GeneratedNewsletter>>({});
  // 진행 중 회차 미러 (중복 호출 방지 — 클로저 stale 없이 즉시 참조)
  const generatingRoundsRef = useRef<Set<number>>(new Set());
  const [previewContentTab, setPreviewContentTab] = useState<Record<number, 'email' | 'full'>>({});
  // 본문 편집 모드 (미리보기 모달)
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<GeneratedNewsletter | null>(null);
  // 사용자가 본문을 직접 편집한 회차 (general) — "편집됨" 표시용 (콘텐츠 변경 시 해제)
  const editedRoundsRef = useRef<Set<number>>(new Set());

  // ── draft store 동기화 ──
  useEffect(() => {
    configDraft.setDraft({
      wizardStep, customStoryline, suggestions, rounds,
      totalRounds, roundDistribution,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, customStoryline, suggestions, rounds, totalRounds, roundDistribution]);

  // Step 4 진입/회차 전환 시 활성 그룹 + 일반형 각각 주제·콘텐츠 AI 자동 채움
  useEffect(() => {
    if (wizardStep !== 4) return;
    const r = rounds[activeRoundIdx];
    if (!r) return;
    const targets = [...r.customGroups.filter(g => g.types.length > 0).map(g => g.id), 'general'];
    targets.forEach(targetId => { void autoFillTarget(activeRoundIdx, targetId); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, activeRoundIdx]);

  // 회차 전환 시 아코디언 초기화 (모두 펼침) + 미리보기 대상 일반형으로 리셋
  useEffect(() => {
    setCollapsedSections(new Set());
    setSuggestionsTarget('general');
    setPreviewTargetId('general');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoundIdx]);

  // 생성 결과 미러 동기화
  useEffect(() => { generatedContentRef.current = generatedContent; }, [generatedContent]);

  // 미리보기 모달 열림: Step 4 실시간 미리보기 결과 재활용 + 미생성 회차 백그라운드 순차 생성(1회차 우선)
  useEffect(() => {
    if (!previewOpen) return;
    void runPreviewPregen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen]);

  // Step 4: 활성 회차의 일반형 + 그룹 본문을 주제/콘텐츠 기준으로 백그라운드 자동 생성 (debounce 1초)
  // - 진입/회차전환 시 활성 회차의 전 대상 생성([수정1·4]), 탭 전환과 무관하게 미리 준비됨([수정5])
  // - 인터랙션/만족도는 시그니처에서 제외 → 토글해도 본문 재생성 안 함
  // - 주제/콘텐츠가 바뀌면 편집 보호와 무관하게 항상 재생성([수정1·3]) · 현재 구성과 sig 다르면 재생성([수정2])
  useEffect(() => {
    if (wizardStep !== 4) return;
    const r = rounds[activeRoundIdx];
    if (!r) return;
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const targetList = [
      { targetId: 'general', topic: r.topic, ids: r.contents.map(c => c.id) },
      ...activeGroups.map(g => ({ targetId: g.id, topic: g.topic, ids: g.contents.map(c => c.id) })),
    ];
    const timers = livePreviewTimers.current;
    targetList.forEach(({ targetId, topic, ids }) => {
      if (!topic.trim() && ids.length === 0) return; // 주제/콘텐츠 없으면 생성하지 않음
      const sig = JSON.stringify({ roundIdx: activeRoundIdx, targetId, topic, ids });
      const key = `${activeRoundIdx}:${targetId}`;
      if (livePreviewSigRef.current[key] === sig) return; // 현재 구성과 동일 — 이미 최신 (탭 전환 등)
      // 주제/콘텐츠 변경 → 편집 본문은 폐기하고 새로 생성 (general은 모달 캐시·편집 표시도 무효화)
      if (targetId === 'general') {
        editedRoundsRef.current.delete(activeRoundIdx);
        delete generatedContentRef.current[activeRoundIdx];
        setGeneratedContent(prev => { const n = { ...prev }; delete n[activeRoundIdx]; return n; });
      }
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(async () => {
        livePreviewSigRef.current[key] = sig;
        await generateLivePreview(activeRoundIdx, targetId);
      }, 1000);
    });
    return () => {
      targetList.forEach(({ targetId }) => {
        const key = `${activeRoundIdx}:${targetId}`;
        if (timers[key]) clearTimeout(timers[key]);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, activeRoundIdx, rounds]);

  // 아코디언 펼침 여부 (collapsedSections에 없으면 펼침)
  function isSectionOpen(key: string): boolean {
    return !collapsedSections.has(key);
  }

  function toggleSectionKey(key: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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

  async function handleGenerateRound(roundIdx: number, force = false) {
    const round = rounds[roundIdx];
    if (!round) return;
    if (!force && generatingRoundsRef.current.has(roundIdx)) return; // 이미 진행 중 — 중복 호출 방지
    generatingRoundsRef.current.add(roundIdx);
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
      generatedContentRef.current = { ...generatedContentRef.current, [roundIdx]: data };
      setGeneratedContent(prev => ({ ...prev, [roundIdx]: data }));
    } catch (e) {
      console.error('뉴스레터 생성 오류:', e);
    } finally {
      generatingRoundsRef.current.delete(roundIdx);
      setGeneratingRounds(prev => {
        const s = new Set(prev);
        s.delete(roundIdx);
        return s;
      });
    }
  }

  // 모달 진입 시: 콘텐츠 구성 단계에서 만든 본문을 재활용만 함 (새로 생성하지 않음 — [수정5])
  // 미생성 회차는 탭 클릭 시 selectPreviewTab에서 지연 생성
  function runPreviewPregen() {
    const seed: Record<number, GeneratedNewsletter> = {};
    rounds.forEach((_, idx) => {
      const reused = livePreviewContent[`${idx}:general`];
      if (reused && !generatedContentRef.current[idx]) seed[idx] = reused;
    });
    if (Object.keys(seed).length > 0) {
      generatedContentRef.current = { ...generatedContentRef.current, ...seed };
      setGeneratedContent(prev => ({ ...seed, ...prev }));
    }
  }

  // 미리보기 모달: 회차 탭 클릭 — 해당 회차가 미생성·미진행 중이면 그때 생성
  function selectPreviewTab(idx: number) {
    setPreviewTab(idx);
    setEditMode(false);
    setEditDraft(null);
    if (generatedContentRef.current[idx]) return; // 이미 생성됨 (캐시 유지)
    if (generatingRoundsRef.current.has(idx)) return; // 이미 진행 중
    void handleGenerateRound(idx);
  }

  // ── 본문 편집 (미리보기 모달) ──
  function startEdit() {
    const gen = generatedContent[previewTab];
    if (!gen) return;
    setEditDraft(JSON.parse(JSON.stringify(gen)) as GeneratedNewsletter); // 작업용 깊은 복사
    setEditMode(true);
  }
  function cancelEdit() {
    setEditMode(false);
    setEditDraft(null);
  }
  function saveEdit() {
    if (!editDraft) return;
    const idx = previewTab;
    generatedContentRef.current = { ...generatedContentRef.current, [idx]: editDraft };
    setGeneratedContent(prev => ({ ...prev, [idx]: editDraft }));
    // 좌측 실시간 미리보기(일반형)에도 반영
    setLivePreviewContent(prev => ({ ...prev, [`${idx}:general`]: editDraft }));
    editedRoundsRef.current.add(idx); // "편집됨" 표시 (콘텐츠 변경 시 자동 해제·재생성)
    setEditMode(false);
    setEditDraft(null);
  }
  function updateEditField(field: 'subject' | 'headline' | 'intro' | 'closing', value: string) {
    setEditDraft(prev => prev ? { ...prev, [field]: value } : prev);
  }
  function updateEditSection(secIdx: number, field: 'contentTitle' | 'intro' | 'mainBody' | 'examples' | 'summary' | 'keyTakeaway', value: string) {
    setEditDraft(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, i) => i === secIdx ? { ...s, [field]: value } : s);
      return { ...prev, sections };
    });
  }
  // Action Plan은 줄바꿈으로 구분된 textarea로 편집
  function updateEditActionPlan(secIdx: number, value: string) {
    setEditDraft(prev => {
      if (!prev) return prev;
      const list = value.split('\n').map(s => s.trim()).filter(Boolean);
      const sections = prev.sections.map((s, i) => i === secIdx ? { ...s, actionPlan: list } : s);
      return { ...prev, sections };
    });
  }

  // ── Step 4 좌측 실시간 미리보기: 그룹/일반형 단위로 generate API 호출 ──
  async function generateLivePreview(roundIdx: number, targetId: string) {
    const r = rounds[roundIdx];
    if (!r) return;
    const isCustom = targetId !== 'general';
    const group = isCustom ? r.customGroups.find(g => g.id === targetId) : undefined;
    if (isCustom && !group) return;
    const topic = isCustom ? (group?.topic ?? '') : r.topic;
    const contents = isCustom ? (group?.contents ?? []) : r.contents;
    const interactions = isCustom ? (group?.interactions ?? []) : r.interactions;
    const surveys = isCustom ? (group?.surveys ?? []) : r.surveys;
    if (!topic.trim() && contents.length === 0) return;
    const key = `${roundIdx}:${targetId}`;
    setLivePreviewGenerating(prev => new Set([...prev, key]));
    try {
      const res = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: {
            id: r.id,
            topic,
            stepLabel: customStoryline[r.stepIndex]?.title ?? '',
            contents,
            interactions,
            surveys,
          },
          leadershipType: isCustom && group && group.types.length > 0 ? group.types.join(', ') : '일반형',
          companyName: targetCompanies.map(c => c.name).join(', ') || '대상 기업',
        }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const data: GeneratedNewsletter = await res.json();
      setLivePreviewContent(prev => ({ ...prev, [key]: data }));
    } catch (e) {
      console.error('미리보기 생성 오류:', e);
    } finally {
      setLivePreviewGenerating(prev => { const s = new Set(prev); s.delete(key); return s; });
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
  async function fetchTopicsForRound(roundIdx: number, targetId: string = 'general') {
    setIsLoadingTopics(true);
    setTopicError(null);
    setSuggestions([]);
    setSuggestionsTarget(targetId);
    const isCustom = targetId !== 'general';
    try {
      const currentRound = rounds[roundIdx];
      const group = isCustom ? currentRound?.customGroups.find(g => g.id === targetId) : undefined;
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadershipTypes: (isCustom && group && group.types.length > 0) ? group.types : ['일반형'],
          companyName: targetCompanies[0]?.name ?? '',
          kind: isCustom ? '맞춤형' : '일반형',
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

  // 회차 진입 시 주제 자동 추천 → 첫 추천 자동 선택 → 콘텐츠 자동 서칭 (공유 suggestions UI 미사용)
  async function autoFillTarget(roundIdx: number, targetId: string) {
    const key = `${roundIdx}:${targetId}`;
    if (autoFilledRef.current.has(key)) return;
    const isCustom = targetId !== 'general';
    const r = rounds[roundIdx];
    if (!r) return;
    const group = isCustom ? r.customGroups.find(g => g.id === targetId) : undefined;
    if (isCustom && !group) return;
    const existingTopic = isCustom ? (group?.topic ?? '') : r.topic;
    autoFilledRef.current.add(key);
    if (existingTopic.trim()) return; // 이미 주제 있으면 가드만 등록하고 스킵
    // 주제 추천 호출 (실패 시 1회 자동 재시도) — 유형/단계/회차/기업명 모두 반영
    const requestTopics = async (): Promise<TopicSuggestion[] | null> => {
      const body = JSON.stringify({
        leadershipTypes: (isCustom && group && group.types.length > 0) ? group.types : ['일반형'],
        companyName: targetCompanies[0]?.name ?? '',
        kind: isCustom ? '맞춤형' : '일반형',
        stepTitle: customStoryline[r.stepIndex]?.title ?? '',
        roundIndex: roundIdx + 1,
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/topics/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
          if (res.ok) {
            const data = await res.json() as { topics: TopicSuggestion[] };
            if (data.topics?.length) return data.topics;
          }
        } catch { /* 재시도 */ }
      }
      return null;
    };
    setPreparingTargets(prev => new Set([...prev, key])); // 준비 중 표시 시작
    try {
      const topics = await requestTopics();
      const first = topics?.[0]?.title;
      if (!first) { autoFilledRef.current.delete(key); return; }
      if (isCustom) setGroupTopic(roundIdx, targetId, first);
      else setRoundTopic(roundIdx, first);
      if (isCustom) await suggestGroupContents(roundIdx, targetId, first);
      else await suggestContentsForRound(roundIdx, first);
    } finally {
      setPreparingTargets(prev => { const s = new Set(prev); s.delete(key); return s; });
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

  function openContentPool(isCustom = false, groupId: string | null = null) {
    setContentPoolForCustom(isCustom);
    setContentPoolGroupId(groupId);
    setContentPoolQuery('');
    setContentPoolCategoryFilter('');
    void loadContentPool('', '');
    setContentPoolOpen(true);
  }

  // 그룹 단위 업데이트 헬퍼
  function updateGroup(roundIdx: number, groupId: string, patch: (g: CustomGroup) => CustomGroup) {
    setRounds(prev => prev.map((r, i) =>
      i !== roundIdx ? r : { ...r, customGroups: r.customGroups.map(g => g.id === groupId ? patch(g) : g) }
    ));
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

  function setGroupTopic(roundIdx: number, groupId: string, topic: string) {
    updateGroup(roundIdx, groupId, g => ({ ...g, topic }));
  }

  function addCustomContentToGroup(item: ContentPoolItem, groupId: string) {
    updateGroup(activeRoundIdx, groupId, g => ({
      ...g,
      contents: g.contents.some(c => c.id === item.id) ? g.contents : [...g.contents, item],
    }));
  }

  function removeCustomContentFromGroup(roundIdx: number, groupId: string, itemId: string) {
    updateGroup(roundIdx, groupId, g => ({ ...g, contents: g.contents.filter(c => c.id !== itemId) }));
  }

  function toggleGroupInteraction(roundIdx: number, groupId: string, val: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont') {
    updateGroup(roundIdx, groupId, g => ({
      ...g,
      interactions: g.interactions.includes(val) ? g.interactions.filter(v => v !== val) : [...g.interactions, val],
    }));
  }

  function toggleGroupSurvey(roundIdx: number, groupId: string, val: 'always' | 'periodic') {
    updateGroup(roundIdx, groupId, g => ({
      ...g,
      surveys: g.surveys.includes(val) ? g.surveys.filter(v => v !== val) : [...g.surveys, val],
    }));
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
          leadershipType: '일반형',
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

  async function suggestGroupContents(roundIdx: number, groupId: string, topic: string) {
    if (!topic.trim()) return;
    setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = true; return n; });
    try {
      const r = rounds[roundIdx];
      const group = r?.customGroups.find(g => g.id === groupId);
      const res = await fetch('/api/contents/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          leadershipType: group && group.types.length ? group.types.join(', ') : '맞춤형',
          storyStage: customStoryline[r?.stepIndex ?? 0]?.title ?? '',
          existingIds: group?.contents.map(c => c.id) ?? [],
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as { contents: ContentPoolItem[] };
      if (!data.contents?.length) return;
      updateGroup(roundIdx, groupId, g => ({
        ...g,
        contents: [...g.contents, ...data.contents.filter(s => !g.contents.some(c => c.id === s.id))],
      }));
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
    if (wizardStep === 4) return true;
    return true;
  }

  function goNext() {
    if (wizardStep >= 5 || !canGoNext()) return;
    if (wizardStep === 2) {
      const newBase = makeRoundsFromDistribution(roundDistribution);
      const newTotal = newBase.length;
      setRounds(prev => {
        const merged = prev.length === 0
          ? newBase
          : prev.length >= newTotal
            ? prev.slice(0, newTotal)
            : [...prev, ...newBase.slice(prev.length)];
        // 기본 그룹 초기화 (customGroups가 비어있는 회차에 부정 리더 전체를 그룹 1로)
        return merged.map(r => r.customGroups.length > 0 ? r : { ...r, customGroups: buildDefaultGroups() });
      });
      setActiveRoundIdx(0);
      setSuggestions([]);
      setDistributionRoundIdx(0);
    }
    if (wizardStep === 3) {
      // customGroups 기반으로 각 round의 leaderIds / newsletterType 자동 세팅
      const nextRounds = rounds.map(r => {
        // 그룹별 leaderIds 재계산 + 빈 그룹 제거
        const groups = r.customGroups
          .map(g => ({ ...g, leaderIds: negativeParticipants.filter(p => g.types.includes(p.leadershipType)).map(p => p.id) }))
          .filter(g => g.types.length > 0);
        const customLeaderIds = Array.from(new Set(groups.flatMap(g => g.leaderIds)));
        const generalLeaderIds = selectedParticipants.filter(p => !customLeaderIds.includes(p.id)).map(p => p.id);
        const customTypesAll = groups.flatMap(g => g.types);
        const generalTypes = NEGATIVE_TYPES.filter(t => !customTypesAll.includes(t) && negativeParticipants.some(p => p.leadershipType === t));
        return {
          ...r,
          customGroups: groups,
          customLeaderIds,
          generalLeaderIds,
          generalTypes,
          newsletterType: groups.length > 0 ? '맞춤형' as const : '일반형' as const,
        };
      });
      setRounds(nextRounds);
      setActiveRoundIdx(0);
      setSuggestions([]);
      // 현재 활성 회차(0)만 자동 구성 — Step 4 진입 effect가 활성 회차의 그룹/일반형을 채움
      setWizardStep(4);
      return;
    }
    setWizardStep(prev => (prev + 1) as WizardStep);
  }

  // 기본 그룹: 회사의 부정 리더 전체를 하나의 그룹으로
  function buildDefaultGroups(): CustomGroup[] {
    const negTypes = NEGATIVE_TYPES.filter(t => negativeParticipants.some(p => p.leadershipType === t));
    if (negTypes.length === 0) return [];
    const leaderIds = negativeParticipants.filter(p => negTypes.includes(p.leadershipType)).map(p => p.id);
    return [makeCustomGroup(`g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, negTypes, leaderIds)];
  }

  function goPrev() {
    if (wizardStep > 1) { setWizardStep(prev => (prev - 1) as WizardStep); return; }
    // Step 1: 기업 선택 화면으로 복귀 + 기존 작업 내용(스토리라인/rounds 등) 초기화
    configDraft.resetDraft();
  }

  // 제작완료 시 회차별 생성 본문(전체본문 + 요약본) 저장 데이터 구성
  function buildSavedContent(): SavedNewsletterContent | undefined {
    if (!startDate || !deliveryInterval) return undefined;
    const schedDates = calcScheduleDates(startDate, deliveryInterval, rounds.length);
    const leadershipLabel = leadershipTypes.join(', ');
    const savedRounds: SavedNewsletterRound[] = [];
    rounds.forEach((r, idx) => {
      const gen = generatedContent[idx] ?? livePreviewContent[`${idx}:general`];
      if (!gen) return;
      savedRounds.push({
        vol: idx + 1,
        dateLabel: schedDates[idx] ? formatKoreanDate(schedDates[idx]) : '',
        leadershipLabel,
        generated: gen,
        interactions: r.interactions,
        surveys: r.surveys,
      });
    });
    return savedRounds.length > 0 ? { rounds: savedRounds } : undefined;
  }

  function handleSave(status: '제작 중' | '제작완료', savedContent?: SavedNewsletterContent) {
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
      generatedContent: savedContent,
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
    setEditMode(false);
    setEditDraft(null);
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
    handleSave('제작완료', buildSavedContent());
  }

  function switchRound(idx: number) {
    setActiveRoundIdx(idx);
    setSuggestions([]);
    setTopicError(null);
  }

  // ── Step 4: 주제/콘텐츠/인터랙션/만족도 4섹션 렌더 (일반형·맞춤형 그룹 공용) ──
  function renderContentSections(opts: {
    keyPrefix: string;
    targetId: string;
    topic: string;
    contents: ContentPoolItem[];
    interactions: ('quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont')[];
    surveys: ('always' | 'periodic')[];
    placeholder: string;
    setTopic: (t: string) => void;
    suggestContents: (t: string) => void;
    removeContent: (itemId: string) => void;
    toggleInteractionFn: (v: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont') => void;
    toggleSurveyFn: (v: 'always' | 'periodic') => void;
    openPool: () => void;
  }) {
    const { keyPrefix, targetId, topic, contents, interactions, surveys, placeholder } = opts;
    const kTopic = `${keyPrefix}:2`, kContent = `${keyPrefix}:3`, kInter = `${keyPrefix}:4`, kSurvey = `${keyPrefix}:5`;
    const isTarget = suggestionsTarget === targetId;
    return (
      <>
        {/* 주제 선정 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => toggleSectionKey(kTopic)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <p className="text-base font-medium text-gray-800 flex-1 text-left">주제 선정</p>
            {topic.trim() ? (<svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">필수</span>)}
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kTopic) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kTopic) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">이 회차 · 단계에 맞는 주제를 AI가 추천합니다.</p>
                  <button onClick={() => fetchTopicsForRound(activeRoundIdx, targetId)} disabled={isLoadingTopics} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ml-3 ${isLoadingTopics ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'}`}>
                    {isLoadingTopics ? (<><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>생성 중...</>) : (<><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>AI 재추천</>)}
                  </button>
                </div>
                {topicError && isTarget && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-xs text-red-600 flex-1">{topicError}</p>
                    <button onClick={() => fetchTopicsForRound(activeRoundIdx, targetId)} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">재시도</button>
                  </div>
                )}
                {suggestions.length > 0 && isTarget ? (
                  <div className="space-y-2">
                    {suggestions.map((sg, idx) => {
                      const isSelected = topic === sg.title;
                      return (
                        <button key={idx} onClick={() => { opts.setTopic(sg.title); if (!contents.length) opts.suggestContents(sg.title); }} className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all ${isSelected ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isSelected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'}`}>{isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                          <div className="flex-1 min-w-0"><p className={`text-sm font-semibold leading-snug ${isSelected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>{sg.title}</p><p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{sg.description}</p></div>
                        </button>
                      );
                    })}
                  </div>
                ) : topic.trim() ? (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-[#55A4DA] bg-[#55A4DA]/5">
                    <div className="w-4 h-4 rounded-full border-2 border-[#55A4DA] bg-[#55A4DA] flex items-center justify-center flex-shrink-0 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#55A4DA] mb-0.5">AI 추천 주제</p>
                      <p className="text-sm font-semibold text-[#2E7DB5] leading-snug">{topic}</p>
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">직접 입력 또는 추천 주제 수정</p>
                  <input type="text" value={topic} onChange={e => opts.setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) opts.suggestContents(topic.trim()); }} placeholder={placeholder} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 콘텐츠 선택 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div onClick={() => toggleSectionKey(kContent)} className="px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <p className="text-base font-medium text-gray-800 flex-1">콘텐츠 선택</p>
            {contents.length > 0 ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{contents.length}개 선택됨</span>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <button onClick={e => { e.stopPropagation(); if (topic.trim()) opts.suggestContents(topic.trim()); }} disabled={!topic.trim() || contentSuggestLoading[activeRoundIdx]} className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ml-2 flex-shrink-0 border ${!topic.trim() || contentSuggestLoading[activeRoundIdx] ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#55A4DA] text-[#55A4DA] hover:bg-[#55A4DA]/5'}`} title={topic.trim() ? '현재 주제로 콘텐츠 다시 가져오기' : '주제를 먼저 선택하세요'}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>콘텐츠 다시 가져오기</button>
            <button onClick={e => { e.stopPropagation(); opts.openPool(); }} className="flex items-center gap-1 px-2.5 py-1 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-xs font-bold rounded-lg transition-colors ml-1.5 flex-shrink-0"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>콘텐츠 풀</button>
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kContent) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kContent) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-4">
                {contents.length === 0 && !contentSuggestLoading[activeRoundIdx] ? (
                  <button onClick={() => opts.openPool()} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex flex-col items-center gap-1.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>콘텐츠 풀에서 선택하세요</button>
                ) : (
                  <div className="space-y-2">
                    {contents.map(item => (
                      <div key={item.id} className="border border-gray-100 rounded-xl px-3 pt-2.5 pb-2 group bg-gray-50">
                        <div className="flex items-center gap-3">
                          {item.thumbnail && <img src={item.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-200" />}
                          <div className="flex-1 min-w-0"><div className="flex items-center gap-1 mb-0.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{item.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span><span className="text-[10px] text-gray-400">{item.category} · {item.duration}분</span></div><p className="text-xs font-semibold text-gray-700 truncate">{item.title}</p></div>
                          <button onClick={() => opts.removeContent(item.id)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        {item.body && <button onClick={() => setContentPreviewItem(item)} className="mt-1.5 text-[11px] text-[#55A4DA] hover:text-[#2E7DB5] font-medium transition-colors">내용 보기 →</button>}
                      </div>
                    ))}
                    {contentSuggestLoading[activeRoundIdx] && (<div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-dashed border-[#55A4DA]/40 bg-[#55A4DA]/5"><svg className="w-3.5 h-3.5 animate-spin text-[#55A4DA] flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg><p className="text-xs text-[#55A4DA] font-medium">AI가 콘텐츠를 선택하는 중...</p></div>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* 인터랙션 요소 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => toggleSectionKey(kInter)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <p className="text-base font-medium text-gray-800 flex-1 text-left">인터랙션 요소</p>
            {interactions.length > 0 ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{interactions.map(v => INTERACTION_LABELS[v] ?? v).join(' · ')}</span>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kInter) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kInter) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-5 space-y-2">
                <p className="text-xs text-gray-400 mb-3">학습 참여도를 높이는 인터랙션 요소를 선택하세요. 복수 선택 가능합니다.</p>
                {([{ val: 'quiz' as const, label: '퀴즈', desc: '학습 내용 확인 퀴즈' }, { val: 'scenario' as const, label: '선택형 시나리오', desc: '상황을 주고 A/B/C 중 선택하면 유형별 피드백을 주는 인터랙션' }, { val: 'selfcheck' as const, label: '셀프 진단/체크리스트', desc: '정답 없이 스스로를 점검하는 체크리스트 (예: 나는 팀원 의견을 충분히 듣는가?)' }, { val: 'reflection' as const, label: '회고 질문', desc: '성찰을 유도하는 열린 질문 (예: 이번 주 바꾸고 싶은 내 행동은?)' }, { val: 'dodont' as const, label: "Do & Don't 리스트", desc: '해야 할 것과 하지 말아야 할 것을 명확하게 정리한 실천 가이드' }]).map(({ val, label, desc }) => {
                  const checked = interactions.includes(val);
                  return (<button key={val} onClick={() => opts.toggleInteractionFn(val)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'}`}>{checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div><div><p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{label}</p><p className="text-[11px] text-gray-400">{desc}</p></div></button>);
                })}
              </div>
            </div>
          </div>
        </div>
        {/* 만족도 조사 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => toggleSectionKey(kSurvey)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <p className="text-base font-medium text-gray-800 flex-1 text-left">만족도 조사</p>
            {surveys.length > 0 ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{surveys.map(v => v === 'always' ? '상시' : '정기').join(' · ')}</span>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kSurvey) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kSurvey) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-5 space-y-2">
                <p className="text-xs text-gray-400 mb-3">이 회차에 포함할 만족도 조사를 선택하세요. 중복 선택 가능합니다.</p>
                {([{ val: 'always' as const, label: '상시 만족도 조사', desc: '매 회차 발송 후 수집' }, { val: 'periodic' as const, label: '정기 만족도 조사', desc: '주기적으로 심층 수집' }]).map(({ val, label, desc }) => {
                  const checked = surveys.includes(val);
                  return (<button key={val} onClick={() => opts.toggleSurveyFn(val)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'}`}>{checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div><div><p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{label}</p><p className="text-[11px] text-gray-400">{desc}</p></div></button>);
                })}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Step 4: 좌측 실시간 미리보기 (우측 편집 내용을 그대로 반영) ──
  function renderLivePreview(targetId: string) {
    const r = rounds[activeRoundIdx];
    if (!r) return null;
    const isCustom = targetId !== 'general';
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const group = isCustom ? activeGroups.find(g => g.id === targetId) : undefined;
    const topic = isCustom ? (group?.topic ?? '') : r.topic;
    const contents = isCustom ? (group?.contents ?? []) : r.contents;
    const interactions = isCustom ? (group?.interactions ?? []) : r.interactions;
    const surveys = isCustom ? (group?.surveys ?? []) : r.surveys;
    const firstThumbnail = contents[0]?.thumbnail ?? '';
    const hasConfig = topic.trim().length > 0 || contents.length > 0 || interactions.length > 0 || surveys.length > 0;
    const leadershipLabel = isCustom ? (group?.types.join(', ') ?? '') : '일반형';
    const key = `${activeRoundIdx}:${targetId}`;
    const generated = livePreviewContent[key];
    // 백그라운드 준비 중(주제 추천·콘텐츠 서칭) 또는 본문 생성 중 여부
    const preparing = preparingTargets.has(key) || livePreviewGenerating.has(key);

    if (!hasConfig) {
      // 준비 중이면 로딩 안내, 아니면 빈 상태
      if (preparing) {
        return (
          <div className="h-full min-h-[480px] rounded-2xl shadow-md border border-[#D6EAF8] bg-white flex flex-col items-center justify-center py-20 px-6 gap-3 text-center">
            <svg className="w-8 h-8 text-[#2B9EE8] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
            <p className="text-sm font-semibold text-gray-700">AI가 콘텐츠를 준비하고 있어요...</p>
            <p className="text-xs text-gray-400">주제 추천 → 콘텐츠 선택 → 본문 생성 (약 1분 소요)</p>
          </div>
        );
      }
      return (
        <div className="h-full min-h-[480px] rounded-2xl shadow-md border border-[#D6EAF8] bg-white flex flex-col items-center justify-center py-20 px-6 gap-2 text-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p className="text-xs text-gray-400">콘텐츠를 추가하면 여기에 표시됩니다</p>
        </div>
      );
    }

    // AI 본문이 아직 없을 때: 본문 영역은 로딩, 인터랙션/만족도 템플릿은 즉시 표시
    if (!generated) {
      return (
        <div className="bg-white max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100 break-keep break-words">
          {/* 상단 네비게이션 */}
          <div className="px-6 sm:px-8 py-4 flex items-center justify-between border-b border-gray-100">
            <img src="/logo-jc.png" alt="J&Company" className="h-9 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p className="text-xs text-[#6B7280]">Vol.{activeRoundIdx + 1}{leadershipLabel ? ` · ${leadershipLabel}` : ''}</p>
          </div>
          <div className="px-6 sm:px-8 py-10">
            <div className="rounded-2xl py-16 px-5 border border-[#E1EFFB] flex flex-col items-center justify-center gap-3 text-center" style={{ backgroundColor: '#F0F7FF' }}>
              <svg className="w-7 h-7 text-[#2B9EE8] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              <p className="text-sm font-semibold text-gray-700">AI가 콘텐츠를 준비하고 있어요...</p>
              <p className="text-xs text-gray-400">본문을 생성하고 있어요 (약 1분 소요)</p>
            </div>
            {renderInteractionTemplates(interactions)}
            {renderSurveyTemplates(surveys)}
          </div>
        </div>
      );
    }

    if (livePreviewMode === 'email') {
      return renderNewsletterEmailPreview(generated, { vol: activeRoundIdx + 1, dateLabel: '발송일 미정', firstThumbnail, onReadFull: () => setLivePreviewMode('full') });
    }
    return renderGeneratedFullBody(generated, { vol: activeRoundIdx + 1, dateLabel: '발송일 미정', leadershipLabel, firstThumbnail, templateInteractions: interactions, templateSurveys: surveys });
  }

  // 명시적 AI 재생성 (편집 내용 폐기 후 덮어쓰기)
  function regenerateCurrent() {
    editedRoundsRef.current.delete(previewTab);
    setEditMode(false);
    setEditDraft(null);
    void handleGenerateRound(previewTab, true);
  }

  // ── 본문 편집 패널 (미리보기 모달) ──
  function renderEditPanel() {
    if (!editDraft) return null;
    const labelCls = 'text-xs font-bold text-gray-500 mb-1.5 block';
    const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#55A4DA] focus:outline-none focus:ring-1 focus:ring-[#55A4DA]/30 transition-colors';
    const areaCls = inputCls + ' resize-y leading-relaxed';
    return (
      <div className="bg-white rounded-2xl border border-gray-200 max-w-2xl mx-auto p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1">
          <svg className="w-4 h-4 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <p className="text-sm font-bold text-gray-800">본문 편집</p>
        </div>
        <div>
          <label className={labelCls}>이번 호 제목 (subject)</label>
          <input className={inputCls} value={editDraft.subject} onChange={e => updateEditField('subject', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>헤드라인 (headline)</label>
          <textarea className={areaCls} rows={2} value={editDraft.headline} onChange={e => updateEditField('headline', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>인트로 (intro)</label>
          <textarea className={areaCls} rows={3} value={editDraft.intro} onChange={e => updateEditField('intro', e.target.value)} />
        </div>
        <div className="space-y-4 pt-1">
          <p className="text-xs font-bold text-gray-500">콘텐츠 섹션</p>
          {editDraft.sections.map((sec, i) => (
            <div key={sec.contentId ?? i} className="rounded-xl border border-gray-100 p-4 space-y-3" style={{ backgroundColor: '#F8FAFC' }}>
              <div>
                <label className={labelCls}>{i + 1}. 제목</label>
                <input className={inputCls} value={sec.contentTitle} onChange={e => updateEditSection(i, 'contentTitle', e.target.value)} />
              </div>
              {sec.summary !== undefined && sec.intro === undefined && sec.mainBody === undefined ? (
                <div>
                  <label className={labelCls}>요약</label>
                  <textarea className={areaCls} rows={2} value={sec.summary} onChange={e => updateEditSection(i, 'summary', e.target.value)} />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>도입</label>
                    <textarea className={areaCls} rows={2} value={sec.intro ?? ''} onChange={e => updateEditSection(i, 'intro', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>본문</label>
                    <textarea className={areaCls} rows={3} value={sec.mainBody ?? ''} onChange={e => updateEditSection(i, 'mainBody', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>사례/데이터</label>
                    <textarea className={areaCls} rows={2} value={sec.examples ?? ''} onChange={e => updateEditSection(i, 'examples', e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <label className={labelCls}>💡 핵심 포인트</label>
                <textarea className={areaCls} rows={2} value={sec.keyTakeaway} onChange={e => updateEditSection(i, 'keyTakeaway', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>✅ Action Plan (한 줄에 하나씩)</label>
                <textarea className={areaCls} rows={3} value={(sec.actionPlan ?? []).join('\n')} onChange={e => updateEditActionPlan(i, e.target.value)} placeholder={'오늘 당장 할 수 있는 행동\n이번 주에 시도해볼 행동\n지속적으로 적용할 행동'} />
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className={labelCls}>마무리 (closing)</label>
          <textarea className={areaCls} rows={3} value={editDraft.closing} onChange={e => updateEditField('closing', e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={saveEdit} className="px-5 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors">저장</button>
        </div>
      </div>
    );
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
        {configDraft.companyIds.length > 0 && (
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
        )}
      </div>

      {/* ── 기업 선택: 미선택 시 전체 화면 ── */}
      {configDraft.companyIds.length === 0 && (() => {
        const filtered = companies.filter(c => !companySearch.trim() || c.name.includes(companySearch.trim()));
        return (
          <div className="flex-1 overflow-y-auto bg-[#F8FAFC] flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-3xl">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">뉴스레터 대상 기업 선택</h2>
                <p className="text-sm text-gray-400">뉴스레터를 발송할 기업을 선택해주세요.</p>
              </div>
              <div className="relative mb-6">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="기업명 검색"
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                  autoFocus
                />
              </div>
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">검색 결과가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        configDraft.setDraft({ companyIds: [c.id] });
                        setCompanySearch('');
                      }}
                      className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-[#55A4DA] hover:shadow-md transition-all group text-center"
                    >
                      <div className={`w-14 h-14 rounded-2xl ${c.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-base font-bold">{c.initials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-[#2E7DB5] transition-colors">{c.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.industry}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 기업 정보 바 (선택 후) ── */}
      {configDraft.companyIds.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-8 py-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400">대상 기업</span>
          <span className="text-sm font-semibold text-gray-800">{targetCompanies[0]?.name ?? '—'}</span>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-xs text-gray-500">
            대상 리더 <span className="font-semibold text-gray-700">{selectedParticipants.length}명</span>
          </span>
        </div>
      )}

      {/* ── 스테퍼 ── */}
      {configDraft.companyIds.length > 0 && <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-center flex-shrink-0">
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
      </div>}

      {/* ════════════════════════════════
          1단계: 스토리라인
      ════════════════════════════════ */}
      {wizardStep === 1 && configDraft.companyIds.length > 0 && (
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
          3단계: 리더십 유형 배분
      ════════════════════════════════ */}
      {wizardStep === 3 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="w-full px-8 py-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1">리더십 유형 배분</h2>
              <p className="text-xs text-gray-400">회차별로 맞춤형/일반형 대상 리더를 설정합니다. 부정 리더는 유형 단위로 드래그해 이동할 수 있습니다.</p>
            </div>

            {/* 회차 탭 */}
            {rounds.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {rounds.map((r, idx) => {
                  const s = customStoryline[r.stepIndex];
                  const isActive = idx === distributionRoundIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setDistributionRoundIdx(idx)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                        isActive ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#2E7DB5]' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {idx + 1}회차
                      {s && <span className="ml-1.5 font-normal text-gray-400">{s.title}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 배분 카드 */}
            {rounds[distributionRoundIdx] !== undefined && (() => {
              const r = rounds[distributionRoundIdx];
              const negTypes = NEGATIVE_TYPES.filter(t => negativeParticipants.some(p => p.leadershipType === t));
              const groups = r.customGroups;
              const typesInGroups = new Set(groups.flatMap(g => g.types));
              const negInGeneral = negTypes.filter(t => !typesInGroups.has(t));

              const countOf = (type: string) => negativeParticipants.filter(p => p.leadershipType === type).length;
              const generalCount = positiveParticipants.length + negInGeneral.reduce((s, t) => s + countOf(t), 0);

              // 유형을 특정 그룹(또는 일반형)으로 이동
              function moveType(type: string, targetGroupId: string | 'general') {
                setRounds(prev => prev.map((round, i) => {
                  if (i !== distributionRoundIdx) return round;
                  const stripped = round.customGroups.map(g => ({ ...g, types: g.types.filter(t => t !== type) }));
                  const next = targetGroupId === 'general'
                    ? stripped
                    : stripped.map(g => g.id === targetGroupId ? { ...g, types: g.types.includes(type) ? g.types : [...g.types, type] } : g);
                  const withCounts = next.map(g => ({ ...g, leaderIds: negativeParticipants.filter(p => g.types.includes(p.leadershipType)).map(p => p.id) }));
                  return { ...round, customGroups: withCounts };
                }));
              }

              function addGroup() {
                setRounds(prev => prev.map((round, i) => i !== distributionRoundIdx ? round : {
                  ...round,
                  customGroups: [...round.customGroups, makeCustomGroup(`g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)],
                }));
              }

              function removeGroup(groupId: string) {
                setRounds(prev => prev.map((round, i) => i !== distributionRoundIdx ? round : {
                  ...round,
                  customGroups: round.customGroups.filter(g => g.id !== groupId),
                }));
              }

              const TypeChip = ({ type, sourceId }: { type: string; sourceId: string }) => {
                const members = negativeParticipants.filter(p => p.leadershipType === type);
                const key = `${sourceId}:${type}`;
                const expanded = expandedTypeChips.has(key);
                return (
                  <div
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('leadershipType', type); e.dataTransfer.setData('sourceId', sourceId); }}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:border-[#55A4DA]/50 hover:shadow-sm transition-all select-none shadow-sm"
                  >
                    <button
                      onClick={() => setExpandedTypeChips(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      <span className="text-xs font-bold text-gray-900 flex-1">{type}</span>
                      <span className="text-[10px] font-semibold text-gray-500">{members.length}명</span>
                      <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </button>
                    {expanded && (
                      <div className="px-3.5 pb-2.5 pt-0.5 space-y-1 border-t border-gray-100">
                        {members.map(p => (
                          <div key={p.id} className="flex items-center gap-2 py-1">
                            <span className="text-xs font-medium text-gray-700 flex-1">{p.name} {p.position}</span>
                            <span className="text-[10px] text-gray-400">{p.leadershipType}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* 일반형 카드 */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOverTarget('general'); }}
                    onDragLeave={() => setDragOverTarget(null)}
                    onDrop={e => {
                      e.preventDefault();
                      const type = e.dataTransfer.getData('leadershipType');
                      if (type) moveType(type, 'general');
                      setDragOverTarget(null);
                    }}
                    className={`rounded-2xl border-2 transition-all ${dragOverTarget === 'general' ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 bg-white'}`}
                  >
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800 flex-1">일반형</p>
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{generalCount}명</span>
                    </div>
                    <div className="p-4 space-y-2 min-h-[180px]">
                      {/* 긍정 리더 토글 */}
                      {positiveParticipants.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <button onClick={() => setPositiveExpanded(prev => !prev)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left">
                            <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${positiveExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            <span className="text-xs font-bold text-gray-900 flex-1">긍정 리더</span>
                            <span className="text-[10px] font-semibold text-gray-500">{positiveParticipants.length}명</span>
                          </button>
                          {positiveExpanded && (
                            <div className="px-3.5 pb-2.5 pt-0.5 space-y-1 border-t border-gray-100">
                              {positiveParticipants.map(p => (
                                <div key={p.id} className="flex items-center gap-2 py-1">
                                  <span className="text-xs font-medium text-gray-700 flex-1">{p.name} {p.position}</span>
                                  <span className="text-[10px] text-gray-400">{p.leadershipType}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* 이동된 부정 리더 (드래그 가능) */}
                      {negInGeneral.map(type => (
                        <TypeChip key={type} type={type} sourceId="general" />
                      ))}
                      {positiveParticipants.length === 0 && negInGeneral.length === 0 && (
                        <div className="flex items-center justify-center h-24 text-xs text-gray-300">
                          유형을 드래그해 이동하세요
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 맞춤형 영역 (그룹들) */}
                  <div className="rounded-2xl border-2 border-gray-200 bg-white">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                      <p className="text-sm font-bold text-[#2E7DB5] flex-1">맞춤형</p>
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{groups.reduce((s, g) => s + g.types.reduce((a, t) => a + countOf(t), 0), 0)}명</span>
                    </div>
                    <div className="p-4 space-y-3 min-h-[180px]">
                      {groups.map((g, gi) => {
                        const groupCount = g.types.reduce((s, t) => s + countOf(t), 0);
                        return (
                          <div
                            key={g.id}
                            onDragOver={e => { e.preventDefault(); setDragOverTarget(g.id); }}
                            onDragLeave={() => setDragOverTarget(null)}
                            onDrop={e => {
                              e.preventDefault();
                              const type = e.dataTransfer.getData('leadershipType');
                              if (type) moveType(type, g.id);
                              setDragOverTarget(null);
                            }}
                            className={`rounded-xl border transition-all ${dragOverTarget === g.id ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 bg-gray-50/40'}`}
                          >
                            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                              <p className="text-xs font-bold text-[#2E7DB5] flex-1">그룹 {gi + 1}</p>
                              <span className="text-[10px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-full">{groupCount}명</span>
                              <button onClick={() => removeGroup(g.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="그룹 삭제">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <div className="p-3 space-y-2 min-h-[72px]">
                              {g.types.length > 0 ? (
                                g.types.map(type => <TypeChip key={type} type={type} sourceId={g.id} />)
                              ) : (
                                <div className="flex items-center justify-center h-14 text-xs text-gray-300">
                                  유형을 이 그룹으로 드래그하세요
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={addGroup} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-semibold text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        그룹 추가
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {rounds.length === 0 && (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                2단계에서 회차를 먼저 설계해주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          4단계: 콘텐츠 구성 (회차별 통합)
      ════════════════════════════════ */}
      {wizardStep === 4 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex flex-col">
          {rounds.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              2단계에서 회차를 먼저 설계해주세요.
            </div>
          ) : (
          <>
            {/* 상단: 회차 탭 (Step 3 스타일) */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
              <div className="flex gap-2 flex-wrap">
                {rounds.map((r, idx) => {
                  const s = customStoryline[r.stepIndex];
                  const isActive = idx === activeRoundIdx;
                  const activeGroups = r.customGroups.filter(g => g.types.length > 0);
                  const isDone = activeGroups.length > 0
                    ? activeGroups.every(g => g.topic.trim().length > 0) && r.topic.trim().length > 0
                    : r.topic.trim().length > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => switchRound(idx)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all flex items-center gap-1.5 ${
                        isActive ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#2E7DB5]' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {isDone && (
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      )}
                      {idx + 1}회차
                      {s && <span className="font-normal text-gray-400">{s.title}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 그룹/일반형 탭 (좌우 공용) */}
            {(() => {
              const r = rounds[activeRoundIdx];
              if (!r) return null;
              const activeGroups = r.customGroups.filter(g => g.types.length > 0);
              const tabs = [{ id: 'general', label: '일반형' }, ...activeGroups.map((g, gi) => ({ id: g.id, label: `그룹 ${gi + 1}` }))];
              const currentTarget = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
              return (
                <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex-shrink-0">
                  <div className="flex gap-1.5 flex-wrap">
                    {tabs.map(t => (
                      <button key={t.id} onClick={() => setPreviewTargetId(t.id)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${currentTarget === t.id ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{t.label}</button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 본문: 좌우 2분할 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 좌측: 실시간 미리보기 */}
              <div className="w-1/2 flex-shrink-0 border-r border-gray-200 overflow-y-auto px-6 py-4">
                {(() => {
                  const r = rounds[activeRoundIdx];
                  if (!r) return null;
                  const activeGroups = r.customGroups.filter(g => g.types.length > 0);
                  const tabs = [{ id: 'general', label: '일반형' }, ...activeGroups.map((g, gi) => ({ id: g.id, label: `그룹 ${gi + 1}` }))];
                  const current = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
                  // 현재 미리보기 대상 설명 (우측 헤더와 동일 표현)
                  const targetDesc = (() => {
                    if (current === 'general') {
                      const gParts = selectedParticipants.filter(p => r.generalLeaderIds.includes(p.id));
                      const posCount = gParts.filter(p => POSITIVE_TYPES.includes(p.leadershipType)).length;
                      const detailArr: string[] = [];
                      if (posCount > 0) detailArr.push(`긍정 리더 ${posCount}명`);
                      (r.generalTypes ?? []).forEach(t => {
                        const n = gParts.filter(p => p.leadershipType === t).length;
                        if (n > 0) detailArr.push(`${t} ${n}명`);
                      });
                      return { title: '일반형', detail: detailArr.join(' + '), count: r.generalLeaderIds.length };
                    }
                    const gi = activeGroups.findIndex(g => g.id === current);
                    const g = activeGroups[gi];
                    return { title: `맞춤형 그룹 ${gi + 1}`, detail: g ? g.types.join('+') : '', count: g?.leaderIds.length ?? 0 };
                  })();
                  return (
                    <div className="flex flex-col h-full">
                      <div className="pb-3 flex-shrink-0 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-gray-800">실시간 미리보기</p>
                          <p className="text-[11px] mt-0.5">
                            <span className="font-semibold text-[#2E7DB5]">{targetDesc.title}</span>
                            <span className="text-gray-400">{targetDesc.detail ? ` · ${targetDesc.detail}` : ''} ({targetDesc.count}명)</span>
                          </p>
                        </div>
                        {/* 전체본문 / 요약본 전환 토글 */}
                        <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg flex-shrink-0">
                          {([['full', '전체본문'], ['email', '요약본']] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              onClick={() => setLivePreviewMode(mode)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${livePreviewMode === mode ? 'bg-white text-[#2E7DB5] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="w-full flex-1">
                        {renderLivePreview(current)}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 우측: 콘텐츠 편집 (선택한 탭만) */}
              <div className="w-1/2 flex-shrink-0 overflow-y-auto px-6 py-4">
                {(() => {
              const r = rounds[activeRoundIdx];
              if (!r) return null;
              const s = customStoryline[r.stepIndex];
              const activeGroups = r.customGroups.filter(g => g.types.length > 0);
              const tabs = [{ id: 'general', label: '일반형' }, ...activeGroups.map((g, gi) => ({ id: g.id, label: `그룹 ${gi + 1}` }))];
              const currentTarget = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
              return (
                <div className="space-y-4">

                  {/* 회차 헤더 (박스 밖) */}
                  <div>
                    <p className="text-xl font-bold text-gray-900">{activeRoundIdx + 1}회차 콘텐츠 구성</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s?.title} · {s?.subtitle}</p>
                    <p className="text-xs text-gray-400 mt-1">유형 배분은 이전 단계에서 변경하세요.</p>
                  </div>

                  {/* 맞춤형 그룹 섹션 (선택한 탭만) */}
                  {activeGroups.map((g, gi) => {
                    if (g.id !== currentTarget) return null;
                    return (
                      <div key={g.id} className="bg-[#F0F7FF] rounded-xl p-6 space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-lg font-semibold text-gray-900">맞춤형 그룹 {gi + 1}</p>
                            <span className="text-sm text-gray-500 flex-shrink-0">{g.leaderIds.length}명</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {g.types.map(t => (
                              <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#55A4DA]/30 text-[#2E7DB5]">{t}</span>
                            ))}
                          </div>
                        </div>
                        {renderContentSections({
                          keyPrefix: `g:${g.id}`,
                          targetId: g.id,
                          topic: g.topic,
                          contents: g.contents,
                          interactions: g.interactions,
                          surveys: g.surveys,
                          placeholder: '맞춤형 뉴스레터 주제를 입력하세요 (Enter로 AI 콘텐츠 추천)',
                          setTopic: t => setGroupTopic(activeRoundIdx, g.id, t),
                          suggestContents: t => suggestGroupContents(activeRoundIdx, g.id, t),
                          removeContent: id => removeCustomContentFromGroup(activeRoundIdx, g.id, id),
                          toggleInteractionFn: v => toggleGroupInteraction(activeRoundIdx, g.id, v),
                          toggleSurveyFn: v => toggleGroupSurvey(activeRoundIdx, g.id, v),
                          openPool: () => openContentPool(true, g.id),
                        })}
                      </div>
                    );
                  })}

                  {/* 일반형 섹션 (일반형 탭일 때만) */}
                  {currentTarget === 'general' && (() => {
                    const generalParticipants = selectedParticipants.filter(p => r.generalLeaderIds.includes(p.id));
                    const posCount = generalParticipants.filter(p => POSITIVE_TYPES.includes(p.leadershipType)).length;
                    const negParts = (r.generalTypes ?? []).map(t => {
                      const n = generalParticipants.filter(p => p.leadershipType === t).length;
                      return n > 0 ? `${t} ${n}명` : null;
                    }).filter(Boolean) as string[];
                    const parts: string[] = [];
                    if (posCount > 0) parts.push(`긍정 리더 ${posCount}명`);
                    negParts.forEach(g => parts.push(g));
                    return (
                  <div className="bg-[#F0F7FF] rounded-xl p-6 space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-lg font-semibold text-gray-900">일반형</p>
                        <span className="text-sm text-gray-500 flex-shrink-0">{r.generalLeaderIds.length}명</span>
                      </div>
                      {parts.length > 0 && <p className="text-sm text-gray-500 mt-0.5">{parts.join(' + ')}</p>}
                    </div>
                    {renderContentSections({
                      keyPrefix: 'general',
                      targetId: 'general',
                      topic: r.topic,
                      contents: r.contents,
                      interactions: r.interactions,
                      surveys: r.surveys,
                      placeholder: '일반형 뉴스레터 주제를 입력하세요 (Enter로 AI 콘텐츠 추천)',
                      setTopic: t => setRoundTopic(activeRoundIdx, t),
                      suggestContents: t => suggestContentsForRound(activeRoundIdx, t),
                      removeContent: id => removeContentFromRound(activeRoundIdx, id),
                      toggleInteractionFn: v => toggleInteraction(activeRoundIdx, v),
                      toggleSurveyFn: v => toggleSurvey(activeRoundIdx, v),
                      openPool: () => openContentPool(false, null),
                    })}
                  </div>
                    );
                  })()}

                </div>
              );
            })()}
              </div>
            </div>
          </>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          5단계: 발송 주기
      ════════════════════════════════ */}
      {wizardStep === 5 && (
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
                  const poolGroup = contentPoolForCustom && contentPoolGroupId
                    ? currentRound?.customGroups.find(g => g.id === contentPoolGroupId)
                    : undefined;
                  const alreadyAdded = poolGroup
                    ? poolGroup.contents.some(c => c.id === item.id)
                    : (currentRound?.contents.some(c => c.id === item.id) ?? false);
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
                        onClick={() => !alreadyAdded && (poolGroup ? addCustomContentToGroup(item, poolGroup.id) : addContentToRound(item))}
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
                          {selectedParticipants.map(p => (
                            <span key={p.id} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {p.name} {p.position}
                            </span>
                          ))}
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
                                        {r.customGroups.filter(g => g.types.length > 0).length > 0 ? (
                                          <span className="text-[11px] text-amber-600 font-semibold">
                                            {r.customGroups.filter(g => g.types.length > 0).map((g, gi) => `그룹${gi + 1} ${g.leaderIds.length}명`).join(' + ')} + 일반 {r.generalLeaderIds.length}명
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
                        onClick={() => selectPreviewTab(idx)}
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
                    const contentTab = previewContentTab[previewTab] ?? 'full';
                    const firstThumbnail = activeRound.contents[0]?.thumbnail ?? '';
                    const schedDate = schedDates[previewTab];

                    // 데이터가 없을 때만 작은 스피너 (메시지 없음). 데이터가 있으면 갱신 중에도 기존 데이터 유지
                    if (!generated) {
                      return (
                        <div className="flex items-center justify-center py-16">
                          <svg className="w-6 h-6 text-[#55A4DA] animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        </div>
                      );
                    }

                    const isEdited = editedRoundsRef.current.has(previewTab);
                    return (
                      <div className="space-y-3">
                        {/* 서브탭 + 편집/다시생성 */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            {(['full', 'email'] as const).map(tab => (
                              <button
                                key={tab}
                                onClick={() => setPreviewContentTab(prev => ({ ...prev, [previewTab]: tab }))}
                                disabled={editMode}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
                                  contentTab === tab
                                    ? 'bg-[#55A4DA] text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {tab === 'full' ? '전체 본문' : '이메일 미리보기'}
                              </button>
                            ))}
                            {isEdited && !editMode && (
                              <span className="self-center ml-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">편집됨</span>
                            )}
                          </div>
                          {!editMode && (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={startEdit}
                                className="flex items-center gap-1 text-xs font-semibold text-[#55A4DA] hover:text-[#3A8BC4] transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                본문 편집
                              </button>
                              <button
                                onClick={regenerateCurrent}
                                disabled={isGenerating}
                                title="AI로 다시 생성 (편집 내용 덮어쓰기)"
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-60"
                              >
                                <svg className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {isGenerating ? '갱신 중' : 'AI로 다시 생성'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 편집 모드: 편집 패널 / 보기 모드: 미리보기 */}
                        {editMode ? renderEditPanel() : (
                          <>
                            {contentTab === 'email' && renderNewsletterEmailPreview(generated, {
                              vol: previewTab + 1,
                              dateLabel: schedDate ? formatKoreanDate(schedDate) : '',
                              firstThumbnail,
                              onReadFull: () => setPreviewContentTab(prev => ({ ...prev, [previewTab]: 'full' })),
                            })}
                            {contentTab === 'full' && renderGeneratedFullBody(generated, {
                              vol: previewTab + 1,
                              dateLabel: schedDate ? formatKoreanDate(schedDate) : '—',
                              leadershipLabel: leadershipTypes.join(', '),
                              firstThumbnail,
                              templateInteractions: activeRound.interactions,
                              templateSurveys: activeRound.surveys,
                            })}
                          </>
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
      {configDraft.companyIds.length > 0 && <div className="bg-white border-t border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={goPrev}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {wizardStep === 1 ? '기업 선택' : '이전'}
        </button>

        {wizardStep < 5 && (
          <div className="relative group">
            {wizardStep === 1 && configDraft.companyIds.length === 0 && (
              <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                기업을 먼저 선택해주세요
              </div>
            )}
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
          </div>
        )}
        {wizardStep === 5 && (
          <button
            onClick={handleComplete}
            disabled={!deliveryInterval || !startDate}
            className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-1.5 rounded-lg transition-colors ${
              deliveryInterval && startDate
                ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            생성
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>}

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
