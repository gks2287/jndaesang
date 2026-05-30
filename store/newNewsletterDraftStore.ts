import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_STORYLINE, type StorylineStep } from '@/lib/storyline';
import { makeStepContents, type StepContent, type Round } from '@/lib/content';

export type WizardStep = 1 | 2 | 3 | 4;
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
