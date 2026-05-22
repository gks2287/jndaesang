'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import { DEFAULT_STORYLINE, STEP_COLORS, type StorylineStep } from '@/lib/storyline';
import { LEADERSHIP_COLOR } from '@/lib/constants/leadershipColors';
import {
  CONTENT_TYPE_ICON,
  CONTENT_TYPE_COLOR,
  calcReadingTime,
  readingTimeStatus,
  makeIssue,
  makeStepContents,
  type ContentItem,
  type ContentType,
  type StepContent,
} from '@/lib/content';
import { useNewNewsletterDraftStore, type TopicSuggestion as DraftTopicSuggestion } from '@/store/newNewsletterDraftStore';

type ContentFormat = '글' | '영상' | '인포그래픽' | '카드뉴스';
type InteractionType = '퀴즈' | '시뮬레이션' | '성찰질문' | '체크리스트';
type StepLevel = '초급' | '중급' | '고급';
type DeliverySchedule = '주 1회' | '격주' | '월 1회';
type SurveyType = '상시 조사' | '정기 조사' | '안보냄' | '둘다 보냄';
type WizardStep = 1 | 2 | 3 | 4 | 5;

interface Step {
  id: string;
  title: string;
  level: StepLevel;
  formats: ContentFormat[];
  interactions: InteractionType[];
  contentPoolLink: string;
  specificContent: string;
}

type TopicSuggestion = DraftTopicSuggestion;

const DELIVERY_SCHEDULES: DeliverySchedule[] = ['주 1회', '격주', '월 1회'];
const SURVEY_TYPES: SurveyType[] = ['상시 조사', '정기 조사', '안보냄', '둘다 보냄'];

const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: '스토리라인' },
  { n: 2, label: '주제 선정' },
  { n: 3, label: '콘텐츠 구성' },
  { n: 4, label: '발송 주기' },
  { n: 5, label: '만족도 조사' },
];


function makeStep(n: number): Step {
  return {
    id: `step-${Date.now()}-${n}`,
    title: '',
    level: '초급',
    formats: [],
    interactions: [],
    contentPoolLink: '',
    specificContent: '',
  };
}

