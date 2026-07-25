'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';

type AdminRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

const roleLabel = (role: string) => (role === 'super_admin' ? '슈퍼관리자' : '관리자');

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const myEmail = session?.user?.email ?? '';
  const myName = session?.user?.name ?? '';
  const myRole = (session?.user as { role?: string })?.role ?? '';
  const isSuper = myRole === 'super_admin';

  // 관리자 목록 상태를 상위에서 소유 → 좌측 '추가 폼'과 우측 '목록'이 공유(추가/삭제 시 즉시 갱신).
  const { admins, loading, listErr, load } = useAdmins(isSuper);

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-y-auto">
      <div>
        <p className="text-[11px] tracking-[0.2em] text-icon font-medium mb-0.5">SETTINGS</p>
        <h1 className="text-xl font-bold text-text-primary">설정</h1>
      </div>

      {isSuper ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full max-w-6xl items-start">
          {/* 좌측: 내 계정 · 관리자 추가 · 로그아웃 */}
          <div className="flex flex-col gap-5">
            <MyAccountSection email={myEmail} name={myName} role={myRole} />
            <AdminCreateSection onCreated={load} />
            <LogoutSection />
          </div>
          {/* 우측: 관리자 계정 목록 */}
          <div className="flex flex-col gap-5">
            <AdminListSection admins={admins} loading={loading} listErr={listErr} myEmail={myEmail} onChanged={load} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 max-w-2xl w-full">
          <MyAccountSection email={myEmail} name={myName} role={myRole} />
          <LogoutSection />
        </div>
      )}
    </div>
  );
}

