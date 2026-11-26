import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SocialMediaWorkspace } from '@/components/social-media-workspace';
import { getCurrentUser } from '@/lib/auth';
import { canAccessSocialMedia } from '@/lib/social-media-access';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function cairoDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cairoLocalDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export default async function SocialMediaPage({ searchParams }: { searchParams: Promise<{ clientId?: string; meta?: string; meta_error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessSocialMedia(user.role, user.departmentName)) redirect('/notifications');
  const query = await searchParams;
  const [clients, accounts, posts] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.socialAccount.findMany({
      orderBy: [{ client: { name: 'asc' } }, { platform: 'asc' }, { displayName: 'asc' }],
      take: 1000,
      select: {
        id: true,
        clientId: true,
        platform: true,
        displayName: true,
        username: true,
        profileUrl: true,
        notes: true,
        metaConnectionId: true,
        client: { select: { id: true, name: true } }
      }
    }),
    prisma.socialPost.findMany({
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
      select: {
        id: true,
        clientId: true,
        accountId: true,
        platform: true,
        title: true,
        content: true,
        scheduledAt: true,
        status: true,
        publishedAt: true,
        publishingAt: true,
        externalPostId: true,
        publishError: true,
        media: true,
        client: { select: { id: true, name: true } },
        account: { select: { id: true, displayName: true, username: true, platform: true, metaConnectionId: true } }
      }
    })
  ]);

  const requestedClientId = query.clientId && query.clientId !== 'company' ? query.clientId : null;
  const initialOwnerClientId = requestedClientId && clients.some(client => client.id === requestedClientId) ? requestedClientId : null;
  const now = new Date();
  const metaConfigured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_CONFIG_ID && process.env.META_REDIRECT_URI);
  const publicMediaReady = Boolean(process.env.META_APP_URL?.startsWith('https://'));

  return <AppShell user={user}><SocialMediaWorkspace
    clients={clients}
    accounts={accounts.map(account => ({ ...account, platform: account.platform, metaConnectionId: account.metaConnectionId }))}
    posts={posts.map(post => ({ ...post, scheduledAt: post.scheduledAt.toISOString(), publishedAt: post.publishedAt?.toISOString() ?? null, publishingAt: post.publishingAt?.toISOString() ?? null }))}
    initialOwnerClientId={initialOwnerClientId}
    initialToday={cairoDateKey(now)}
    defaultScheduledAt={cairoLocalDateTime(new Date(now.getTime() + 60 * 60 * 1000))}
    metaConfigured={metaConfigured}
    publicMediaReady={publicMediaReady}
    meta={query.meta ?? null}
    metaError={query.meta_error ?? null}
  /></AppShell>;
}
