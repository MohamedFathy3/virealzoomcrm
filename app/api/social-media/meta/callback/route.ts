import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decryptSocialCredential, encryptSocialCredential } from '@/lib/social-media-crypto';
import { getMetaConfig, META_OAUTH_COOKIE, metaGet, metaSocialMediaReturnUrl, verifyMetaOAuthState } from '@/lib/meta-api';
import { requireSocialMediaUser } from '@/lib/social-media-server';

export const runtime = 'nodejs';

type TokenResponse = { access_token?: string; token_type?: string; expires_in?: number };
type MetaPage = { id?: string; name?: string; access_token?: string; tasks?: string[] };
type PagesResponse = { data?: MetaPage[]; paging?: { next?: string } };
type PageInstagramResponse = {
  instagram_business_account?: { id?: string; username?: string };
};

function redirectToSocialMedia(request: Request, code: string, clientId?: string | null) {
  const target = metaSocialMediaReturnUrl(request.url);
  target.searchParams.set('meta', code);
  if (clientId) target.searchParams.set('clientId', clientId);
  const response = NextResponse.redirect(target);
  response.cookies.set(META_OAUTH_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/api/social-media/meta/callback', sameSite: 'lax' });
  return response;
}

async function exchangeCodeForToken(config: ReturnType<typeof getMetaConfig>, code: string) {
  const exchangeUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
  exchangeUrl.searchParams.set('client_id', config.appId);
  exchangeUrl.searchParams.set('client_secret', config.appSecret);
  exchangeUrl.searchParams.set('redirect_uri', config.redirectUri);
  exchangeUrl.searchParams.set('code', code);
  const response = await fetch(exchangeUrl, { method: 'GET', cache: 'no-store', redirect: 'error' });
  const token = await response.json().catch(() => null) as TokenResponse | { error?: { message?: string } } | null;
  if (!response.ok || !token || !('access_token' in token) || typeof token.access_token !== 'string') {
    throw new Error('META_CODE_EXCHANGE_FAILED');
  }

  const longLivedUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longLivedUrl.searchParams.set('client_id', config.appId);
  longLivedUrl.searchParams.set('client_secret', config.appSecret);
  longLivedUrl.searchParams.set('fb_exchange_token', token.access_token);
  const longResponse = await fetch(longLivedUrl, { method: 'GET', cache: 'no-store', redirect: 'error' });
  const longLived = await longResponse.json().catch(() => null) as TokenResponse | null;
  if (!longResponse.ok || !longLived || typeof longLived.access_token !== 'string') {
    throw new Error('META_LONG_TOKEN_EXCHANGE_FAILED');
  }
  return longLived.access_token;
}

async function getInstagramAccount(pageId: string, pageToken: string, version: string) {
  try {
    const data = await metaGet<PageInstagramResponse>(pageId, version, pageToken, {
      fields: 'instagram_business_account{id,username}'
    });
    const account = data.instagram_business_account;
    if (!account?.id) return null;
    return { id: account.id, username: account.username?.trim() || account.id };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get('error');
  if (providerError) return redirectToSocialMedia(request, 'cancelled');

  const code = url.searchParams.get('code');
  const stateValue = url.searchParams.get('state');
  if (!code || code.length > 4096 || !stateValue || stateValue.length > 4096) {
    return redirectToSocialMedia(request, 'invalid_callback');
  }

  try {
    const cookieStore = await cookies();
    const cookieState = cookieStore.get(META_OAUTH_COOKIE)?.value;
    if (!cookieState || cookieState !== stateValue) return redirectToSocialMedia(request, 'state_expired');

    const state = await verifyMetaOAuthState(stateValue);
    const user = await requireSocialMediaUser();
    if (user.id !== state.userId) return redirectToSocialMedia(request, 'session_changed', state.clientId);
    if (state.clientId && !(await prisma.client.findUnique({ where: { id: state.clientId }, select: { id: true } }))) {
      return redirectToSocialMedia(request, 'client_not_found');
    }

    const config = getMetaConfig();
    const userToken = await exchangeCodeForToken(config, code);
    const pages = await metaGet<PagesResponse>('me/accounts', config.graphVersion, userToken, {
      fields: 'id,name,access_token,tasks',
      limit: '100'
    });
    const eligiblePages = (pages.data ?? []).filter(page =>
      typeof page.id === 'string' && /^\d+$/.test(page.id) &&
      typeof page.access_token === 'string' &&
      (page.tasks?.includes('CREATE_CONTENT') || page.tasks?.includes('MANAGE'))
    );
    if (!eligiblePages.length) return redirectToSocialMedia(request, 'no_pages', state.clientId);

    let connectedCount = 0;
    for (const page of eligiblePages) {
      const pageId = page.id as string;
      const pageName = page.name?.trim().slice(0, 191) || `Facebook Page ${pageId}`;
      const pageToken = page.access_token as string;
      const instagram = await getInstagramAccount(pageId, pageToken, config.graphVersion);
      const encryptedPageToken = encryptSocialCredential(pageToken);

      await prisma.$transaction(async tx => {
        const connection = await tx.metaConnection.upsert({
          where: { facebookPageId: pageId },
          create: {
            clientId: state.clientId,
            facebookPageId: pageId,
            facebookPageName: pageName,
            pageAccessTokenEncrypted: encryptedPageToken,
            instagramAccountId: instagram?.id ?? null,
            instagramUsername: instagram?.username ?? null,
            connectedById: user.id
          },
          update: {
            clientId: state.clientId,
            facebookPageName: pageName,
            pageAccessTokenEncrypted: encryptedPageToken,
            instagramAccountId: instagram?.id ?? null,
            instagramUsername: instagram?.username ?? null,
            connectedById: user.id,
            connectedAt: new Date()
          },
          select: { id: true }
        });

        await tx.socialAccount.upsert({
          where: { metaConnectionId_platform: { metaConnectionId: connection.id, platform: 'FACEBOOK' } },
          create: {
            clientId: state.clientId,
            platform: 'FACEBOOK',
            displayName: pageName,
            username: pageName,
            profileUrl: `https://www.facebook.com/${pageId}`,
            externalAccountId: pageId,
            metaConnectionId: connection.id,
            createdById: user.id
          },
          update: {
            clientId: state.clientId,
            displayName: pageName,
            username: pageName,
            profileUrl: `https://www.facebook.com/${pageId}`,
            externalAccountId: pageId
          }
        });

        if (instagram) {
          const encodedUsername = encodeURIComponent(instagram.username.replace(/^@/, ''));
          await tx.socialAccount.upsert({
            where: { metaConnectionId_platform: { metaConnectionId: connection.id, platform: 'INSTAGRAM' } },
            create: {
              clientId: state.clientId,
              platform: 'INSTAGRAM',
              displayName: `Instagram @${instagram.username.replace(/^@/, '')}`,
              username: instagram.username,
              profileUrl: `https://www.instagram.com/${encodedUsername}/`,
              externalAccountId: instagram.id,
              metaConnectionId: connection.id,
              createdById: user.id
            },
            update: {
              clientId: state.clientId,
              displayName: `Instagram @${instagram.username.replace(/^@/, '')}`,
              username: instagram.username,
              profileUrl: `https://www.instagram.com/${encodedUsername}/`,
              externalAccountId: instagram.id
            }
          });
        } else {
          await tx.socialAccount.deleteMany({ where: { metaConnectionId: connection.id, platform: 'INSTAGRAM' } });
        }

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'META_CONNECT',
            entity: 'MetaConnection',
            entityId: connection.id,
            metadata: { facebookPageId: pageId, hasInstagram: Boolean(instagram), owner: state.clientId ? 'CLIENT' : 'VIRAL_ZOOM' }
          }
        });
      });
      connectedCount += 1;
    }

    return redirectToSocialMedia(request, `connected_${connectedCount}`, state.clientId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return redirectToSocialMedia(request, 'session_expired');
    if (message === 'FORBIDDEN') return redirectToSocialMedia(request, 'forbidden');
    if (message === 'APP_SESSION_SECRET must contain at least 32 characters to protect social media data') {
      return redirectToSocialMedia(request, 'encryption_not_configured');
    }
    if (message.startsWith('META_API_ERROR:')) {
      const providerMessage = message.slice('META_API_ERROR:'.length).toLowerCase();
      const code = providerMessage.includes('permission') || providerMessage.includes('access') ? 'permissions_missing' : 'provider_error';
      return redirectToSocialMedia(request, code);
    }
    if (message.startsWith('META_')) return redirectToSocialMedia(request, 'setup_error');
    return redirectToSocialMedia(request, 'connection_failed');
  }
}
