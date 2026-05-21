import { create } from 'zustand';

export type NewsletterStatus = '제작 중' | '제작완료';

export interface Newsletter {
  id: number;
  title: string;
  companyId: number;
  companyName: string;
  leadershipType: string;
  status: NewsletterStatus;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

const MOCK: Newsletter[] = [
  { id: 1, title: '2026 상반기 독재형 리더십 코칭', companyId: 1, companyName: 'LG화학', leadershipType: '독재형', status: '제작 중', stepCount: 3, createdAt: '2026-04-15', updatedAt: '2026-05-16' },
  { id: 2, title: '2026 상반기 성과압박형 리더십 코칭', companyId: 1, companyName: 'LG화학', leadershipType: '성과압박형', status: '제작완료', stepCount: 6, createdAt: '2026-03-20', updatedAt: '2026-04-28' },
  { id: 3, title: '2026 불통형 리더십 개선 프로그램', companyId: 2, companyName: '현대모비스', leadershipType: '불통형', status: '제작 중', stepCount: 2, createdAt: '2026-05-01', updatedAt: '2026-05-14' },
  { id: 4, title: '2026 방관형 리더십 코칭', companyId: 3, companyName: 'SK하이닉스', leadershipType: '방관형', status: '제작완료', stepCount: 6, createdAt: '2026-02-10', updatedAt: '2026-03-25' },
  { id: 5, title: '2026 감정기복형 리더십 코칭', companyId: 6, companyName: 'KT&G', leadershipType: '감정기복형', status: '제작 중', stepCount: 4, createdAt: '2026-04-20', updatedAt: '2026-05-12' },
  { id: 6, title: '2025 하반기 불명확형 리더십 코칭', companyId: 4, companyName: '포스코', leadershipType: '불명확형', status: '제작완료', stepCount: 6, createdAt: '2025-08-05', updatedAt: '2025-09-20' },
  { id: 7, title: '2026 독재형 리더십 코칭', companyId: 2, companyName: '현대모비스', leadershipType: '독재형', status: '제작완료', stepCount: 6, createdAt: '2026-03-01', updatedAt: '2026-04-15' },
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
