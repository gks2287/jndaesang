// 뉴스레터 발송 여부 판정 공용 유틸
// 발송 기록은 Newsletter.sentGroups에 `${회차번호}|${리더십유형}` 키로 저장된다.
// (예: "1|독재형") 목록 화면과 콘텐츠 편집기 양쪽에서 동일 로직을 재사용한다.

/** 발송완료 기록 키 생성: `${회차번호}|${유형명}` */
export const sentKey = (roundNum: number, typeName: string): string => `${roundNum}|${typeName}`;

/**
 * 특정 회차의 한 발송 그룹(유형 묶음)이 이미 발송 완료되었는지 판정.
 * 그룹의 모든 유형이 sentGroups에 기록되어 있어야 발송완료(=수정 잠금)로 본다.
 * 유형이 하나도 없는 그룹은 발송완료로 보지 않는다.
 */
export function isSendGroupSent(
  sentGroups: string[] | undefined,
  roundNum: number,
  typeNames: string[],
): boolean {
  if (!typeNames || typeNames.length === 0) return false;
  const sent = new Set(sentGroups ?? []);
  return typeNames.every(t => sent.has(sentKey(roundNum, t)));
}
