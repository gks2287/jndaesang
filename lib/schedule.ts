// 뉴스레터 발송 주기/일정 계산 — configure 페이지(발송일 설정)와 메인 목록 페이지(회차별 발송일 표시)
// 양쪽에서 공유하는 공용 모듈.

export type DeliveryInterval = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual';

export const DELIVERY_INTERVAL_OPTIONS: Array<{ value: DeliveryInterval; label: string; days: number; desc: string }> = [
  { value: 'weekly',     label: '주간',   days: 7,   desc: '7일마다' },
  { value: 'biweekly',   label: '격주',   days: 14,  desc: '14일마다' },
  { value: 'monthly',    label: '월 1회', days: 30,  desc: '30일마다' },
  { value: 'bimonthly',  label: '월 2회', days: 15,  desc: '15일마다' },
  { value: 'quarterly',  label: '분기',   days: 90,  desc: '90일마다' },
  { value: 'semiannual', label: '반기',   days: 180, desc: '180일마다' },
];

export function calcScheduleDates(startDate: string, interval: DeliveryInterval, count: number): Date[] {
  const days = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === interval)?.days ?? 30;
  const start = new Date(startDate + 'T00:00:00');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * days);
    return d;
  });
}

export function formatKoreanDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}
