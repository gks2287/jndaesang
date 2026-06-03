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
  // ───── LG화학 (id: 1) ─────
  { id: 101, companyId: 1, year: 2025, name: '김태준', department: '생산기술팀', position: '부장', email: 'kim.tj@lgchem.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2025-11-10', stepCurrent: 5, stepTotal: 5 },
  { id: 102, companyId: 1, year: 2025, name: '이수민', department: '품질관리팀', position: '차장', email: 'lee.sm@lgchem.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2025-11-08', stepCurrent: 5, stepTotal: 5 },
  { id: 103, companyId: 1, year: 2025, name: '박현우', department: '연구개발팀', position: '부장', email: 'park.hw@lgchem.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2025-11-09', stepCurrent: 5, stepTotal: 5 },
  { id: 107, companyId: 1, year: 2025, name: '송하은', department: '경영기획팀', position: '부장', email: 'song.he@lgchem.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2025-11-12', stepCurrent: 5, stepTotal: 5 },
  { id: 108, companyId: 1, year: 2025, name: '임준서', department: '전략팀', position: '차장', email: 'lim.js@lgchem.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2025-11-11', stepCurrent: 5, stepTotal: 5 },
  { id: 109, companyId: 1, year: 2026, name: '권나연', department: '혁신추진팀', position: '부장', email: 'kwon.ny@lgchem.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 104, companyId: 1, year: 2026, name: '정미래', department: '영업팀', position: '과장', email: 'jung.mr@lgchem.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 105, companyId: 1, year: 2026, name: '최동혁', department: '인사팀', position: '차장', email: 'choi.dh@lgchem.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 106, companyId: 1, year: 2026, name: '박성호', department: '생산기술팀', position: '부장', email: 'park.sh@lgchem.com', leadershipType: '독재형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-10', stepCurrent: 3, stepTotal: 5 },
  { id: 110, companyId: 1, year: 2026, name: '한지수', department: '안전환경팀', position: '부장', email: 'han.js@lgchem.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-20', stepCurrent: 5, stepTotal: 5 },
  { id: 111, companyId: 1, year: 2026, name: '오채원', department: '구매팀', position: '차장', email: 'oh.cw@lgchem.com', leadershipType: '관계중심형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-18', stepCurrent: 3, stepTotal: 5 },
  { id: 112, companyId: 1, year: 2026, name: '서민준', department: '기술연구팀', position: '부장', email: 'seo.mj@lgchem.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 113, companyId: 1, year: 2026, name: '배수현', department: '생산관리팀', position: '차장', email: 'bae.sh@lgchem.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 114, companyId: 1, year: 2026, name: '신도현', department: '디지털혁신팀', position: '부장', email: 'shin.dh@lgchem.com', leadershipType: '완벽주의형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 115, companyId: 1, year: 2026, name: '조은지', department: '품질혁신팀', position: '차장', email: 'cho.ej@lgchem.com', leadershipType: '우유부단형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 116, companyId: 1, year: 2026, name: '황재현', department: '영업관리팀', position: '부장', email: 'hwang.jh@lgchem.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-15', stepCurrent: 2, stepTotal: 5 },
  { id: 117, companyId: 1, year: 2026, name: '양성민', department: '전략지원팀', position: '차장', email: 'yang.sm@lgchem.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },

  // ───── 현대모비스 (id: 2) ─────
  { id: 201, companyId: 2, year: 2026, name: '강서연', department: '부품개발팀', position: '부장', email: 'kang.sy@mobis.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-07', stepCurrent: 5, stepTotal: 5 },
  { id: 202, companyId: 2, year: 2026, name: '윤재혁', department: '구매팀', position: '차장', email: 'yoon.jh@mobis.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-08', stepCurrent: 3, stepTotal: 5 },
  { id: 203, companyId: 2, year: 2026, name: '임소희', department: '생산팀', position: '과장', email: 'lim.sh@mobis.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 204, companyId: 2, year: 2026, name: '이수현', department: '기술개발팀', position: '부장', email: 'lee.sh@mobis.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-10', stepCurrent: 5, stepTotal: 5 },
  { id: 205, companyId: 2, year: 2026, name: '김준서', department: '설계팀', position: '차장', email: 'kim.js@mobis.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 206, companyId: 2, year: 2026, name: '박서현', department: '영업팀', position: '부장', email: 'park.sh@mobis.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-09', stepCurrent: 5, stepTotal: 5 },
  { id: 207, companyId: 2, year: 2026, name: '정현우', department: '연구개발팀', position: '차장', email: 'jung.hw@mobis.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-11', stepCurrent: 4, stepTotal: 5 },
  { id: 208, companyId: 2, year: 2026, name: '최지우', department: '인사팀', position: '부장', email: 'choi.jw@mobis.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 209, companyId: 2, year: 2026, name: '한가영', department: '물류팀', position: '차장', email: 'han.gy@mobis.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 210, companyId: 2, year: 2026, name: '오재민', department: '품질혁신팀', position: '부장', email: 'oh.jm@mobis.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-06', stepCurrent: 5, stepTotal: 5 },
  { id: 211, companyId: 2, year: 2026, name: '서예진', department: '시스템개발팀', position: '차장', email: 'seo.yj@mobis.com', leadershipType: '서번트형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-12', stepCurrent: 3, stepTotal: 5 },
  { id: 212, companyId: 2, year: 2026, name: '배민재', department: '전략기획팀', position: '부장', email: 'bae.mj@mobis.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 213, companyId: 2, year: 2026, name: '권수현', department: '제조팀', position: '차장', email: 'kwon.sh@mobis.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 214, companyId: 2, year: 2026, name: '장도윤', department: '품질팀', position: '부장', email: 'jang.dy@mobis.com', leadershipType: '감정기복형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 215, companyId: 2, year: 2026, name: '안민준', department: '부품개발팀', position: '과장', email: 'ahn.mj@mobis.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 216, companyId: 2, year: 2026, name: '손지현', department: '연구개발팀', position: '차장', email: 'son.jh@mobis.com', leadershipType: '독재형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-13', stepCurrent: 2, stepTotal: 5 },
  { id: 217, companyId: 2, year: 2026, name: '유지연', department: '기술개발팀', position: '부장', email: 'yoo.jy@mobis.com', leadershipType: '방관형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },

  // ───── SK하이닉스 (id: 3) ─────
  { id: 301, companyId: 3, year: 2026, name: '한지원', department: '반도체개발팀', position: '부장', email: 'han.jw@skhynix.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-04-30', stepCurrent: 5, stepTotal: 5 },
  { id: 302, companyId: 3, year: 2026, name: '오민준', department: '공정팀', position: '차장', email: 'oh.mj@skhynix.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-04-28', stepCurrent: 5, stepTotal: 5 },
  { id: 303, companyId: 3, year: 2026, name: '신예진', department: '품질팀', position: '부장', email: 'shin.yj@skhynix.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-01', stepCurrent: 5, stepTotal: 5 },
  { id: 304, companyId: 3, year: 2026, name: '이채영', department: '메모리기술팀', position: '차장', email: 'lee.cy@skhynix.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-03', stepCurrent: 5, stepTotal: 5 },
  { id: 305, companyId: 3, year: 2026, name: '정서연', department: '설계팀', position: '부장', email: 'jung.sy@skhynix.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-05', stepCurrent: 4, stepTotal: 5 },
  { id: 306, companyId: 3, year: 2026, name: '조민재', department: '혁신팀', position: '차장', email: 'cho.mj@skhynix.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 307, companyId: 3, year: 2026, name: '문지훈', department: '연구개발팀', position: '부장', email: 'moon.jh@skhynix.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-02', stepCurrent: 5, stepTotal: 5 },
  { id: 308, companyId: 3, year: 2026, name: '채수현', department: '인사팀', position: '차장', email: 'chae.sh@skhynix.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 309, companyId: 3, year: 2026, name: '임세진', department: '패키징팀', position: '부장', email: 'lim.sj@skhynix.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 310, companyId: 3, year: 2026, name: '윤수빈', department: '양산기술팀', position: '차장', email: 'yoon.sb@skhynix.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 311, companyId: 3, year: 2026, name: '이보람', department: '제조혁신팀', position: '과장', email: 'lee.br@skhynix.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-04', stepCurrent: 3, stepTotal: 5 },
  { id: 312, companyId: 3, year: 2026, name: '박민영', department: '구매팀', position: '부장', email: 'park.my@skhynix.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 313, companyId: 3, year: 2026, name: '기준혁', department: 'D램팀', position: '차장', email: 'ki.jh@skhynix.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 314, companyId: 3, year: 2026, name: '성민재', department: '낸드팀', position: '부장', email: 'sung.mj@skhynix.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 315, companyId: 3, year: 2026, name: '노현진', department: '반도체개발팀', position: '차장', email: 'no.hj@skhynix.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 316, companyId: 3, year: 2026, name: '지성현', department: '공정팀', position: '부장', email: 'ji.sh@skhynix.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-06', stepCurrent: 2, stepTotal: 5 },
  { id: 317, companyId: 3, year: 2026, name: '안수진', department: '품질팀', position: '차장', email: 'ahn.sj@skhynix.com', leadershipType: '성과압박형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },

  // ───── 포스코 (id: 4) ─────
  { id: 401, companyId: 4, year: 2025, name: '장성민', department: '철강생산팀', position: '부장', email: 'jang.sm@posco.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-02-25', stepCurrent: 5, stepTotal: 5 },
  { id: 402, companyId: 4, year: 2025, name: '류아영', department: '기술연구팀', position: '차장', email: 'ryu.ay@posco.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-02-24', stepCurrent: 5, stepTotal: 5 },
  { id: 403, companyId: 4, year: 2026, name: '박준혁', department: '품질관리팀', position: '부장', email: 'park.jh@posco.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-08', stepCurrent: 5, stepTotal: 5 },
  { id: 404, companyId: 4, year: 2026, name: '김예린', department: '영업팀', position: '차장', email: 'kim.yr@posco.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-10', stepCurrent: 4, stepTotal: 5 },
  { id: 405, companyId: 4, year: 2026, name: '이지아', department: '인사팀', position: '부장', email: 'lee.ja@posco.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 406, companyId: 4, year: 2026, name: '황지현', department: '구매팀', position: '차장', email: 'hwang.jh@posco.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 407, companyId: 4, year: 2026, name: '나은서', department: '환경팀', position: '과장', email: 'na.es@posco.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 408, companyId: 4, year: 2026, name: '손준혁', department: '디지털혁신팀', position: '부장', email: 'son.jh@posco.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-05', stepCurrent: 5, stepTotal: 5 },
  { id: 409, companyId: 4, year: 2026, name: '이민석', department: '설비관리팀', position: '차장', email: 'lee.ms@posco.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 410, companyId: 4, year: 2026, name: '고은별', department: '에너지팀', position: '부장', email: 'ko.eb@posco.com', leadershipType: '서번트형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 411, companyId: 4, year: 2026, name: '유민서', department: '연구개발팀', position: '차장', email: 'yoo.ms@posco.com', leadershipType: '독재형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 412, companyId: 4, year: 2026, name: '박재민', department: '철강생산팀', position: '부장', email: 'park.jm@posco.com', leadershipType: '방관형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 413, companyId: 4, year: 2026, name: '정태준', department: '기술연구팀', position: '차장', email: 'jung.tj@posco.com', leadershipType: '감정기복형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-09', stepCurrent: 3, stepTotal: 5 },
  { id: 414, companyId: 4, year: 2026, name: '윤나영', department: '마케팅팀', position: '과장', email: 'yoon.ny@posco.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 415, companyId: 4, year: 2026, name: '정재훈', department: '경영지원팀', position: '부장', email: 'jung.jh@posco.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 416, companyId: 4, year: 2026, name: '최민지', department: '안전팀', position: '차장', email: 'choi.mj@posco.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 417, companyId: 4, year: 2026, name: '김민재', department: '해외영업팀', position: '부장', email: 'kim.mr@posco.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-11', stepCurrent: 2, stepTotal: 5 },

  // ───── 삼성SDI (id: 5) ─────
  { id: 501, companyId: 5, year: 2026, name: '백승호', department: '배터리개발팀', position: '부장', email: 'baek.sh@samsungsdi.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 502, companyId: 5, year: 2026, name: '남지현', department: '전자재료팀', position: '차장', email: 'nam.jh@samsungsdi.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 503, companyId: 5, year: 2026, name: '이정현', department: '제조팀', position: '부장', email: 'lee.jh@samsungsdi.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-10', stepCurrent: 5, stepTotal: 5 },
  { id: 504, companyId: 5, year: 2026, name: '박하은', department: '품질팀', position: '차장', email: 'park.he@samsungsdi.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 505, companyId: 5, year: 2026, name: '김지현', department: '인사팀', position: '부장', email: 'kim.jh@samsungsdi.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-12', stepCurrent: 3, stepTotal: 5 },
  { id: 506, companyId: 5, year: 2026, name: '정수아', department: '영업팀', position: '차장', email: 'jung.sa@samsungsdi.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-08', stepCurrent: 5, stepTotal: 5 },
  { id: 507, companyId: 5, year: 2026, name: '안재원', department: '기술연구팀', position: '부장', email: 'ahn.jw@samsungsdi.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 508, companyId: 5, year: 2026, name: '이예원', department: '소재개발팀', position: '차장', email: 'lee.yw@samsungsdi.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 509, companyId: 5, year: 2026, name: '서채원', department: '제품기획팀', position: '과장', email: 'seo.cw@samsungsdi.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 510, companyId: 5, year: 2026, name: '송지원', department: '공정기술팀', position: '부장', email: 'song.jw@samsungsdi.com', leadershipType: '방관형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 511, companyId: 5, year: 2026, name: '구민서', department: '설비팀', position: '차장', email: 'ku.ms@samsungsdi.com', leadershipType: '불통형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 512, companyId: 5, year: 2026, name: '임재현', department: '해외사업팀', position: '부장', email: 'lim.jh@samsungsdi.com', leadershipType: '성과압박형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-09', stepCurrent: 4, stepTotal: 5 },
  { id: 513, companyId: 5, year: 2026, name: '조하은', department: '스마트팩토리팀', position: '차장', email: 'cho.he@samsungsdi.com', leadershipType: '감정기복형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 514, companyId: 5, year: 2026, name: '권용석', department: '연구기획팀', position: '부장', email: 'kwon.ys@samsungsdi.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 515, companyId: 5, year: 2026, name: '허재원', department: '전지개발팀', position: '차장', email: 'heo.jw@samsungsdi.com', leadershipType: '독재형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 516, companyId: 5, year: 2026, name: '최서연', department: '배터리개발팀', position: '부장', email: 'choi.sy@samsungsdi.com', leadershipType: '방관형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-11', stepCurrent: 3, stepTotal: 5 },
  { id: 517, companyId: 5, year: 2026, name: '이시현', department: '품질팀', position: '차장', email: 'lee.sih@samsungsdi.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },

  // ───── KT&G (id: 6) ─────
  { id: 601, companyId: 6, year: 2026, name: '홍기태', department: '마케팅팀', position: '부장', email: 'hong.kt@ktng.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-09', stepCurrent: 3, stepTotal: 5 },
  { id: 602, companyId: 6, year: 2026, name: '전지수', department: '영업전략팀', position: '과장', email: 'jeon.js@ktng.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 603, companyId: 6, year: 2026, name: '문성준', department: '인사팀', position: '차장', email: 'moon.sj@ktng.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-10', stepCurrent: 4, stepTotal: 5 },
  { id: 604, companyId: 6, year: 2026, name: '정유진', department: '연구개발팀', position: '부장', email: 'jung.yj@ktng.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-08', stepCurrent: 5, stepTotal: 5 },
  { id: 605, companyId: 6, year: 2026, name: '박채연', department: '생산팀', position: '차장', email: 'park.cy@ktng.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 606, companyId: 6, year: 2026, name: '김보람', department: '브랜드전략팀', position: '부장', email: 'kim.br@ktng.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-11', stepCurrent: 4, stepTotal: 5 },
  { id: 607, companyId: 6, year: 2026, name: '이나경', department: '디지털혁신팀', position: '차장', email: 'lee.nk@ktng.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-07', stepCurrent: 5, stepTotal: 5 },
  { id: 608, companyId: 6, year: 2026, name: '양지수', department: '해외사업팀', position: '과장', email: 'yang.js@ktng.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 609, companyId: 6, year: 2026, name: '강민서', department: '소비자인사이트팀', position: '부장', email: 'kang.ms@ktng.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 610, companyId: 6, year: 2026, name: '오서현', department: '품질관리팀', position: '차장', email: 'oh.sh@ktng.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 611, companyId: 6, year: 2026, name: '배도현', department: '구매팀', position: '부장', email: 'bae.dh@ktng.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 612, companyId: 6, year: 2026, name: '신민준', department: '경영기획팀', position: '차장', email: 'shin.mj@ktng.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 613, companyId: 6, year: 2026, name: '이재현', department: '신사업팀', position: '부장', email: 'lee.jh2@ktng.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 614, companyId: 6, year: 2026, name: '주지훈', department: '제품개발팀', position: '차장', email: 'ju.jh@ktng.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 615, companyId: 6, year: 2026, name: '김건우', department: '마케팅팀', position: '부장', email: 'kim.kw@ktng.com', leadershipType: '감정기복형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-12', stepCurrent: 2, stepTotal: 5 },
  { id: 616, companyId: 6, year: 2026, name: '이유진', department: '영업전략팀', position: '차장', email: 'lee.yj@ktng.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 617, companyId: 6, year: 2026, name: '박시현', department: '연구개발팀', position: '과장', email: 'park.sih@ktng.com', leadershipType: '서번트형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },

  // ───── 롯데케미칼 (id: 7) ─────
  { id: 701, companyId: 7, year: 2026, name: '서준영', department: '화학연구팀', position: '부장', email: 'seo.jy@lottechem.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 702, companyId: 7, year: 2026, name: '이수진', department: '생산팀', position: '차장', email: 'lee.sj@lottechem.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-10', stepCurrent: 5, stepTotal: 5 },
  { id: 703, companyId: 7, year: 2026, name: '김도연', department: '품질팀', position: '부장', email: 'kim.dy@lottechem.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-12', stepCurrent: 4, stepTotal: 5 },
  { id: 704, companyId: 7, year: 2026, name: '박서윤', department: '영업팀', position: '차장', email: 'park.sy@lottechem.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 705, companyId: 7, year: 2026, name: '정민서', department: '인사팀', position: '부장', email: 'jung.ms@lottechem.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-09', stepCurrent: 5, stepTotal: 5 },
  { id: 706, companyId: 7, year: 2026, name: '최수현', department: '기술개발팀', position: '차장', email: 'choi.sh@lottechem.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 707, companyId: 7, year: 2026, name: '이혜진', department: '공정기술팀', position: '부장', email: 'lee.hj@lottechem.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 708, companyId: 7, year: 2026, name: '강도현', department: '원료구매팀', position: '차장', email: 'kang.dh@lottechem.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 709, companyId: 7, year: 2026, name: '윤지훈', department: '연구기획팀', position: '과장', email: 'yoon.jh@lottechem.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 710, companyId: 7, year: 2026, name: '장수현', department: '제품개발팀', position: '부장', email: 'jang.sh@lottechem.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 711, companyId: 7, year: 2026, name: '오지은', department: '해외영업팀', position: '차장', email: 'oh.je@lottechem.com', leadershipType: '성과압박형', assessmentRound: 2, deliveryStatus: '열람', lastOpenedAt: '2026-05-11', stepCurrent: 3, stepTotal: 5 },
  { id: 712, companyId: 7, year: 2026, name: '김소연', department: '마케팅팀', position: '부장', email: 'kim.sy@lottechem.com', leadershipType: '감정기복형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 713, companyId: 7, year: 2026, name: '문재현', department: '환경안전팀', position: '차장', email: 'moon.jh@lottechem.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 714, companyId: 7, year: 2026, name: '박지훈', department: '사업전략팀', position: '부장', email: 'park.jh@lottechem.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 715, companyId: 7, year: 2026, name: '안은지', department: '제조팀', position: '차장', email: 'ahn.ej@lottechem.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 716, companyId: 7, year: 2026, name: '조성준', department: '소재개발팀', position: '부장', email: 'cho.sj@lottechem.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-13', stepCurrent: 2, stepTotal: 5 },
  { id: 717, companyId: 7, year: 2026, name: '배지수', department: '화학연구팀', position: '차장', email: 'bae.js@lottechem.com', leadershipType: '방관형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },

  // ───── 두산에너빌리티 (id: 8) ─────
  { id: 801, companyId: 8, year: 2026, name: '고은지', department: '에너지솔루션팀', position: '차장', email: 'ko.ej@doosan.com', leadershipType: '성과압박형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 802, companyId: 8, year: 2026, name: '허정민', department: '발전사업팀', position: '부장', email: 'heo.jm@doosan.com', leadershipType: '독재형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 803, companyId: 8, year: 2026, name: '이서진', department: '핵심기술팀', position: '부장', email: 'lee.sj2@doosan.com', leadershipType: '코칭형', assessmentRound: 1, deliveryStatus: '완료', lastOpenedAt: '2026-05-08', stepCurrent: 5, stepTotal: 5 },
  { id: 804, companyId: 8, year: 2026, name: '김태영', department: '플랜트팀', position: '차장', email: 'kim.ty@doosan.com', leadershipType: '민주형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 805, companyId: 8, year: 2026, name: '박수현', department: '인사팀', position: '부장', email: 'park.sh2@doosan.com', leadershipType: '서번트형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-10', stepCurrent: 3, stepTotal: 5 },
  { id: 806, companyId: 8, year: 2026, name: '정성준', department: '디지털혁신팀', position: '차장', email: 'jung.sj@doosan.com', leadershipType: '비전형', assessmentRound: 2, deliveryStatus: '완료', lastOpenedAt: '2026-05-07', stepCurrent: 5, stepTotal: 5 },
  { id: 807, companyId: 8, year: 2026, name: '오도준', department: '원자력팀', position: '부장', email: 'oh.dj@doosan.com', leadershipType: '관계중심형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 808, companyId: 8, year: 2026, name: '이수빈', department: '신재생에너지팀', position: '차장', email: 'lee.sb@doosan.com', leadershipType: '코칭형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 809, companyId: 8, year: 2026, name: '최재원', department: '설계팀', position: '과장', email: 'choi.jw2@doosan.com', leadershipType: '민주형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 810, companyId: 8, year: 2026, name: '장도연', department: '해외사업팀', position: '부장', email: 'jang.dy@doosan.com', leadershipType: '서번트형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 811, companyId: 8, year: 2026, name: '배준혁', department: '구매팀', position: '차장', email: 'bae.jh@doosan.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 1, stepTotal: 5 },
  { id: 812, companyId: 8, year: 2026, name: '한민준', department: '품질팀', position: '부장', email: 'han.mj@doosan.com', leadershipType: '불통형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 813, companyId: 8, year: 2026, name: '이현우', department: '제조팀', position: '차장', email: 'lee.hw@doosan.com', leadershipType: '감정기복형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-11', stepCurrent: 3, stepTotal: 5 },
  { id: 814, companyId: 8, year: 2026, name: '서준혁', department: '연구개발팀', position: '부장', email: 'seo.jh@doosan.com', leadershipType: '완벽주의형', assessmentRound: 2, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 815, companyId: 8, year: 2026, name: '구나영', department: '엔지니어링팀', position: '차장', email: 'ku.ny@doosan.com', leadershipType: '우유부단형', assessmentRound: 1, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 5 },
  { id: 816, companyId: 8, year: 2026, name: '전성민', department: '발전사업팀', position: '부장', email: 'jeon.sm@doosan.com', leadershipType: '성과압박형', assessmentRound: 2, deliveryStatus: '발송완료', lastOpenedAt: null, stepCurrent: 2, stepTotal: 5 },
  { id: 817, companyId: 8, year: 2026, name: '윤지현', department: '에너지솔루션팀', position: '차장', email: 'yoon.jh2@doosan.com', leadershipType: '방관형', assessmentRound: 1, deliveryStatus: '열람', lastOpenedAt: '2026-05-09', stepCurrent: 2, stepTotal: 5 },
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
