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
}

const MOCK: Participant[] = [
  // LG화학 (id: 1) — 2025
  { id: 101, companyId: 1, year: 2025, name: '김태준', department: '생산기술팀', position: '부장', email: 'kim.tj@lgchem.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2025-11-10', stepCurrent: 5, stepTotal: 5 },
  { id: 102, companyId: 1, year: 2025, name: '이수민', department: '품질관리팀', position: '차장', email: 'lee.sm@lgchem.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2025-11-08', stepCurrent: 5, stepTotal: 5 },
  { id: 103, companyId: 1, year: 2025, name: '박현우', department: '연구개발팀', position: '부장', email: 'park.hw@lgchem.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2025-11-09', stepCurrent: 5, stepTotal: 5 },
  // LG화학 (id: 1) — 2026
  { id: 104, companyId: 1, year: 2026, name: '정미래', department: '영업팀', position: '과장', email: 'jung.mr@lgchem.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 105, companyId: 1, year: 2026, name: '최동혁', department: '인사팀', position: '차장', email: 'choi.dh@lgchem.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 106, companyId: 1, year: 2026, name: '김태준', department: '생산기술팀', position: '부장', email: 'kim.tj@lgchem.com', leadershipType: '독재형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-10', stepCurrent: 3, stepTotal: 5 },

  // 현대모비스 (id: 2) — 2026
  { id: 201, companyId: 2, year: 2026, name: '강서연', department: '부품개발팀', position: '부장', email: 'kang.sy@mobis.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-07', stepCurrent: 5, stepTotal: 5 },
  { id: 202, companyId: 2, year: 2026, name: '윤재혁', department: '구매팀', position: '차장', email: 'yoon.jh@mobis.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-08', stepCurrent: 3, stepTotal: 5 },
  { id: 203, companyId: 2, year: 2026, name: '임소희', department: '생산팀', position: '과장', email: 'lim.sh@mobis.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },

  // SK하이닉스 (id: 3) — 2026
  { id: 301, companyId: 3, year: 2026, name: '한지원', department: '반도체개발팀', position: '부장', email: 'han.jw@skhynix.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-04-30', stepCurrent: 5, stepTotal: 5 },
  { id: 302, companyId: 3, year: 2026, name: '오민준', department: '공정팀', position: '차장', email: 'oh.mj@skhynix.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-04-28', stepCurrent: 5, stepTotal: 5 },
  { id: 303, companyId: 3, year: 2026, name: '신예진', department: '품질팀', position: '부장', email: 'shin.yj@skhynix.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-01', stepCurrent: 5, stepTotal: 5 },

  // 포스코 (id: 4) — 2025
  { id: 401, companyId: 4, year: 2025, name: '장성민', department: '철강생산팀', position: '부장', email: 'jang.sm@posco.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-02-25', stepCurrent: 5, stepTotal: 5 },
  { id: 402, companyId: 4, year: 2025, name: '류아영', department: '기술연구팀', position: '차장', email: 'ryu.ay@posco.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-02-24', stepCurrent: 5, stepTotal: 5 },

  // 삼성SDI (id: 5) — 2026
  { id: 501, companyId: 5, year: 2026, name: '백승호', department: '배터리개발팀', position: '부장', email: 'baek.sh@samsungsdi.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 502, companyId: 5, year: 2026, name: '남지현', department: '전자재료팀', position: '차장', email: 'nam.jh@samsungsdi.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },

  // KT&G (id: 6) — 2026
  { id: 601, companyId: 6, year: 2026, name: '홍기태', department: '마케팅팀', position: '부장', email: 'hong.kt@ktng.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-09', stepCurrent: 3, stepTotal: 5 },
  { id: 602, companyId: 6, year: 2026, name: '전미선', department: '영업전략팀', position: '과장', email: 'jeon.ms@ktng.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 603, companyId: 6, year: 2026, name: '문성준', department: '인사팀', position: '차장', email: 'moon.sj@ktng.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-10', stepCurrent: 4, stepTotal: 5 },

  // 롯데케미칼 (id: 7) — 2026
  { id: 701, companyId: 7, year: 2026, name: '서준영', department: '화학연구팀', position: '부장', email: 'seo.jy@lottechem.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },

  // 두산에너빌리티 (id: 8) — 2026
  { id: 801, companyId: 8, year: 2026, name: '고은지', department: '에너지솔루션팀', position: '차장', email: 'ko.ej@doosan.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 802, companyId: 8, year: 2026, name: '허정민', department: '발전사업팀', position: '부장', email: 'heo.jm@doosan.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
];

interface ParticipantStore {
  participants: Participant[];
  getByCompany: (companyId: number) => Participant[];
  getYearsByCompany: (companyId: number) => number[];
  addParticipants: (items: Omit<Participant, 'id'>[]) => void;
  updateParticipant: (id: number, data: Partial<Omit<Participant, 'id'>>) => void;
  removeParticipant: (id: number) => void;
}

export const useParticipantStore = create<ParticipantStore>((set, get) => ({
  participants: MOCK,
  getByCompany: (companyId) =>
    get().participants.filter(p => p.companyId === companyId),
  getYearsByCompany: (companyId) => {
    const years = get()
      .participants.filter(p => p.companyId === companyId)
      .map(p => p.year);
    return [...new Set(years)].sort((a, b) => b - a);
  },
  addParticipants: (items) => {
    const current = get().participants;
    const maxId = current.length > 0 ? Math.max(...current.map(p => p.id)) : 0;
    const next = items.map((item, i) => ({ ...item, id: maxId + i + 1 }));
    set({ participants: [...current, ...next] });
  },
  updateParticipant: (id, data) => {
    set({
      participants: get().participants.map(p => p.id === id ? { ...p, ...data } : p),
    });
  },
  removeParticipant: (id) => {
    set({ participants: get().participants.filter(p => p.id !== id) });
  },
}));
