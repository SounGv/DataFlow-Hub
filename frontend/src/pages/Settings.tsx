import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Async } from '../components/ui';

export default function Settings() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ id: string; email: string; role: string }>('/auth/me'),
  });

  return (
    <div className="max-w-lg space-y-4">
      <Async {...me} refetch={me.refetch}>
        {(u) => (
          <div className="card space-y-2 text-sm">
            <p><span className="text-slate-500">อีเมล: </span>{u.email}</p>
            <p><span className="text-slate-500">สิทธิ์: </span><span className="uppercase">{u.role}</span></p>
          </div>
        )}
      </Async>
      <div className="card space-y-2 text-sm">
        <p className="font-medium">การตั้งค่าระบบ</p>
        <p className="text-slate-500">
          รอบ sync, Google Sheets credentials และผู้ใช้งาน จัดการที่ฝั่ง Backend (.env / prisma seed) —
          ดูวิธีใน backend/README.md
        </p>
      </div>
    </div>
  );
}
