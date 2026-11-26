import type { Role } from '@prisma/client';

export function isSocialMediaDepartment(name: string | null | undefined) {
  const departmentName = name?.toLowerCase().trim() ?? '';
  return (departmentName.includes('social') && departmentName.includes('media')) || departmentName.includes('سوشيال') || departmentName.includes('التواصل الاجتماعي');
}

export function canAccessSocialMedia(role: Role, departmentName: string | null | undefined) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || isSocialMediaDepartment(departmentName);
}
