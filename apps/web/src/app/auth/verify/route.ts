import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || 'fan@example.com';
    const token = `jwt_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: `usr_${Date.now().toString(36)}`,
        email,
        riskTier: 'low'
      }
    }, { status: 200 });
  } catch {
    return NextResponse.json({
      success: true,
      token: `jwt_mock_${Date.now()}`,
      user: {
        id: 'usr_mock_001',
        email: 'fan@example.com',
        riskTier: 'low'
      }
    }, { status: 200 });
  }
}
