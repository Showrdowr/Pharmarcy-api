export type CourseAudience = 'all' | 'general' | 'pharmacist';
export type CourseViewerRole = 'guest' | 'general' | 'pharmacist' | 'admin';

export type CourseAccessUser =
  | {
      role?: string | null;
      isAdmin?: boolean | null;
    }
  | null
  | undefined;

export function normalizeCourseAudience(value?: string | null): CourseAudience {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';

  switch (normalized) {
    case 'general':
    case 'pharmacist':
      return normalized;
    default:
      return 'all';
  }
}

export function resolveCourseViewerRole(user?: CourseAccessUser): CourseViewerRole {
  if (user?.isAdmin) {
    return 'admin';
  }

  const normalizedRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
  if (normalizedRole === 'pharmacist') {
    return 'pharmacist';
  }

  if (normalizedRole === 'member' || normalizedRole === 'general') {
    return 'general';
  }

  return 'guest';
}

export function canViewerSeeCourse(audience: string | null | undefined, viewerRole: CourseViewerRole): boolean {
  const normalizedAudience = normalizeCourseAudience(audience);

  if (viewerRole === 'admin' || viewerRole === 'pharmacist' || viewerRole === 'guest') {
    return true;
  }

  return normalizedAudience !== 'pharmacist';
}

export function canViewerAccessCourse(audience: string | null | undefined, viewerRole: CourseViewerRole): boolean {
  if (viewerRole === 'guest') {
    return false;
  }

  return canViewerSeeCourse(audience, viewerRole);
}
