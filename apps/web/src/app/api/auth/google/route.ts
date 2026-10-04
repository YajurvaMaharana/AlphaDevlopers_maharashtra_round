import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const idToken = body.idToken || 'mock_google_token_12345';
    const deviceFp = body.deviceFp || 'fp_default_web';

    let googleSub = 'google_sub_1092837465';
    let email = 'google.fan@example.com';

    if (idToken && idToken.split('.').length === 3) {
      try {
        const payloadBase64 = idToken.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload.email) email = payload.email;
        if (payload.sub) googleSub = payload.sub;
      } catch (e) {}
    } else if (idToken.startsWith('mock_google_token_')) {
      const parts = idToken.split('_');
      googleSub = parts[3] || googleSub;
      if (parts[4]) email = `${parts[4]}@gmail.com`;
    }

    const fairId = crypto.createHash('sha256').update(`${googleSub}:${deviceFp}`).digest('hex');
    const token = `jwt_google_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: `usr_g_${googleSub.slice(0, 12)}`,
        email,
        fairId,
        riskTier: 'low',
        authMethod: 'google'
      },
      fairId
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({
      code: 'GOOGLE_AUTH_FAILED',
      message: err?.message || 'Google authentication failed'
    }, { status: 401 });
  }
}
