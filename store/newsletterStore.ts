import { create } from 'zustand';
import type { SavedNewsletterContent } from '@/components/newsletter/NewsletterRender';
import type { Round } from '@/lib/content';
import type { StorylineStep } from '@/lib/storyline';

export type NewsletterStatus = '제작 중' | '제작완료';

// 제작 위저드 스냅샷 — 이어서/수정 시 위저드를 그대로 복원하기 위한 저작(authoring) 정보
export interface NewsletterAuthoring {
  storyline: StorylineStep[];
  totalRounds: number;
  roundDistribution: { stepIndex: number; count: number }[];
  rounds: Round[];
}

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
  savedRounds?: number[];
  // 제작완료 시 저장되는 회차별 생성 본문 (전체본문 + 요약본 미리보기용)
  generatedContent?: SavedNewsletterContent;
  // 제작 위저드 스냅샷 — 이어서/수정 복원용 (구버전 레코드는 없을 수 있음)
  authoring?: NewsletterAuthoring | null;
}

type NewsletterInput = Omit<Newsletter, 'id' | 'createdAt' | 'updatedAt'>;

interface NewsletterStore {
  newsletters: Newsletter[];
  loaded: boolean;
  loading: boolean;
  loadNewsletters: (force?: boolean) => Promise<void>;
  addNewsletter: (data: NewsletterInput) => Promise<Newsletter | null>;
  updateNewsletter: (id: number, data: Partial<Omit<Newsletter, 'id'>>) => Promise<void>;
  removeNewsletter: (id: number) => Promise<void>;
  toggleRoundSaved: (id: number, roundNum: number) => Promise<void>;
}

export const useNewsletterStore = create<NewsletterStore>((set, get) => ({
  newsletters: [],
  loaded: false,
  loading: false,

  loadNewsletters: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/admin/newsletters');
      if (!res.ok) throw new Error('목록 로드 실패');
      const newsletters = (await res.json()) as Newsletter[];
      set({ newsletters, loaded: true });
    } catch (e) {
      console.error('뉴스레터 목록 로드 오류:', e);
    } finally {
      set({ loading: false });
    }
  },

  // 생성 → DB 저장 후 목록 앞에 추가, 생성된 행 반환(실패 시 null)
  addNewsletter: async (data) => {
    try {
      const res = await fetch('/api/admin/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('생성 실패');
      const created = (await res.json()) as Newsletter;
      set({ newsletters: [created, ...get().newsletters] });
      return created;
    } catch (e) {
      console.error('뉴스레터 생성 오류:', e);
      return null;
    }
  },

  updateNewsletter: async (id, data) => {
    try {
      const res = await fetch(`/api/admin/newsletters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('수정 실패');
      const updated = (await res.json()) as Newsletter;
      set({ newsletters: get().newsletters.map(n => (n.id === id ? updated : n)) });
    } catch (e) {
      console.error('뉴스레터 수정 오류:', e);
    }
  },

  removeNewsletter: async (id) => {
    try {
      const res = await fetch(`/api/admin/newsletters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      set({ newsletters: get().newsletters.filter(n => n.id !== id) });
    } catch (e) {
      console.error('뉴스레터 삭제 오류:', e);
    }
  },

  // 저장 회차 토글 → 새 savedRounds 계산 후 PATCH
  toggleRoundSaved: async (id, roundNum) => {
    const target = get().newsletters.find(n => n.id === id);
    if (!target) return;
    const saved = new Set(target.savedRounds ?? []);
    if (saved.has(roundNum)) saved.delete(roundNum); else saved.add(roundNum);
    const savedRounds = [...saved].sort((a, b) => a - b);
    // 낙관적 업데이트
    set({ newsletters: get().newsletters.map(n => (n.id === id ? { ...n, savedRounds } : n)) });
    try {
      const res = await fetch(`/api/admin/newsletters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedRounds }),
      });
      if (!res.ok) throw new Error('저장 회차 수정 실패');
    } catch (e) {
      console.error('저장 회차 토글 오류:', e);
    }
  },
}));
