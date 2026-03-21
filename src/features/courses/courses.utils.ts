const EXTERNAL_IMAGE_PATTERN = /^(https?:\/\/|data:|blob:)/i;
const DATA_URI_PATTERN = /^data:([^;]+);base64,(.+)$/i;
const BASE64_PATTERN = /^[A-Za-z0-9+/=\r\n]+$/;

const DEFAULT_IMAGE_MIME = 'image/jpeg';
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

// Thumbnail storage remains DB-backed in this phase:
// we store raw base64 in `courses.thumbnail` and MIME type in `courses.thumbnail_mime_type`,
// then reconstruct a data URI only when returning course payloads to clients.

function sanitizeBase64(value: string): string {
  return value.replace(/\s+/g, '');
}

function getNormalizedMimeType(mimeType?: string | null): string {
  if (!mimeType || typeof mimeType !== 'string') {
    return DEFAULT_IMAGE_MIME;
  }

  const normalized = mimeType.trim().toLowerCase();
  return normalized || DEFAULT_IMAGE_MIME;
}

function isLikelyRawBase64(value: string): boolean {
  const sanitized = sanitizeBase64(value);
  return sanitized.length > 32 && BASE64_PATTERN.test(sanitized);
}

export function normalizeThumbnailForResponse(
  thumbnail?: string | null,
  thumbnailMimeType?: string | null
): string | null {
  if (!thumbnail || typeof thumbnail !== 'string') {
    return null;
  }

  const normalized = thumbnail.trim();
  if (!normalized) {
    return null;
  }

  if (EXTERNAL_IMAGE_PATTERN.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  if (!isLikelyRawBase64(normalized)) {
    return normalized;
  }

  const mimeType = getNormalizedMimeType(thumbnailMimeType);
  return `data:${mimeType};base64,${sanitizeBase64(normalized)}`;
}

export function normalizeCourseThumbnail<T extends { thumbnail?: string | null; thumbnailMimeType?: string | null }>(
  course: T
): T {
  return {
    ...course,
    thumbnail: normalizeThumbnailForResponse(course.thumbnail, course.thumbnailMimeType),
  };
}

export function normalizeThumbnailForStorage<
  T extends { thumbnail?: string | null; thumbnailMimeType?: string | null }
>(payload: T): T {
  if (!payload.thumbnail || typeof payload.thumbnail !== 'string') {
    return payload;
  }

  const normalized = payload.thumbnail.trim();
  if (!normalized) {
    return {
      ...payload,
      thumbnail: null,
    };
  }

  const dataUriMatch = normalized.match(DATA_URI_PATTERN);
  if (!dataUriMatch) {
    return {
      ...payload,
      thumbnail: normalized,
    };
  }

  const [, dataUriMimeType, dataUriBase64Payload] = dataUriMatch;
  return {
    ...payload,
    thumbnail: sanitizeBase64(dataUriBase64Payload),
    thumbnailMimeType: getNormalizedMimeType(payload.thumbnailMimeType || dataUriMimeType),
  };
}

function estimateBinaryBytes(base64Payload: string): number {
  const sanitized = sanitizeBase64(base64Payload);
  if (!sanitized) {
    return 0;
  }

  const paddingMatch = sanitized.match(/=+$/);
  const paddingLength = paddingMatch ? paddingMatch[0].length : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - paddingLength);
}

function extractBase64Payload(thumbnail: string): string | null {
  const normalized = thumbnail.trim();
  if (!normalized) {
    return null;
  }

  if (EXTERNAL_IMAGE_PATTERN.test(normalized) && !normalized.startsWith('data:')) {
    return null;
  }

  const dataUriMatch = normalized.match(DATA_URI_PATTERN);
  if (dataUriMatch) {
    return dataUriMatch[2];
  }

  if (isLikelyRawBase64(normalized)) {
    return normalized;
  }

  return null;
}

export function validateThumbnailSizeLimit(
  thumbnail?: string | null,
  maxBytes: number = MAX_THUMBNAIL_BYTES
): void {
  if (!thumbnail || typeof thumbnail !== 'string') {
    return;
  }

  const payload = extractBase64Payload(thumbnail);
  if (!payload) {
    return;
  }

  const bytes = estimateBinaryBytes(payload);
  if (bytes <= maxBytes) {
    return;
  }

  throw Object.assign(new Error('ไฟล์รูปต้องไม่เกิน 5MB'), {
    statusCode: 413,
  });
}
