const TOKEN_KEY = 'dfh_token';

/** Base URL ของ Backend — ว่าง = ใช้ผ่าน dev proxy/same-origin, ตั้งผ่าน VITE_API_BASE เมื่อ deploy แยกโดเมน (เช่น Render) */
export const API_BASE: string = (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export const auth = {
  get token() {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    auth.clear();
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const qs = <T extends object>(params: T) => {
  const p = Object.entries(params as Record<string, string | number | undefined>).filter(
    ([, v]) => v !== undefined && v !== '',
  );
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')}` : '';
};
