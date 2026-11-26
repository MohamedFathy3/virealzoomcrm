import { getCurrentUser } from '@/lib/auth';
import { canAccessSocialMedia } from '@/lib/social-media-access';

export async function requireSocialMediaUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!canAccessSocialMedia(user.role, user.departmentName)) throw new Error('FORBIDDEN');
  return user;
}
