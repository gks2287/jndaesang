import { create } from 'zustand';

export type CoachingStatus = '코칭 진행 중' | '코칭 완료' | '준비 중' | '미시작';

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
}

const COLORS = [
  'bg-[#55A4DA]', 'bg-[#4A90C4]', 'bg-[#5B9BD5]', 'bg-[#3A7BBF]',
  'bg-[#6AAED6]', 'bg-[#4B8FBF]', 'bg-[#7DB3D0]', 'bg-[#5CA0C8]',
];

const INITIAL: Company[] = [
  { id: 1, name: 'LG화학', initials: 'LG', industry: '화학/소재', participantCount: 24, status: '코칭 진행 중', hrName: '', hrEmail: '', startDate: '2026-03-01', endDate: '2026-08-31', note: '', color: 'bg-[#55A4DA]' },
  { id: 2, name: '현대모비스', initials: 'HM', industry: '자동차 부품', participantCount: 15, status: '코칭 진행 중', hrName: '', hrEmail: '', startDate: '2026-04-01', endDate: '2026-09-30', note: '', color: 'bg-[#4A90C4]' },
  { id: 3, name: 'SK하이닉스', initials: 'SK', industry: '반도체', participantCount: 32, status: '코칭 완료', hrName: '', hrEmail: '', startDate: '2026-02-01', endDate: '2026-07-31', note: '', color: 'bg-[#5B9BD5]' },
  { id: 4, name: '포스코', initials: 'PS', industry: '철강', participantCount: 20, status: '코칭 완료', hrName: '', hrEmail: '', startDate: '2025-09-01', endDate: '2026-02-28', note: '', color: 'bg-[#3A7BBF]' },
  { id: 5, name: '삼성SDI', initials: 'SD', industry: '배터리/전자', participantCount: 12, status: '준비 중', hrName: '', hrEmail: '', startDate: '2026-06-01', endDate: '2026-11-30', note: '', color: 'bg-[#6AAED6]' },
  { id: 6, name: 'KT&G', initials: 'KT', industry: '소비재', participantCount: 18, status: '코칭 진행 중', hrName: '', hrEmail: '', startDate: '2026-03-15', endDate: '2026-09-15', note: '', color: 'bg-[#4B8FBF]' },
  { id: 7, name: '롯데케미칼', initials: 'LC', industry: '화학', participantCount: 9, status: '미시작', hrName: '', hrEmail: '', startDate: '', endDate: '', note: '', color: 'bg-[#7DB3D0]' },
  { id: 8, name: '두산에너빌리티', initials: 'DE', industry: '에너지', participantCount: 11, status: '준비 중', hrName: '', hrEmail: '', startDate: '2026-07-01', endDate: '2026-12-31', note: '', color: 'bg-[#5CA0C8]' },
];

interface CompanyStore {
  companies: Company[];
  addCompany: (data: Omit<Company, 'id' | 'initials' | 'color'>) => void;
  updateCompany: (id: number, data: Partial<Omit<Company, 'id' | 'initials' | 'color'>>) => void;
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: INITIAL,
  updateCompany: (id, data) => {
    set({
      companies: get().companies.map(c =>
        c.id === id ? { ...c, ...data, initials: data.name ? getInitials(data.name) : c.initials } : c
      ),
    });
  },
  addCompany: (data) => {
    const companies = get().companies;
    const id = companies.length > 0 ? Math.max(...companies.map(c => c.id)) + 1 : 1;
    const color = COLORS[id % COLORS.length];
    const newCompany: Company = {
      ...data,
      id,
      initials: getInitials(data.name),
      color,
    };
    set({ companies: [...companies, newCompany] });
  },
}));
