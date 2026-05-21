import { create } from 'zustand';
import type { LeadershipType } from './participantStore';

export interface LeadershipInfo {
  type: LeadershipType;
  definition: string;
  characteristics: string;
}

export interface LeadershipInfoVersion {
  id: number;
  fileName: string;
  uploadedAt: string;
  info: LeadershipInfo[];
}

export const DEFAULT_INFO: LeadershipInfo[] = [
  {
    type: '독재형',
    definition: '일방적 지시와 통제 중심의 리더십',
    characteristics: '의사결정을 독점하고 구성원의 의견을 무시하는 경향. 단기 성과에 집착하며 팀원의 자율성을 억제함.',
  },
  {
    type: '방관형',
    definition: '적극적 개입 없이 방치하는 리더십',
    characteristics: '명확한 방향 제시 없이 팀을 방임함. 갈등 상황에서 회피하고 구성원 성장에 무관심한 경향.',
  },
  {
    type: '성과압박형',
    definition: '결과 중심의 과도한 압박 리더십',
    characteristics: '수치와 결과만을 강조하고 과정을 무시함. 팀원에게 비현실적인 목표를 부여하며 번아웃을 유발함.',
  },
  {
    type: '불통형',
    definition: '소통 단절과 정보 독점 리더십',
    characteristics: '정보를 공유하지 않고 일방적 커뮤니케이션만 사용함. 팀원의 의견에 귀를 기울이지 않는 경향.',
  },
  {
    type: '불명확형',
    definition: '방향과 기준이 모호한 리더십',
    characteristics: '목표와 역할 정의가 불분명하여 팀원이 혼란을 겪음. 결정이 자주 번복되고 기대치가 불일치함.',
  },
  {
    type: '감정기복형',
    definition: '감정 조절 미숙으로 인한 불안정 리더십',
    characteristics: '기분에 따라 지시와 평가가 달라짐. 팀원이 눈치를 보게 되고 심리적 안전감이 낮아짐.',
  },
];

// 고객사별 현재 정보 및 히스토리
const INITIAL_CURRENT: Record<number, LeadershipInfo[]> = {};
const INITIAL_HISTORY: Record<number, LeadershipInfoVersion[]> = {};

interface LeadershipInfoStore {
  current: Record<number, LeadershipInfo[]>;
  history: Record<number, LeadershipInfoVersion[]>;
  getCurrent: (companyId: number) => LeadershipInfo[];
  getHistory: (companyId: number) => LeadershipInfoVersion[];
  updateInfo: (companyId: number, info: LeadershipInfo[], fileName: string) => void;
}

export const useLeadershipInfoStore = create<LeadershipInfoStore>((set, get) => ({
  current: INITIAL_CURRENT,
  history: INITIAL_HISTORY,

  getCurrent: (companyId) =>
    get().current[companyId] ?? DEFAULT_INFO,

  getHistory: (companyId) =>
    get().history[companyId] ?? [],

  updateInfo: (companyId, info, fileName) => {
    const state = get();
    const prevInfo = state.current[companyId] ?? DEFAULT_INFO;
    const prevHistory = state.history[companyId] ?? [];

    const newVersion: LeadershipInfoVersion = {
      id: Date.now(),
      fileName,
      uploadedAt: new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      info: prevInfo,
    };

    set({
      current: { ...state.current, [companyId]: info },
      history: { ...state.history, [companyId]: [newVersion, ...prevHistory] },
    });
  },
}));
