import { create } from 'zustand';
import { DEFAULT_STORYLINE, type StorylineStep } from '@/lib/storyline';
import { makeStepContents, type StepContent } from '@/lib/content';

type NewsletterKind = '일반형' | '맞춤형';
type TargetCategory = 'leadership' | 'department' | 'ability';
type WizardStep = 1 | 2 | 3 | 4 | 5;
type DeliverySchedule = '주 1회' | '격주' | '월 1회';
type SurveyType = '상시 조사' | '정기 조사' | '안보냄' | '둘다 보냄';

export interface TopicSuggestion {
  title: string;
  description: string;
  reason: string;
}

interface NewNewsletterDraft {
  // new 페이지
  kind: NewsletterKind | null;
  companyIds: number[];
  targetCategory: TargetCategory | null;
  selectedTypes: string[];
  selectedDepts: string[];
  selectedAbilities: string[];
  selectedLeaders: number[];

  // configure 페이지
  wizardStep: WizardStep;
  customStoryline: StorylineStep[];
  suggestions: TopicSuggestion[];
  selectedTopic: TopicSuggestion | null;
  isCustom: boolean;
  customTopic: string;
  stepContents: StepContent[];
  deliverySchedule: DeliverySchedule;
  surveyType: SurveyType;
  newsletterTitle: string;
}

const DEFAULT_DRAFT: NewNewsletterDraft = {
  kind: null,
  companyIds: [],
  targetCategory: null,
  selectedTypes: [],
  selectedDepts: [],
  selectedAbilities: [],
  selectedLeaders: [],
  wizardStep: 1,
  customStoryline: DEFAULT_STORYLINE,
  suggestions: [],
  selectedTopic: null,
  isCustom: false,
  customTopic: '',
  stepContents: makeStepContents(DEFAULT_STORYLINE.length),
  deliverySchedule: '주 1회',
  surveyType: '상시 조사',
  newsletterTitle: '',
};

interface NewNewsletterDraftStore extends NewNewsletterDraft {
  setDraft: (patch: Partial<NewNewsletterDraft>) => void;
  resetDraft: () => void;
}

export const useNewNewsletterDraftStore = create<NewNewsletterDraftStore>((set) => ({
  ...DEFAULT_DRAFT,
  setDraft: (patch) => set(patch),
  resetDraft: () => set(DEFAULT_DRAFT),
}));
