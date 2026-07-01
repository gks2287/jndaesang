'use client';

import { useEffect, useState } from 'react';

type CompanyMeta = { domain: string; label: string; color: string; slug: string };

// 기업 메타데이터 (키: 기업명)
export const COMPANY_META: Record<string, CompanyMeta> = {
  'LG화학': { domain: 'lgchem.com', label: 'LG', color: '#A50034', slug: 'lgchem' },
  '현대모비스': { domain: 'mobis.co.kr', label: '현대', color: '#002C5F', slug: 'mobis' },
  'SK하이닉스': { domain: 'skhynix.com', label: 'SK', color: '#EA002C', slug: 'skhynix' },
  '포스코': { domain: 'posco.com', label: 'PO', color: '#00A3E0', slug: 'posco' },
  '삼성SDI': { domain: 'samsungsdi.com', label: 'SDI', color: '#1428A0', slug: 'samsungsdi' },
  'KT&G': { domain: 'ktng.com', label: 'KT&G', color: '#E2231A', slug: 'ktng' },
  '롯데케미칼': { domain: 'lottechem.com', label: '롯데', color: '#DA291C', slug: 'lottechem' },
  '두산에너빌리티': { domain: 'doosan.com', label: '두산', color: '#231F20', slug: 'doosan' },
};

interface CompanyLogoProps {
  name: string;          // COMPANY_META 키값과 일치
  size?: number;         // px, 기본 48
  className?: string;    // 추가 클래스 (모서리는 컴포넌트가 rounded-lg로 통일)
  logoUrl?: string | null; // 직접 업로드한 로고(data URL). 있으면 최우선 표시
}

// 기업 CI 로고. 업로드 로고 > 로컬 번들(png → svg) > 텍스트 아바타 순으로 fallback.
export default function CompanyLogo({ name, size = 48, className = '', logoUrl }: CompanyLogoProps) {
  const meta = COMPANY_META[name];
  // 이미지 소스 후보 (순서대로 시도). meta 없으면 곧장 텍스트 아바타.
  const sources = meta
    ? [`/logos/${meta.slug}.png`, `/logos/${meta.slug}.svg`]
    : [];

  const [idx, setIdx] = useState(0);

  // name이 바뀌면 소스 인덱스 초기화 (리스트 항목 재사용 시 stale 소스 방지)
  useEffect(() => { setIdx(0); }, [name]);

  // 직접 업로드한 로고가 있으면 최우선 (훅 호출 이후에 분기)
  if (logoUrl) {
    return (
      <div
        className={`flex-shrink-0 overflow-hidden rounded-lg bg-white ${className}`}
        style={{ width: size, height: size }}
      >
        <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  const label = meta?.label ?? name.slice(0, 2).toUpperCase();

  // 텍스트 아바타 (meta 없음 또는 모든 이미지 소스 실패) — 이미지와 동일하게 rounded-lg
  if (!meta || idx >= sources.length) {
    return (
      <div
        className={`flex items-center justify-center flex-shrink-0 overflow-hidden rounded-lg text-white font-bold leading-none ${className}`}
        style={{ width: size, height: size, backgroundColor: meta?.color ?? '#6B7280', fontSize: Math.max(10, Math.round(size * 0.3)) }}
      >
        {label}
      </div>
    );
  }

  // 로고 이미지 — 흰 배경 + 얇은 보더 + 안쪽 여백(경계에 안 닿게)
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100 ${className}`}
      style={{ width: size, height: size, padding: size * 0.1 }}
    >
      <img
        src={sources[idx]}
        alt={name}
        className="w-full h-full object-contain"
        onError={() => setIdx(i => i + 1)}
      />
    </div>
  );
}
