import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'htmlpush_admin_token';
const TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7天

export function verifyPassword(input: string, expected: string): boolean {
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function setAuthCookie(): Promise<void> {
  const token = createToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY,
    path: '/',
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  return !!token?.value;
}

export function getAdminPassword(): string {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) {
    throw new Error('ADMIN_PASSWORD 环境变量未设置');
  }
  return pwd;
}

export function isValidCurrentPageApiToken(token: string): boolean {
  const expected = process.env.CURRENT_PAGE_API_TOKEN;
  if (!expected) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
