import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';

type Topic = { title: string; description: string };

// 서버 메모리 캐시 (회차+단계+유형+기업명 조합 → 주제 결과). 비용 절감용
const topicsCache = new Map<string, Topic[]>();
let topicsCallCount = 0;

export async function POST(req: NextRequest) {
  const { leadershipTypes, companyName, kind, stepTitle, roundIndex, leadershipInfo, groupDescription } = await req.json() as {
    leadershipTypes: string[];
    companyName: string;
    kind: string;
    stepTitle?: string;
    roundIndex?: number;
    leadershipInfo?: { type: string; characteristics?: string; developmentPoints?: string }[];
    groupDescription?: { summary?: string; characteristics?: string; developmentPoints?: string };
  };

  // 그룹 설정 단계에서 원문 기반으로 도출·편집된 그룹 설명 — 주제 방향의 상위 기준
  const gd = groupDescription;
  const groupBlock = (gd && (gd.summary?.trim() || gd.characteristics?.trim() || gd.developmentPoints?.trim()))
    ? `\n[이 그룹의 리더십 정의 — 주제 방향의 기준]\n`
      + (gd.summary?.trim() ? `· 요약: ${gd.summary.trim()}\n` : '')
      + (gd.characteristics?.trim() ? `· 특성: ${gd.characteristics.trim()}\n` : '')
      + (gd.developmentPoints?.trim() ? `· 개발 포인트: ${gd.developmentPoints.trim()}` : '')
    : '';

  // 이 기업 다면진단 기반 유형 정보 블록 (주제가 이 특징·개발포인트를 직접 겨냥하도록)
  const infoList = (leadershipInfo ?? []).filter(i => i.characteristics?.trim() || i.developmentPoints?.trim());
  const infoBlock = infoList.length > 0
    ? `\n[이 기업 다면진단 기반 유형 정보 — 주제에 직접 반영]\n`
      + infoList.map(i => `- ${i.type}: 특징 ${i.characteristics ?? ''}${i.developmentPoints?.trim() ? ` / 개발포인트 ${i.developmentPoints}` : ''}`).join('\n')
    : '';

  // 캐시 키: 회차 인덱스 + 스토리라인 단계 + 리더십유형 + 기업명 + kind + 유형정보 시그니처 + 그룹설명 시그니처
  const cacheKey = JSON.stringify({ roundIndex: roundIndex ?? '', stepTitle: stepTitle ?? '', types: [...(leadershipTypes ?? [])].sort(), companyName: companyName ?? '', kind: kind ?? '', info: infoList.map(i => `${i.type}:${(i.characteristics ?? '').slice(0, 24)}`).sort(), gd: groupBlock.slice(0, 120) });
  topicsCallCount += 1;
  const cached = topicsCache.get(cacheKey);
  console.log(`[topics/suggest] 호출 #${topicsCallCount}, 캐시: ${cached ? 'HIT' : 'MISS'}`);
  if (cached) {
    return NextResponse.json({ topics: cached });
  }

  const types = leadershipTypes?.filter(Boolean) ?? [];
  const isCustom = kind === '맞춤형' && types.length > 0 && types[0] !== '일반형';
  const typeLabel = types.length > 0 && types[0] !== '일반형' ? types.join(', ') : '일반';
  const stepLabel = stepTitle ? `${stepTitle} 단계` : '';
  const roundLabel = roundIndex ? `${roundIndex}회차` : '';

  const targetDesc = isCustom
    ? `${companyName || '대상 기업'}의 ${typeLabel} 유형 리더를 대상으로 한 맞춤형 주제`
    : `${companyName || '대상 기업'}의 전체 리더를 대상으로 한 공통 주제`;

  const prompt = `당신은 기업 리더십 코칭 뉴스레터 기획자입니다.
아래 조건에 맞는 뉴스레터 주제 3가지를 제안해주세요.

[조건]
- 대상: ${targetDesc}
- 스토리라인 단계: ${stepLabel || '미지정'} (${roundLabel || ''})
${isCustom ? `- 핵심: ${typeLabel} 유형 리더의 특성과 문제 행동을 개선하는 데 직접적으로 도움이 되는 주제` : '- 핵심: 모든 리더에게 보편적으로 적용 가능한 리더십 역량 강화 주제'}
${groupBlock}
${infoBlock}

[작성 기준]
${groupBlock ? '- 위 "이 그룹의 리더십 정의"를 주제 방향의 최우선 기준으로 삼으세요. 그룹의 특성과 개발 포인트를 직접 겨냥하는 주제로 구성하고, 정의에 없는 내용은 만들지 마세요.' : ''}
${infoBlock ? '- 위 "이 기업 다면진단 기반 유형 정보"의 특징·개발포인트를 직접 겨냥하는 주제로 구성하세요 (그 기업의 실제 진단에 맞춤). 문서에 없는 내용은 만들지 마세요.' : ''}
- ${stepLabel ? `"${stepLabel}" 단계의 목적(${stepLabel === '수용' ? '진단 결과 수용·성찰' : stepLabel === '분석' ? 'Gap 분석·강약점 파악' : stepLabel === '실행' ? '실행 가능한 작은 변화' : stepLabel === '유지' ? '습관화·지속 유지' : stepLabel === '확장' ? '성장 복기·재준비' : '단계 목적'})에 부합하는 주제` : '스토리라인 단계에 맞는 주제'}
- 현장에서 바로 적용할 수 있는 실용적이고 행동 가능한 내용
- 각 주제는 4~5분 분량의 뉴스레터로 다룰 수 있어야 함
- 주제 간 중복 없이 다양한 각도로 접근
- title: 독자가 읽고 싶어지도록 구체적이고 흥미롭게 (10~25자)
- description: 주제를 한 줄로 명확하게 설명 (30~50자)

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 포함 금지:
{"topics": [{"title": "주제명", "description": "한 줄 설명"}, {"title": "주제명", "description": "한 줄 설명"}, {"title": "주제명", "description": "한 줄 설명"}]}`;

  try {
    const raw = await callClaude(prompt);
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('JSON 파싱 실패');
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { topics: Topic[] };
    const topics = (parsed.topics ?? []).slice(0, 3);
    topicsCache.set(cacheKey, topics); // 결과 캐시 저장
    return NextResponse.json({ topics });
  } catch (err) {
    console.error('[topics/suggest]', err);
    return NextResponse.json({ error: '주제 추천 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
