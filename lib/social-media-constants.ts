export const SOCIAL_PLATFORMS = {
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'إنستغرام',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  X: 'X',
  SNAPCHAT: 'Snapchat',
  THREADS: 'Threads',
  OTHER: 'منصة أخرى'
} as const;

export type SocialPlatformKey = keyof typeof SOCIAL_PLATFORMS;
export const SOCIAL_PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS) as SocialPlatformKey[];

export const SOCIAL_POST_STATUS_LABELS = {
  SCHEDULED: 'مجدول',
  PUBLISHED: 'تم النشر',
  CANCELLED: 'ملغي'
} as const;
