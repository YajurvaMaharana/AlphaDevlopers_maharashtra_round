import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || 'fan@example.com';

    return NextResponse.json({
      success: true,
      email,
      otp: '123456',
      demoMode: true,
      message: 'OTP sent successfully',
      challengeId: `chal_${Date.now()}_reg`,
      expiresAt: Date.now() + 300000
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      email: 'fan@example.com',
      otp: '123456',
      demoMode: true,
      message: 'OTP sent successfully'
    }, { status: 200 });
  }
}
