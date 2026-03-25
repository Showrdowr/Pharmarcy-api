import { describe, expect, it } from 'vitest';
import {
  canViewerAccessCourse,
  canViewerSeeCourse,
  normalizeCourseAudience,
  resolveCourseViewerRole,
} from './course-audience.js';

describe('course audience helpers', () => {
  it('normalizes unknown audience values to all', () => {
    expect(normalizeCourseAudience(undefined)).toBe('all');
    expect(normalizeCourseAudience('')).toBe('all');
    expect(normalizeCourseAudience('unexpected')).toBe('all');
  });

  it('resolves viewer roles from learner and pharmacist accounts', () => {
    expect(resolveCourseViewerRole(undefined)).toBe('guest');
    expect(resolveCourseViewerRole({ role: 'member' })).toBe('general');
    expect(resolveCourseViewerRole({ role: 'general' })).toBe('general');
    expect(resolveCourseViewerRole({ role: 'pharmacist' })).toBe('pharmacist');
    expect(resolveCourseViewerRole({ role: 'admin', isAdmin: true })).toBe('admin');
  });

  it('allows guests to see all public courses but not access protected learning flows', () => {
    expect(canViewerSeeCourse('pharmacist', 'guest')).toBe(true);
    expect(canViewerAccessCourse('all', 'guest')).toBe(false);
  });

  it('hides pharmacist-only courses from general users', () => {
    expect(canViewerSeeCourse('all', 'general')).toBe(true);
    expect(canViewerSeeCourse('general', 'general')).toBe(true);
    expect(canViewerSeeCourse('pharmacist', 'general')).toBe(false);
    expect(canViewerAccessCourse('pharmacist', 'general')).toBe(false);
  });

  it('keeps all courses visible and accessible for pharmacists', () => {
    expect(canViewerSeeCourse('all', 'pharmacist')).toBe(true);
    expect(canViewerSeeCourse('pharmacist', 'pharmacist')).toBe(true);
    expect(canViewerAccessCourse('pharmacist', 'pharmacist')).toBe(true);
  });
});
