import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, setAuthCookie, getAdminPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 });
    }

    const adminPassword = getAdminPassword();
    const valid = await verifyPassword(password, adminPassword);

    if (!valid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    await setAuthCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