// ── Step 3 sortable card ──
function SortableContentCard({
  item,
  onRemove,
}: {
  item: ContentItem;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 group"
    >
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      {/* 타입 뱃지 */}
      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${CONTENT_TYPE_COLOR[item.type]}`}>
        {CONTENT_TYPE_ICON[item.type]} {item.type}
      </span>

      {/* 제목 */}
      <span className="flex-1 min-w-0 text-xs font-medium text-gray-700 truncate">{item.title}</span>

      {/* 읽기 시간 */}
      <span className="flex-shrink-0 text-[11px] text-gray-400 whitespace-nowrap">{item.readingTime}분</span>

      {/* 삭제 */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
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

  // 위저드 상태 (draft store에서 초기화)
  const [wizardStep, setWizardStep] = useState<WizardStep>(configDraft.wizardStep);

  // 2단계: 주제 선정
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>(configDraft.suggestions);
  const [selectedTopic, setSelectedTopic] = useState<TopicSuggestion | null>(configDraft.selectedTopic);
  const [isCustom, setIsCustom] = useState(configDraft.isCustom);
  const [customTopic, setCustomTopic] = useState(configDraft.customTopic);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // 3단계: 콘텐츠 구성
  const [stepContents, setStepContents] = useState<StepContent[]>(
    configDraft.stepContents.length > 0
      ? configDraft.stepContents
      : makeStepContents(configDraft.customStoryline.length)
  );
  const [openStepIdx, setOpenStepIdx] = useState<number | null>(0);
  const [activeIssueByStep, setActiveIssueByStep] = useState<Record<number, number>>({});
  const [poolModal, setPoolModal] = useState<{ stepIdx: number; issueIdx: number } | null>(null);
  const [poolItems, setPoolItems] = useState<ContentItem[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolQuery, setPoolQuery] = useState('');
  const [poolTypeFilter, setPoolTypeFilter] = useState<ContentType | ''>('');

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchPool = useCallback(async (q: string, type: ContentType | '') => {
    setPoolLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (type) params.set('type', type);
      const res = await fetch(`/api/content-pool?${params.toString()}`);
      const data = await res.json() as { items: ContentItem[] };
      setPoolItems(data.items);
    } finally {
      setPoolLoading(false);
    }
  }, []);

  function openPoolModal(stepIdx: number, issueIdx: number) {
    setPoolModal({ stepIdx, issueIdx });
    setPoolQuery('');
    setPoolTypeFilter('');
    void fetchPool('', '');
  }

  function addContentFromPool(item: ContentItem) {
    if (!poolModal) return;
    const { stepIdx, issueIdx } = poolModal;
    setStepContents(prev =>
      prev.map((sc, si) =>
        si !== stepIdx ? sc : {
          ...sc,
          issues: sc.issues.map((iss, ii) =>
            ii !== issueIdx ? iss : {
              ...iss,
              contentItems: iss.contentItems.some(c => c.id === item.id)
                ? iss.contentItems
                : [...iss.contentItems, item],
            }
          ),
        }
      )
    );
  }

  function removeContentItem(stepIdx: number, issueIdx: number, itemId: string) {
    setStepContents(prev =>
      prev.map((sc, si) =>
        si !== stepIdx ? sc : {
          ...sc,
          issues: sc.issues.map((iss, ii) =>
            ii !== issueIdx ? iss : {
              ...iss,
              contentItems: iss.contentItems.filter(c => c.id !== itemId),
            }
          ),
        }
      )
    );
  }

  function handleDragEnd(event: DragEndEvent, stepIdx: number, issueIdx: number) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStepContents(prev =>
      prev.map((sc, si) =>
        si !== stepIdx ? sc : {
          ...sc,
          issues: sc.issues.map((iss, ii) => {
            if (ii !== issueIdx) return iss;
            const oldIdx = iss.contentItems.findIndex(c => c.id === active.id);
            const newIdx = iss.contentItems.findIndex(c => c.id === over.id);
            return { ...iss, contentItems: arrayMove(iss.contentItems, oldIdx, newIdx) };
          }),
        }
      )
    );
  }

  function addIssue(stepIdx: number) {
    setStepContents(prev =>
      prev.map((sc, si) =>
        si !== stepIdx ? sc : {
          ...sc,
          issues: [...sc.issues, makeIssue(sc.issues.length)],
        }
      )
    );
    setActiveIssueByStep(prev => ({ ...prev, [stepIdx]: stepContents[stepIdx].issues.length }));
  }

  function removeIssue(stepIdx: number, issueIdx: number) {
    setStepContents(prev =>
      prev.map((sc, si) => {
        if (si !== stepIdx) return sc;
        const updated = sc.issues.filter((_, ii) => ii !== issueIdx);
        return { ...sc, issues: updated };
      })
    );
    setActiveIssueByStep(prev => {
      const cur = prev[stepIdx] ?? 0;
      return { ...prev, [stepIdx]: Math.max(0, cur >= issueIdx ? cur - 1 : cur) };
    });
  }

  // 2단계 (구 코드 호환)
  const [steps] = useState<Step[]>([makeStep(0)]);

  // 4단계: 발송 주기
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule>(configDraft.deliverySchedule);

  // 5단계: 만족도 조사 + 제목
  const [surveyType, setSurveyType] = useState<SurveyType>(configDraft.surveyType);
  const [newsletterTitle, setNewsletterTitle] = useState(configDraft.newsletterTitle);

  // 스토리라인 편집
  const [customStoryline, setCustomStoryline] = useState<StorylineStep[]>(configDraft.customStoryline);
  const [isEditingStoryline, setIsEditingStoryline] = useState(false);
  const [draftStoryline, setDraftStoryline] = useState<StorylineStep[]>(DEFAULT_STORYLINE);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [aiRefineError, setAiRefineError] = useState<string | null>(null);

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

  // draft store 동기화
  useEffect(() => {
    configDraft.setDraft({ wizardStep, customStoryline, suggestions, selectedTopic, isCustom, customTopic, stepContents, deliverySchedule, surveyType, newsletterTitle });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, customStoryline, suggestions, selectedTopic, isCustom, customTopic, stepContents, deliverySchedule, surveyType, newsletterTitle]);

  async function fetchTopics() {
    setIsLoadingTopics(true);
    setTopicError(null);
    setSuggestions([]);
    setSelectedTopic(null);
    try {
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadershipTypes,
          companyName: targetCompanies[0]?.name ?? '',
          kind,
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

  function handleSave(status: '제작 중' | '제작완료') {
    const company = targetCompanies[0];
    const leadershipType =
      leadershipTypes.length > 0 ? leadershipTypes[0] : deptsParam ? '부서별' : '미지정';

    const topicTitle = isCustom ? customTopic.trim() : selectedTopic?.title ?? '';
    const autoTitle = `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim();

    addNewsletter({
      title: newsletterTitle.trim() || topicTitle || autoTitle,
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status,
      stepCount: steps.length,
    });

    configDraft.resetDraft();
    router.push(`/admin/newsletters?tab=${encodeURIComponent(status)}`);
  }

  function canGoNext(): boolean {
    if (wizardStep === 2) {
      if (isCustom) return customTopic.trim().length > 0;
      return selectedTopic !== null;
    }
    return true;
  }

  function goNext() {
    if (wizardStep < 5 && canGoNext()) setWizardStep(prev => (prev + 1) as WizardStep);
  }

  function goPrev() {
    if (wizardStep > 1) {
      setWizardStep(prev => (prev - 1) as WizardStep);
    } else {
      router.push('/admin/newsletters/new');
    }
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
                  <div className={`w-16 h-px mx-3 mb-4 transition-colors ${
                    isDone ? 'bg-[#55A4DA]' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2단계: 주제 선정 ── */}
      {wizardStep === 2 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-xl mx-auto px-6 py-10 space-y-6">

            {/* 현재 설정 요약 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">현재 설정</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">기업</span>
                  <div className="flex gap-1">
                    {targetCompanies.length > 0
                      ? targetCompanies.map(c => (
                          <span key={c.id} className="text-xs font-semibold px-2.5 py-1 bg-[#55A4DA]/10 text-[#55A4DA] rounded-full">
                            {c.name}
                          </span>
                        ))
                      : <span className="text-xs text-gray-400">—</span>}
                  </div>
                </div>
                {leadershipTypes.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">리더십 유형</span>
                      <div className="flex flex-wrap gap-1">
                        {leadershipTypes.map(t => (
                          <span key={t} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LEADERSHIP_COLOR[t] ?? 'bg-gray-100 text-gray-600'}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="w-px h-4 bg-gray-200" />
                <span className="text-xs text-gray-500">
                  {kind} · <span className="font-semibold text-gray-700">{leadersCount}명</span>
                </span>
              </div>
            </div>

            {/* AI 추천 섹션 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">AI 주제 추천</h3>
                  <p className="text-xs text-gray-400 mt-0.5">설정 기반으로 뉴스레터 주제 2개를 추천합니다.</p>
                </div>
                <button
                  onClick={fetchTopics}
                  disabled={isLoadingTopics}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isLoadingTopics
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'
                  }`}
                >
                  {isLoadingTopics ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      생성 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {suggestions.length > 0 ? '다시 추천받기' : 'AI 주제 추천받기'}
                    </>
                  )}
                </button>
              </div>

              {/* 로딩 */}
              {isLoadingTopics && (
                <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
                  <svg className="w-5 h-5 animate-spin text-[#55A4DA]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">AI가 주제를 생성하고 있습니다...</span>
                </div>
              )}

              {/* 에러 */}
              {topicError && !isLoadingTopics && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600 flex-1">{topicError}</p>
                  <button onClick={fetchTopics} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">
                    다시 시도
                  </button>
                </div>
              )}

              {/* 추천 카드 목록 */}
              {!isLoadingTopics && suggestions.length > 0 && (
                <div className="space-y-2.5">
                  {suggestions.map((topic, idx) => {
                    const isSelected = !isCustom && selectedTopic?.title === topic.title;
                    return (
                      <button
                        key={idx}
                        onClick={() => { setSelectedTopic(topic); setIsCustom(false); }}
                        className={`w-full text-left flex items-start gap-3.5 px-4 py-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold leading-snug ${isSelected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>
                            {topic.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{topic.description}</p>
                          {topic.reason && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">왜 이 주제인가요?</p>
                              <p className="text-xs text-gray-600 leading-relaxed">{topic.reason}</p>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 초기 안내 */}
              {!isLoadingTopics && suggestions.length === 0 && !topicError && (
                <div className="flex items-center justify-center py-8 text-center">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#55A4DA]/10 flex items-center justify-center mx-auto mb-2.5">
                      <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">버튼을 눌러 AI 주제 추천을 받아보세요.</p>
                  </div>
                </div>
              )}
            </div>

            {/* 직접 입력 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <button
                onClick={() => { setIsCustom(v => !v); setSelectedTopic(null); }}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isCustom ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                  }`}>
                    {isCustom && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">직접 입력</span>
                </div>
                <span className="text-xs text-gray-400">AI 추천 대신 직접 주제를 입력합니다</span>
              </button>
              {isCustom && (
                <input
                  type="text"
                  value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  placeholder="뉴스레터 주제를 직접 입력하세요"
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              )}
            </div>

          </div>
        </div>
      )}

      {wizardStep === 1 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto px-6 py-10">

            {/* 헤더 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-gray-800 mb-1">뉴스레터 스토리라인</h2>
              <p className="text-xs text-gray-400">5단계 코칭 여정으로 리더의 변화를 이끕니다. 구조를 확인한 뒤 다음으로 진행하세요.</p>
            </div>

            {/* 가로 플로우 (데스크탑) / 세로 (모바일) */}
            <div className="flex flex-col lg:flex-row items-stretch gap-0 lg:gap-0 mb-8">
              {customStoryline.map((s, i) => {
                const color = STEP_COLORS[i];
                return (
                  <div key={s.step} className="flex flex-col lg:flex-row items-stretch flex-1 min-w-0">
                    {/* 카드 */}
                    <div className={`flex-1 rounded-2xl border-2 ${color.border} ${color.cardBg} p-5 flex flex-col gap-3`}>
                      {/* 뱃지 + 제목 */}
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{s.step}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-bold leading-tight ${color.titleColor}`}>{s.title}</p>
                          <p className={`text-[11px] font-semibold ${color.subtitleColor}`}>{s.subtitle}</p>
                        </div>
                      </div>
                      {/* 설명 */}
                      <p className="text-xs text-gray-600 leading-relaxed flex-1">{s.description}</p>
                    </div>

                    {/* 화살표 — 데스크탑: 가로, 모바일: 세로 */}
                    {i < DEFAULT_STORYLINE.length - 1 && (
                      <div className="flex items-center justify-center lg:px-2 py-2 lg:py-0 flex-shrink-0">
                        {/* 모바일: 아래 화살표 */}
                        <svg className="w-4 h-4 text-gray-300 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {/* 데스크탑: 오른쪽 화살표 */}
                        <svg className="w-4 h-4 text-gray-300 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 안내 + 버튼들 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 bg-[#55A4DA]/5 border border-[#55A4DA]/20 rounded-xl px-4 py-3 flex-1">
                <svg className="w-4 h-4 text-[#55A4DA] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-[#2E7DB5]">이 스토리라인은 {targetCompanies[0]?.name ?? '해당 고객사'}의 모든 뉴스레터에 공통으로 적용됩니다. 다음 단계에서 각 회차별 콘텐츠를 구성합니다.</p>
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
      {/* ── 3단계: 콘텐츠 구성 ── */}
      {wizardStep === 3 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-3">

            <div className="mb-6">
              <h2 className="text-base font-bold text-gray-800 mb-1">콘텐츠 구성</h2>
              <p className="text-xs text-gray-400">각 단계별 회차에 콘텐츠를 추가하세요. 회차당 권장 읽기 시간은 4~5분입니다.</p>
            </div>

            {stepContents.map((sc, stepIdx) => {
              const storylineStep = customStoryline[stepIdx];
              if (!storylineStep) return null;
              const color = STEP_COLORS[stepIdx % STEP_COLORS.length];
              const isOpen = openStepIdx === stepIdx;
              const activeIssueIdx = activeIssueByStep[stepIdx] ?? 0;
              const activeIssue = sc.issues[activeIssueIdx] ?? sc.issues[0];

              const totalMinutes = sc.issues.reduce(
                (sum, iss) => sum + calcReadingTime(iss.contentItems), 0,
              );
              const timeStatus = readingTimeStatus(
                sc.issues.length > 0 ? Math.round(totalMinutes / sc.issues.length) : 0,
              );

              return (
                <div key={stepIdx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* 아코디언 헤더 */}
                  <button
                    onClick={() => setOpenStepIdx(isOpen ? null : stepIdx)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-bold">{storylineStep.step}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className={`text-sm font-bold ${color.titleColor} truncate`}>{storylineStep.title}</p>
                      {storylineStep.subtitle && (
                        <p className="text-[11px] text-gray-400 truncate">{storylineStep.subtitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[11px] font-semibold ${timeStatus.color}`}>{timeStatus.label}</span>
                      <span className="text-xs text-gray-400">{sc.issues.length}회차</span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* 아코디언 바디 */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                      {/* 회차 탭 */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {sc.issues.map((iss, issIdx) => {
                          const issMinutes = calcReadingTime(iss.contentItems);
                          const isActiveTab = issIdx === activeIssueIdx;
                          return (
                            <div key={iss.id} className="relative group">
                              <button
                                onClick={() => setActiveIssueByStep(prev => ({ ...prev, [stepIdx]: issIdx }))}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  isActiveTab
                                    ? 'bg-[#55A4DA]/10 text-[#55A4DA] border border-[#55A4DA]/30'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-transparent'
                                }`}
                              >
                                {iss.label}
                                {issMinutes > 0 && (
                                  <span className={`text-[10px] ${isActiveTab ? 'text-[#55A4DA]/70' : 'text-gray-400'}`}>
                                    {issMinutes}분
                                  </span>
                                )}
                              </button>
                              {sc.issues.length > 1 && (
                                <button
                                  onClick={() => removeIssue(stepIdx, issIdx)}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-400 hover:bg-red-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => addIssue(stepIdx)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 border border-dashed border-gray-300 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors"
                        >
                          + 회차 추가
                        </button>
                      </div>

                      {/* 콘텐츠 카드 목록 (드래그 정렬) */}
                      {activeIssue && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-500">
                              {activeIssue.label} 콘텐츠
                              {activeIssue.contentItems.length > 0 && (
                                <span className="ml-1.5 text-gray-400">
                                  ({calcReadingTime(activeIssue.contentItems)}분)
                                </span>
                              )}
                            </p>
                            <button
                              onClick={() => openPoolModal(stepIdx, activeIssueIdx)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-[11px] font-bold transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                              콘텐츠 추가
                            </button>
                          </div>

                          {activeIssue.contentItems.length === 0 ? (
                            <button
                              onClick={() => openPoolModal(stepIdx, activeIssueIdx)}
                              className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex flex-col items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                              </svg>
                              콘텐츠를 추가하세요
                            </button>
                          ) : (
                            <DndContext
                              sensors={dndSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(e) => handleDragEnd(e, stepIdx, activeIssueIdx)}
                            >
                              <SortableContext
                                items={activeIssue.contentItems.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-1.5">
                                  {activeIssue.contentItems.map(item => (
                                    <SortableContentCard
                                      key={item.id}
                                      item={item}
                                      onRemove={() => removeContentItem(stepIdx, activeIssueIdx, item.id)}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {wizardStep === 4 && (
        <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] overflow-y-auto py-12">
          <div className="w-full max-w-md px-6">
            <h2 className="text-base font-bold text-gray-800 mb-1.5">발송 주기 선택</h2>
            <p className="text-xs text-gray-400 mb-8">뉴스레터를 얼마나 자주 발송할지 선택하세요.</p>
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
          </div>
        </div>
      )}

      {wizardStep === 5 && (
        <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] overflow-y-auto py-12">
          <div className="w-full max-w-md px-6 space-y-8">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1.5">뉴스레터 제목</h2>
              <p className="text-xs text-gray-400 mb-4">저장 시 사용할 뉴스레터 제목을 입력하세요.</p>
              <input
                type="text"
                value={newsletterTitle}
                onChange={e => setNewsletterTitle(e.target.value)}
                placeholder={
                  isCustom && customTopic
                    ? customTopic
                    : selectedTopic?.title
                    ?? `${targetCompanies[0]?.name ?? '고객사'} ${leadershipTypes[0] ?? ''} 리더십 코칭`.trim()
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1.5">만족도 조사 설정</h2>
              <p className="text-xs text-gray-400 mb-4">만족도 조사를 어떻게 발송할지 선택하세요.</p>
              <div className="space-y-3">
                {SURVEY_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSurveyType(t)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                      surveyType === t
                        ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#55A4DA]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      surveyType === t ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                    }`}>
                      {surveyType === t && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    {t}
                  </button>
                ))}
              </div>
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

      {/* ── 스토리라인 편집 모달 ── */}
      {isEditingStoryline && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">

            {/* 모달 헤더 */}
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

            {/* 모달 바디 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* AI 보조 섹션 */}
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
                {aiRefineError && (
                  <p className="text-[11px] text-red-500">{aiRefineError}</p>
                )}
              </div>

              {/* 단계 목록 */}
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
                          title="단계 삭제"
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

              {/* 단계 추가 버튼 */}
              <button
                onClick={addDraftStep}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors font-medium"
              >
                + 단계 추가
              </button>
            </div>

            {/* 모달 푸터 */}
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

      {/* ── 콘텐츠 풀 모달 ── */}
      {poolModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">콘텐츠 추가</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {customStoryline[poolModal.stepIdx]?.title} ·{' '}
                  {stepContents[poolModal.stepIdx]?.issues[poolModal.issueIdx]?.label}
                </p>
              </div>
              <button onClick={() => setPoolModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 검색 + 타입 필터 */}
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-2.5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={poolQuery}
                  onChange={e => {
                    setPoolQuery(e.target.value);
                    void fetchPool(e.target.value, poolTypeFilter);
                  }}
                  placeholder="제목, 설명, 태그 검색..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['', '글', '영상', '인포그래픽', '카드뉴스'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setPoolTypeFilter(t);
                      void fetchPool(poolQuery, t);
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      poolTypeFilter === t
                        ? 'bg-[#55A4DA] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {t === '' ? '전체' : `${CONTENT_TYPE_ICON[t as ContentType]} ${t}`}
                  </button>
                ))}
              </div>
            </div>

            {/* 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {poolLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="w-4 h-4 animate-spin text-[#55A4DA]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">불러오는 중...</span>
                </div>
              ) : poolItems.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  검색 결과가 없습니다.
                </div>
              ) : (
                poolItems.map(item => {
                  const alreadyAdded = stepContents[poolModal.stepIdx]?.issues[poolModal.issueIdx]?.contentItems.some(c => c.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => !alreadyAdded && addContentFromPool(item)}
                      disabled={alreadyAdded}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                        alreadyAdded
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-[#55A4DA] hover:bg-[#55A4DA]/5'
                      }`}
                    >
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border mt-0.5 ${CONTENT_TYPE_COLOR[item.type]}`}>
                        {CONTENT_TYPE_ICON[item.type]} {item.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-gray-400">{item.readingTime}분</span>
                          {item.tags.map(tag => (
                            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                onClick={() => setPoolModal(null)}
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

        {wizardStep < 5 && (
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
