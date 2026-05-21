import { create } from 'zustand';
import type { LeadershipType } from './participantStore';

export interface DiagnosisHistoryEntry {
  id: number;
  participantId: number;
  leadershipType: LeadershipType;
  changedAt: string;
  year: number;
}

interface DiagnosisHistoryStore {
  history: DiagnosisHistoryEntry[];
  getByParticipant: (participantId: number) => DiagnosisHistoryEntry[];
  record: (participantId: number, leadershipType: LeadershipType, year: number) => void;
}

export const useDiagnosisHistoryStore = create<DiagnosisHistoryStore>((set, get) => ({
  history: [],
  getByParticipant: (participantId) =>
    get().history.filter(h => h.participantId === participantId).sort((a, b) => b.id - a.id),
  record: (participantId, leadershipType, year) => {
    const entry: DiagnosisHistoryEntry = {
      id: Date.now(),
      participantId,
      leadershipType,
      year,
      changedAt: new Date().toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }),
    };
    set({ history: [entry, ...get().history] });
  },
}));
