import { create } from 'zustand';
import type { LeadershipType } from './participantStore';

export interface LeadershipInfo {
  type: LeadershipType;
  definition: string;
  characteristics: string;
  developmentPoints?: string; // 개발 포인트(코칭 방향) — 다면진단 보고서에서 추출
}

export interface LeadershipInfoVersion {
  id: number;
  fileName: string;
  uploadedAt: string;
  info: LeadershipInfo[];
}

export const DEFAULT_INFO: LeadershipInfo[] = [
  { type: '독재형', definition: '일방적 지시와 통제 중심의 리더십', characteristics: '의사결정을 독점하고 구성원의 의견을 무시하는 경향. 단기 성과에 집착하며 팀원의 자율성을 억제함.' },
  { type: '방관형', definition: '적극적 개입 없이 방치하는 리더십', characteristics: '명확한 방향 제시 없이 팀을 방임함. 갈등 상황에서 회피하고 구성원 성장에 무관심한 경향.' },
  { type: '성과압박형', definition: '결과 중심의 과도한 압박 리더십', characteristics: '수치와 결과만을 강조하고 과정을 무시함. 팀원에게 비현실적인 목표를 부여하며 번아웃을 유발함.' },
  { type: '불통형', definition: '소통 단절과 정보 독점 리더십', characteristics: '정보를 공유하지 않고 일방적 커뮤니케이션만 사용함. 팀원의 의견에 귀를 기울이지 않는 경향.' },
  { type: '불명확형', definition: '방향과 기준이 모호한 리더십', characteristics: '목표와 역할 정의가 불분명하여 팀원이 혼란을 겪음. 결정이 자주 번복되고 기대치가 불일치함.' },
  { type: '감정기복형', definition: '감정 조절 미숙으로 인한 불안정 리더십', characteristics: '기분에 따라 지시와 평가가 달라짐. 팀원이 눈치를 보게 되고 심리적 안전감이 낮아짐.' },
];

const INITIAL_CURRENT: Record<string, LeadershipInfo[]> = {};
const INITIAL_HISTORY: Record<string, LeadershipInfoVersion[]> = {};

function infoKey(companyId: number, year: number) {
  return `${companyId}-${year}`;
}

interface LeadershipInfoStore {
  current: Record<string, LeadershipInfo[]>;
  history: Record<string, LeadershipInfoVersion[]>;
  loadedKeys: Set<string>;
  loadForCompany: (companyId: number, year: number, force?: boolean) => Promise<void>;
  getCurrent: (companyId: number, year: number) => LeadershipInfo[];
  getHistory: (companyId: number, year: number) => LeadershipInfoVersion[];
  updateInfo: (companyId: number, year: number, info: LeadershipInfo[], fileName: string) => Promise<void>;
}

export const useLeadershipInfoStore = create<LeadershipInfoStore>((set, get) => ({
  current: INITIAL_CURRENT,
  history: INITIAL_HISTORY,
  loadedKeys: new Set(),

  // 기업+연도의 현재/히스토리를 DB에서 로드
  loadForCompany: async (companyId, year, force = false) => {
    const key = infoKey(companyId, year);
    if (get().loadedKeys.has(key) && !force) return;
    try {
      const res = await fetch(`/api/admin/leadership-info?companyId=${companyId}&year=${year}`);
      if (!res.ok) throw new Error('로드 실패');
      const data = (await res.json()) as { current: LeadershipInfo[]; history: LeadershipInfoVersion[] };
      set(state => ({
        current: { ...state.current, [key]: data.current },
        history: { ...state.history, [key]: data.history },
        loadedKeys: new Set(state.loadedKeys).add(key),
      }));
    } catch (e) {
      console.error('리더십 정보 로드 오류:', e);
      set(state => ({ loadedKeys: new Set(state.loadedKeys).add(key) }));
    }
  },

  getCurrent: (companyId, year) => get().current[infoKey(companyId, year)] ?? DEFAULT_INFO,
  getHistory: (companyId, year) => get().history[infoKey(companyId, year)] ?? [],

  // 저장 → DB에 새 버전 생성 후 current/history 갱신
  updateInfo: async (companyId, year, info, fileName) => {
    const key = infoKey(companyId, year);
    try {
      const res = await fetch('/api/admin/leadership-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, year, info, fileName }),
      });
      if (!res.ok) throw new Error('저장 실패');
      const data = (await res.json()) as { current: LeadershipInfo[]; history: LeadershipInfoVersion[] };
      set(state => ({
        current: { ...state.current, [key]: data.current },
        history: { ...state.history, [key]: data.history },
        loadedKeys: new Set(state.loadedKeys).add(key),
      }));
    } catch (e) {
      console.error('리더십 정보 저장 오류:', e);
    }
  },
}));
