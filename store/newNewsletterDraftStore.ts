import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_STORYLINE, type StorylineStep } from '@/lib/storyline';
import { makeStepContents, type StepContent, type Round } from '@/lib/content';
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
  deliverySchedule: DeliverySchedule;

  // 이어서/수정 진입용 — 편집 대상 뉴스레터 id(수정 모드)와 미리 불러온 본문
  editingNewsletterId: number | null;
  seededGeneratedContent: SavedNewsletterContent | null;
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
  deliverySchedule: '주 1회',
  editingNewsletterId: null,
  seededGeneratedContent: null,
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
