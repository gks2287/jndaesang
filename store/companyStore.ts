import { create } from 'zustand';

export type CoachingStatus = '진행 중' | '진행 완료' | '진행 전';

export interface Company {
  id: number;
  name: string;
  initials: string;
  industry: string;
  participantCount: number;
  status: CoachingStatus;
  hrName: string;
  hrEmail: string;
  startDate: string;
  endDate: string;
  note: string;
  color: string;
  logoUrl?: string | null; // 업로드한 기업 로고(data URL). 없으면 이니셜 아바타
}

type CompanyInput = Omit<Company, 'id' | 'initials' | 'color'>;

interface CompanyStore {
  companies: Company[];
  loaded: boolean;
  loading: boolean;
  loadCompanies: (force?: boolean) => Promise<void>;
  addCompany: (data: CompanyInput) => Promise<Company | null>;
  updateCompany: (id: number, data: Partial<CompanyInput>) => Promise<void>;
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: [],
  loaded: false,
  loading: false,

  // DB에서 목록 로드 (이미 로드됐으면 force일 때만 재요청)
  loadCompanies: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/admin/companies');
      if (!res.ok) throw new Error('목록 로드 실패');
      const companies = (await res.json()) as Company[];
      set({ companies, loaded: true });
    } catch (e) {
      console.error('기업 목록 로드 오류:', e);
    } finally {
      set({ loading: false });
    }
  },

  // 생성 → DB 저장 후 목록 앞에 추가, 생성된 기업 반환(실패 시 null)
  addCompany: async (data) => {
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('생성 실패');
      const created = (await res.json()) as Company;
      set({ companies: [created, ...get().companies] });
      return created;
    } catch (e) {
      console.error('기업 생성 오류:', e);
      return null;
    }
  },

  // 수정 → DB 반영 후 목록 갱신
  updateCompany: async (id, data) => {
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('수정 실패');
      const updated = (await res.json()) as Company;
      set({ companies: get().companies.map(c => (c.id === id ? updated : c)) });
    } catch (e) {
      console.error('기업 수정 오류:', e);
    }
  },
}));
