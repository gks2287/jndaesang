import { create } from 'zustand';
import type { SavedNewsletterContent } from '@/components/newsletter/NewsletterRender';

export type NewsletterStatus = '제작 중' | '제작완료';

export interface Newsletter {
  id: number;
  title: string;
  companyId: number;
  companyName: string;
  leadershipType: string;
  status: NewsletterStatus;
  stepCount: number;
  positiveLeaders: { types: string[]; count: number };
  negativeLeaders: { types: string[]; count: number };
  totalRounds: number;
  completedRounds: number;
  type: 'general' | 'custom';
  leaderType: 'positive' | 'negative';
  totalLeaders: number;
  createdAt: string;
  updatedAt: string;
  // 제작완료 시 저장되는 회차별 생성 본문 (전체본문 + 요약본 미리보기용)
  generatedContent?: SavedNewsletterContent;
}

const MOCK: Newsletter[] = [
  {
    id: 1, title: '2026 상반기 독재형 리더십 코칭', companyId: 1, companyName: 'LG화학',
    leadershipType: '독재형', status: '제작 중', stepCount: 3,
    positiveLeaders: { types: ['코칭형', '민주형'], count: 8 },
    negativeLeaders: { types: ['독재형', '성과압박형'], count: 5 },
    totalRounds: 6, completedRounds: 3,
    type: 'general', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-04-15', updatedAt: '2026-05-16',
  },
  {
    id: 2, title: '2026 상반기 성과압박형 리더십 코칭', companyId: 1, companyName: 'LG화학',
    leadershipType: '성과압박형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['비전형'], count: 10 },
    negativeLeaders: { types: ['성과압박형'], count: 3 },
    totalRounds: 6, completedRounds: 6,
    type: 'custom', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-03-20', updatedAt: '2026-04-28',
  },
  {
    id: 3, title: '2026 불통형 리더십 개선 프로그램', companyId: 2, companyName: '현대모비스',
    leadershipType: '불통형', status: '제작 중', stepCount: 2,
    positiveLeaders: { types: ['지원형'], count: 6 },
    negativeLeaders: { types: ['불통형', '방관형'], count: 7 },
    totalRounds: 6, completedRounds: 2,
    type: 'general', leaderType: 'negative', totalLeaders: 13,
    createdAt: '2026-05-01', updatedAt: '2026-05-14',
  },
  {
    id: 4, title: '2026 방관형 리더십 코칭', companyId: 3, companyName: 'SK하이닉스',
    leadershipType: '방관형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['코칭형', '혁신형'], count: 9 },
    negativeLeaders: { types: ['방관형'], count: 4 },
    totalRounds: 6, completedRounds: 6,
    type: 'custom', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-02-10', updatedAt: '2026-03-25',
  },
  {
    id: 5, title: '2026 감정기복형 리더십 코칭', companyId: 6, companyName: 'KT&G',
    leadershipType: '감정기복형', status: '제작 중', stepCount: 4,
    positiveLeaders: { types: ['민주형'], count: 5 },
    negativeLeaders: { types: ['감정기복형', '독재형'], count: 8 },
    totalRounds: 6, completedRounds: 4,
    type: 'general', leaderType: 'negative', totalLeaders: 13,
    createdAt: '2026-04-20', updatedAt: '2026-05-12',
  },
  {
    id: 6, title: '2025 하반기 불명확형 리더십 코칭', companyId: 4, companyName: '포스코',
    leadershipType: '불명확형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['비전형', '지원형'], count: 11 },
    negativeLeaders: { types: ['불명확형'], count: 2 },
    totalRounds: 6, completedRounds: 6,
    type: 'custom', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2025-08-05', updatedAt: '2025-09-20',
  },
  {
    id: 7, title: '2026 독재형 리더십 코칭', companyId: 2, companyName: '현대모비스',
    leadershipType: '독재형', status: '제작완료', stepCount: 6,
    positiveLeaders: { types: ['코칭형'], count: 7 },
    negativeLeaders: { types: ['독재형', '불통형'], count: 6 },
    totalRounds: 6, completedRounds: 6,
    type: 'general', leaderType: 'positive', totalLeaders: 13,
    createdAt: '2026-03-01', updatedAt: '2026-04-15',
  },
];

interface NewsletterStore {
  newsletters: Newsletter[];
  addNewsletter: (data: Omit<Newsletter, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNewsletter: (id: number, data: Partial<Omit<Newsletter, 'id'>>) => void;
  removeNewsletter: (id: number) => void;
}

export const useNewsletterStore = create<NewsletterStore>((set, get) => ({
  newsletters: MOCK,
  addNewsletter: (data) => {
    const current = get().newsletters;
    const id = current.length > 0 ? Math.max(...current.map(n => n.id)) + 1 : 1;
    const now = new Date().toISOString().slice(0, 10);
    set({ newsletters: [{ ...data, id, createdAt: now, updatedAt: now }, ...current] });
  },
  updateNewsletter: (id, data) => {
    const now = new Date().toISOString().slice(0, 10);
    set({
      newsletters: get().newsletters.map(n =>
        n.id === id ? { ...n, ...data, updatedAt: now } : n
      ),
    });
  },
  removeNewsletter: (id) => {
    set({ newsletters: get().newsletters.filter(n => n.id !== id) });
  },
}));