/* 관리자 목록 데이터 훅 — enabled(슈퍼관리자)일 때만 조회. */
function useAdmins(enabled: boolean) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setListErr('');
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      if (!res.ok) setListErr(data.error ?? '목록을 불러오지 못했습니다.');
      else setAdmins(data);
    } catch {
      setListErr('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { admins, loading, listErr, load };
}

/* ── 카드 공통 래퍼 ── */
function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-border rounded-sm p-5">
      <h2 className="text-sm font-bold text-text-primary">{title}</h2>
      {desc && <p className="text-xs text-text-secondary mt-1">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-sm text-sm text-text-primary placeholder-placeholder focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition bg-surface';

/* ── 1. 내 계정 ── */
function MyAccountSection({ email, name, role }: { email: string; name: string; role: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ type: 'err', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }
    if (next.length < 8) {
      setMsg({ type: 'err', text: '새 비밀번호는 8자 이상이어야 합니다.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error ?? '변경에 실패했습니다.' });
      } else {
        setMsg({ type: 'ok', text: '비밀번호가 변경되었습니다.' });
        setCurrent('');
        setNext('');
        setConfirm('');
      }
    } catch {
      setMsg({ type: 'err', text: '요청 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="내 계정">
      <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm mb-5">
        <dt className="text-text-secondary">아이디</dt>
        <dd className="text-text-primary font-medium">{email}</dd>
        <dt className="text-text-secondary">이름</dt>
        <dd className="text-text-primary font-medium">{name || '-'}</dd>
        <dt className="text-text-secondary">권한</dt>
        <dd className="text-text-primary font-medium">{roleLabel(role)}</dd>
      </dl>

      <p className="text-xs font-semibold text-text-secondary mb-2">비밀번호 변경</p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="현재 비밀번호"
          autoComplete="current-password"
          required
          className={inputClass}
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="새 비밀번호 (8자 이상)"
          autoComplete="new-password"
          required
          className={inputClass}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="새 비밀번호 확인"
          autoComplete="new-password"
          required
          className={inputClass}
        />
        {msg && (
          <p className={`text-xs ${msg.type === 'ok' ? 'text-status-success' : 'text-status-error'}`}>{msg.text}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="self-start mt-1 bg-brand hover:bg-brand-dark disabled:opacity-60 text-text-onBrand text-sm font-semibold px-4 py-2 rounded-sm transition-colors"
        >
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </Card>
  );
}

/* ── 2. 관리자 추가 (슈퍼관리자 전용, 좌측) ── */
function AdminCreateSection({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [createMsg, setCreateMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    if (password.length < 8) {
      setCreateMsg({ type: 'err', text: '초기 비밀번호는 8자 이상이어야 합니다.' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateMsg({ type: 'err', text: data.error ?? '생성에 실패했습니다.' });
      } else {
        setCreateMsg({ type: 'ok', text: `관리자 '${data.email}' 계정을 만들었습니다.` });
        setEmail('');
        setName('');
        setPassword('');
        onCreated();
      }
    } catch {
      setCreateMsg({ type: 'err', text: '요청 중 오류가 발생했습니다.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card title="관리자 추가" desc="J&컴퍼니 직원용 관리자 계정을 발급합니다. 초기 비밀번호는 당사자에게 전달하고, 당사자가 로그인 후 '내 계정'에서 변경합니다.">
      <form onSubmit={create} className="flex flex-col gap-2">
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="아이디 (이메일)"
          autoComplete="off"
          required
          className={inputClass}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          autoComplete="off"
          className={inputClass}
        />
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="초기 비밀번호 (8자 이상)"
          autoComplete="off"
          required
          className={inputClass}
        />
        {createMsg && (
          <p className={`text-xs ${createMsg.type === 'ok' ? 'text-status-success' : 'text-status-error'}`}>
            {createMsg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={creating}
          className="self-start mt-1 bg-brand hover:bg-brand-dark disabled:opacity-60 text-text-onBrand text-sm font-semibold px-4 py-2 rounded-sm transition-colors"
        >
          {creating ? '생성 중...' : '관리자 추가'}
        </button>
      </form>
    </Card>
  );
}

/* ── 관리자 계정 목록 (슈퍼관리자 전용, 우측) ── */
function AdminListSection({
  admins,
  loading,
  listErr,
  myEmail,
  onChanged,
}: {
  admins: AdminRow[];
  loading: boolean;
  listErr: string;
  myEmail: string;
  onChanged: () => void;
}) {
  const remove = async (row: AdminRow) => {
    if (!window.confirm(`관리자 '${row.email}' 계정을 삭제할까요?`)) return;
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error ?? '삭제에 실패했습니다.');
        return;
      }
      onChanged();
    } catch {
      window.alert('요청 중 오류가 발생했습니다.');
    }
  };

  return (
    <Card title={`관리자 계정 목록${!loading && !listErr ? ` (${admins.length})` : ''}`}>
      <p className="text-[11px] text-text-secondary -mt-3 mb-3">※ 보안상 비밀번호는 표시되지 않습니다</p>
      <div className="border border-border rounded-sm overflow-x-auto">
        {loading ? (
          <p className="text-sm text-text-secondary px-4 py-3">불러오는 중...</p>
        ) : listErr ? (
          <p className="text-sm text-status-error px-4 py-3">{listErr}</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-text-secondary px-4 py-3">등록된 관리자가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-text-secondary text-xs">
                <th className="text-left font-medium px-3 py-2">이름</th>
                <th className="text-left font-medium px-3 py-2">아이디</th>
                <th className="text-left font-medium px-3 py-2">권한</th>
                <th className="text-left font-medium px-3 py-2">생성일</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((a) => {
                const isSelf = a.email === myEmail;
                const protectedRow = isSelf || a.role === 'super_admin';
                return (
                  <tr key={a.id} className="text-text-primary">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {a.name || '-'}
                      {isSelf && <span className="ml-1 text-[11px] text-text-secondary">(나)</span>}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{a.email}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-sm ${
                          a.role === 'super_admin' ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-text-secondary'
                        }`}
                      >
                        {roleLabel(a.role)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-text-secondary">{formatDate(a.createdAt)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {!protectedRow && (
                        <button onClick={() => remove(a)} className="text-xs text-status-error hover:underline">
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

/* ── 3. 로그아웃 ── */
function LogoutSection() {
  return (
    <Card title="로그아웃">
      <button
        onClick={() => signOut({ callbackUrl: '/auth/login' })}
        className="bg-status-error hover:opacity-90 text-white text-sm font-semibold px-4 py-2 rounded-sm transition-opacity"
      >
        로그아웃
      </button>
    </Card>
  );
}
