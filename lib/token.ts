import { randomBytes } from 'crypto';

// 직책자 뉴스레터 접근용 토큰 생성.
// 암호학적 난수 18바이트(base64url) = 24자, ~144비트 엔트로피 → 순번(id) 기반 추측 불가.
export function generateParticipantToken(): string {
  return randomBytes(18).toString('base64url');
}
