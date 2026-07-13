// 간단한 인메모리 고정 윈도우 레이트리미터.
// 주의: 서버리스 인스턴스별 메모리라 전역 분산 제한은 아님(인스턴스 재사용 시에만 유효).
//       엄격한 분산 제한이 필요하면 Upstash Redis 등으로 교체 권장. 그래도 무제한 호출보다 훨씬 안전.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
}

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();

  // 맵이 과도하게 커지면 만료 버킷 정리 (메모리 누수 방지)
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSec: 0, remaining: opts.limit - 1 };
  }
  if (b.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0, remaining: opts.limit - b.count };
}

// 요청에서 클라이언트 IP 추출 (Vercel 프록시 헤더 우선)
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
