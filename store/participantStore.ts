import { create } from 'zustand';

export type LeadershipType =
  | '코칭형'
  | '민주형'
  | '서번트형'
  | '비전형'
  | '관계중심형'
  | '독재형'
  | '방관형'
  | '불통형'
  | '불명확형'
  | '성과압박형'
  | '감정기복형'
  | '완벽주의형'
  | '우유부단형';

export const POSITIVE_TYPES: LeadershipType[] = ['코칭형', '민주형', '서번트형', '비전형', '관계중심형'];
export const NEGATIVE_TYPES: LeadershipType[] = ['독재형', '방관형', '불통형', '성과압박형', '감정기복형', '완벽주의형', '우유부단형'];

export type DeliveryStatus = '발송완료' | '열람' | '미발송' | '완료';

export interface Participant {
  id: number;
  companyId: number;
  year: number;
  name: string;
  department: string;
  position: string;
  email: string;
  leadershipType: LeadershipType;
  assessmentRound: number;
  deliveryStatus: DeliveryStatus;
  lastOpenedAt: string | null;
  stepCurrent: number;
  stepTotal: number;
  token?: string;
}

export function participantToken(p: Participant): string {
  return p.token ?? `nl-${p.id}`;
}

type ParticipantInput = Omit<Participant, 'id'>;

interface ParticipantStore {
  participants: Participant[];
  loaded: boolean;
  loading: boolean;
  loadParticipants: (force?: boolean) => Promise<void>;
  getByCompany: (companyId: number) => Participant[];
  getYearsByCompany: (companyId: number) => number[];
  addParticipants: (items: ParticipantInput[]) => Promise<Participant[]>;
  updateParticipant: (id: number, data: Partial<ParticipantInput>) => Promise<void>;
  removeParticipant: (id: number) => Promise<void>;
}

export const useParticipantStore = create<ParticipantStore>((set, get) => ({
  participants: [],
  loaded: false,
  loading: false,

  // DB에서 전체 직책자 로드 (회사/연도별 필터는 아래 선택자가 담당)
  loadParticipants: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/admin/participants');
      if (!res.ok) throw new Error('목록 로드 실패');
      const participants = (await res.json()) as Participant[];
      set({ participants, loaded: true });
    } catch (e) {
      console.error('직책자 목록 로드 오류:', e);
    } finally {
      set({ loading: false });
    }
  },

  getByCompany: (companyId) =>
    get().participants.filter(p => p.companyId === companyId),

  getYearsByCompany: (companyId) => {
    const years = get()
      .participants.filter(p => p.companyId === companyId)
      .map(p => p.year);
    return [...new Set(years)].sort((a, b) => b - a);
  },

  // 일괄 생성 → DB 저장 후 목록에 추가, 생성된 행 반환
  addParticipants: async (items) => {
    if (items.length === 0) return [];
    try {
      const res = await fetch('/api/admin/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const created = (await res.json()) as Participant[];
      set({ participants: [...get().participants, ...created] });
      return created;
    } catch (e) {
      console.error('직책자 생성 오류:', e);
      return [];
    }
  },

  // 수정 → DB 반영 후 목록 갱신
  updateParticipant: async (id, data) => {
    try {
      const res = await fetch(`/api/admin/participants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('수정 실패');
      const updated = (await res.json()) as Participant;
      set({ participants: get().participants.map(p => (p.id === id ? updated : p)) });
    } catch (e) {
      console.error('직책자 수정 오류:', e);
    }
  },

  // 삭제 → DB 반영 후 목록에서 제거
  removeParticipant: async (id) => {
    try {
      const res = await fetch(`/api/admin/participants/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      set({ participants: get().participants.filter(p => p.id !== id) });
    } catch (e) {
      console.error('직책자 삭제 오류:', e);
    }
  },
}));
