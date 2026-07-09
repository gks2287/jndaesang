import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_STORYLINE, type StorylineStep } from '@/lib/storyline';
import { makeStepContents, type StepContent, type Round, type GroupDescription } from '@/lib/content';
import type { SavedNewsletterContent } from '@/components/newsletter/NewsletterRender';

export type WizardStep = 1 | 2 | 3 | 4 | 5;
type DeliverySchedule = '주 1회' | '격주' | '월 1회';

export interface TopicSuggestion {
  title: string;
  description: string;
  reason?: string;
}

interface NewNewsletterDraft {
  companyIds: number[];

  // configure 페이지
  wizardStep: WizardStep;
  customStoryline: StorylineStep[];
  suggestions: TopicSuggestion[];
  selectedTopic: TopicSuggestion | null;
  isCustom: boolean;
  customTopic: string;
  stepContents: StepContent[];
  totalRounds: number;
  roundDistribution: { stepIndex: number; count: number }[];
  rounds: Round[];
  // 그룹 설명(유형 구성 키 → 설명). 유형 구성이 같으면 회차 무관하게 공유.
  groupDescriptions: Record<string, GroupDescription>;
  deliverySchedule: DeliverySchedule;

  // 이어서/수정 진입용 — 편집 대상 뉴스레터 id(수정 모드)와 미리 불러온 본문
  editingNewsletterId: number | null;
  seededGeneratedContent: SavedNewsletterContent | null;
  // 이어서 진입 시작 회차 인덱스 · 발송일 복원값
  seededActiveRoundIdx: number;
  seededStartDate: string | null;
  seededDeliveryInterval: string | null;
  seededScheduleDateOverrides: Record<number, string> | null;
  // 이어서/수정 진입 시 5단계에서 자동 선택할 그룹/일반형 탭 id ('general' 또는 customGroup.id)
  seededPreviewTargetId: string | null;
}

const DEFAULT_DRAFT: NewNewsletterDraft = {
  companyIds: [],
  wizardStep: 1,
  customStoryline: DEFAULT_STORYLINE,
  suggestions: [],
  selectedTopic: null,
  isCustom: false,
  customTopic: '',
  stepContents: makeStepContents(DEFAULT_STORYLINE.length),
  totalRounds: DEFAULT_STORYLINE.length,
  roundDistribution: [],
  rounds: [],
  groupDescriptions: {},
  deliverySchedule: '주 1회',
  editingNewsletterId: null,
  seededGeneratedContent: null,
  seededActiveRoundIdx: 0,
  seededStartDate: null,
  seededDeliveryInterval: null,
  seededScheduleDateOverrides: null,
  seededPreviewTargetId: null,
};

interface NewNewsletterDraftStore extends NewNewsletterDraft {
  setDraft: (patch: Partial<NewNewsletterDraft>) => void;
  resetDraft: () => void;
}

export const useNewNewsletterDraftStore = create<NewNewsletterDraftStore>()(
  persist(
    (set) => ({
      ...DEFAULT_DRAFT,
      setDraft: (patch) => set(patch),
      resetDraft: () => set(DEFAULT_DRAFT),
    }),
    {
      name: 'newsletter_draft_session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
