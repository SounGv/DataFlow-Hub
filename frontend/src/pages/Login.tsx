import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      auth.set(res.accessToken);
      nav('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 !p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-accent px-2 py-1 text-sm font-bold text-white">DF</span>
          <h1 className="text-lg font-semibold">DATAFLOW HUB</h1>
        </div>
        <p className="text-sm text-slate-500">เข้าสู่ระบบเพื่อใช้งาน Dashboard</p>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">อีเมล</label>
          <input className="input w-full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">รหัสผ่าน</label>
          <input className="input w-full" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full justify-center" disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
