import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMetaOAuthState, getMetaConfig, META_OAUTH_COOKIE, metaAuthorizationUrl, metaSocialMediaReturnUrl } from '@/lib/meta-api';
import { requireSocialMediaUser } from '@/lib/social-media-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const returnUrl = metaSocialMediaReturnUrl(request.url);
  try {
    const user = await requireSocialMediaUser();
    const url = new URL(request.url);
    const rawClientId = url.searchParams.get('clientId')?.trim() || null;
    const clientId = rawClientId === 'company' ? null : rawClientId;
    if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) {
      returnUrl.searchParams.set('meta_error', 'client_not_found');
      return NextResponse.redirect(returnUrl);
    }

    const config = getMetaConfig();
    const state = await createMetaOAuthState(user.id, clientId);
    const response = NextResponse.redirect(metaAuthorizationUrl(config, state));
    response.cookies.set(META_OAUTH_COOKIE, state, {
      httpOnly: true,
      secure: config.redirectUri.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/api/social-media/meta/callback'
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = message === 'UNAUTHENTICATED' ? 'unauthenticated'
      : message === 'FORBIDDEN' ? 'forbidden'
      : message === 'META_NOT_CONFIGURED' ? 'not_configured'
      : 'setup_error';
    returnUrl.searchParams.set('meta_error', code);
    return NextResponse.redirect(returnUrl);
  }
}
