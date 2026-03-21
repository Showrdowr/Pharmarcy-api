import { Vimeo } from '@vimeo/vimeo';
import { env } from '../config/env.js';

type VimeoUploadResponse = {
  uri?: string;
  name?: string;
  upload?: {
    approach?: string;
    upload_link?: string;
    status?: string;
  };
};

type VimeoVideoResponse = {
  uri?: string;
  name?: string;
  duration?: number | null;
  link?: string | null;
  player_embed_url?: string | null;
  privacy?: {
    view?: string | null;
    embed?: string | null;
  };
  upload?: {
    approach?: string | null;
    status?: string | null;
  };
  transcode?: {
    status?: string | null;
  };
};

type VimeoSdkHeaders = Record<string, string | string[] | undefined>;

function buildVimeoError(message: string, statusCode = 502, code = 'VIMEO_REQUEST_FAILED') {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function ensureConfigured() {
  if (!env.VIMEO_ACCESS_TOKEN) {
    throw buildVimeoError('Vimeo ยังไม่ได้ตั้งค่า access token', 503, 'VIMEO_NOT_CONFIGURED');
  }
}

function getVimeoClient() {
  ensureConfigured();
  return new Vimeo('', '', env.VIMEO_ACCESS_TOKEN);
}

function normalizeVimeoFailure(error: unknown, fallbackMessage: string, fallbackCode = 'VIMEO_REQUEST_FAILED') {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: string; statusCode?: number; code?: string };
    if (candidate.code && candidate.statusCode) {
      return buildVimeoError(candidate.message || fallbackMessage, candidate.statusCode, candidate.code);
    }

    if (typeof candidate.message === 'string') {
      const statusCode = candidate.message.includes('404') ? 404 : 502;
      return buildVimeoError(candidate.message || fallbackMessage, statusCode, fallbackCode);
    }
  }

  return buildVimeoError(fallbackMessage, 502, fallbackCode);
}

function extractResourceId(uriOrId?: string | null) {
  if (!uriOrId) {
    return null;
  }

  if (uriOrId.startsWith('/videos/')) {
    return uriOrId.split('/').pop() || null;
  }

  if (/^\d+$/.test(uriOrId)) {
    return uriOrId;
  }

  return parseVimeoUrl(uriOrId) || uriOrId;
}

function parseVimeoUrl(input: string): string | null {
  const patterns = [
    /vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/channels\/[^/]+\/(\d+)/,
    /vimeo\.com\/groups\/[^/]+\/videos\/(\d+)/,
    /vimeo\.com\/showcase\/[^/]+\/video\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function requestVimeo<T>(
  options: string | { path: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; query?: unknown; headers?: Record<string, string> },
  fallbackMessage: string,
  fallbackCode = 'VIMEO_REQUEST_FAILED'
): Promise<{ body: T; statusCode: number; headers: VimeoSdkHeaders }> {
  const client = getVimeoClient();

  try {
    return await new Promise((resolve, reject) => {
      client.request(options, (error, body, statusCode, headers) => {
        if (error) {
          reject({
            error,
            statusCode,
            headers,
          });
          return;
        }

        resolve({
          body: body as T,
          statusCode,
          headers,
        });
      });
    });
  } catch (rawError) {
    if (rawError && typeof rawError === 'object') {
      const candidate = rawError as { error?: Error; statusCode?: number; headers?: VimeoSdkHeaders };
      const message = candidate.error?.message || fallbackMessage;
      const code = fallbackCode;
      const statusCode = candidate.statusCode === 404 ? 404 : candidate.statusCode === 401 || candidate.statusCode === 403 ? 403 : 502;
      throw buildVimeoError(message, statusCode, code);
    }

    throw normalizeVimeoFailure(rawError, fallbackMessage, fallbackCode);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getAllowedEmbedOrigins(): string[] {
  const raw = env.VIMEO_ALLOWED_EMBED_ORIGINS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getEmbedPrivacyMode() {
  return env.NODE_ENV === 'production' ? 'whitelist' : 'public';
}

function ensureEmbedOriginsConfigured() {
  const origins = getAllowedEmbedOrigins();
  if (getEmbedPrivacyMode() === 'whitelist' && origins.length === 0) {
    throw buildVimeoError('Vimeo ยังไม่ได้ตั้งค่า allowed embed origins สำหรับโดเมนของระบบ', 503, 'VIMEO_EMBED_ORIGINS_NOT_CONFIGURED');
  }

  return origins;
}

function normalizeEmbedDomain(origin: string) {
  try {
    const parsed = new URL(origin);
    return parsed.hostname;
  } catch {
    return origin
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  }
}

async function updateVideoPlaybackPrivacy(resourceId: string) {
  const embedMode = getEmbedPrivacyMode();
  await requestVimeo<Record<string, never>>({
    path: `/videos/${resourceId}`,
    method: 'PATCH',
    query: {
      privacy: {
        view: 'unlisted',
        embed: embedMode,
      },
      embed: {
        buttons: { like: false, share: false, watchlater: false },
      },
    },
  }, 'ไม่สามารถตั้งค่า privacy ของวิดีโอ Vimeo ได้', 'VIMEO_PRIVACY_UPDATE_FAILED');
}

async function setEmbedDomains(resourceId: string) {
  await updateVideoPlaybackPrivacy(resourceId);

  if (getEmbedPrivacyMode() !== 'whitelist') {
    return;
  }

  const origins = ensureEmbedOriginsConfigured();
  const failedDomains: string[] = [];

  for (const origin of origins) {
    try {
      const domain = normalizeEmbedDomain(origin);
      if (!domain) {
        continue;
      }

      await requestVimeo<Record<string, never>>({
        path: `/videos/${resourceId}/privacy/domains/${domain}`,
        method: 'PUT',
      }, `ไม่สามารถเพิ่ม embed domain ${domain} ได้`, 'VIMEO_EMBED_DOMAIN_FAILED');
    } catch {
      failedDomains.push(origin);
    }
  }

  if (failedDomains.length > 0) {
    throw buildVimeoError(
      `ไม่สามารถตั้งค่าโดเมนสำหรับฝังวิดีโอ Vimeo ได้: ${failedDomains.join(', ')}`,
      502,
      'VIMEO_EMBED_DOMAIN_FAILED'
    );
  }
}

export const vimeoService = {
  async initiateTusUpload(params: { fileName: string; fileSize: number }) {
    ensureEmbedOriginsConfigured();

    const response = await requestVimeo<VimeoUploadResponse>({
      path: '/me/videos',
      method: 'POST',
      query: {
        name: params.fileName,
        upload: {
          approach: 'tus',
          size: String(params.fileSize),
        },
        privacy: {
          view: 'unlisted',
          embed: getEmbedPrivacyMode(),
        },
        embed: {
          buttons: { like: false, share: false, watchlater: false },
        },
      },
    }, 'ไม่สามารถเริ่มต้นอัปโหลดวิดีโอไปยัง Vimeo ได้', 'VIMEO_INITIATE_FAILED');

    const videoUri = response.body.uri || null;
    const uploadLink = response.body.upload?.upload_link || null;
    const resourceId = extractResourceId(videoUri);

    if (!videoUri || !uploadLink || !resourceId) {
      throw buildVimeoError('Vimeo ไม่ได้ส่ง upload session ที่สมบูรณ์กลับมา', 502, 'VIMEO_INITIATE_FAILED');
    }

    // Add allowed embed domains to the newly created video
    await setEmbedDomains(resourceId);

    return {
      uploadSessionId: `vimeo_${resourceId}_${Date.now()}`,
      resourceId,
      videoUri,
      provider: 'VIMEO' as const,
      uploadStrategy: 'tus' as const,
      uploadLink,
    };
  },

  async getVideoMetadata(resourceIdOrUri: string) {
    const resourceId = extractResourceId(resourceIdOrUri);
    if (!resourceId) {
      throw buildVimeoError('ไม่พบ resourceId ของวิดีโอ Vimeo', 400, 'VIMEO_INVALID_RESOURCE');
    }

    const encodedFields = 'uri,name,duration,link,privacy.view,privacy.embed,upload.status,transcode.status,player_embed_url';
    const response = await requestVimeo<VimeoVideoResponse>({
      path: `/videos/${resourceId}`,
      method: 'GET',
      query: {
        fields: encodedFields,
      },
    }, 'ไม่สามารถดึง metadata จาก Vimeo ได้', 'VIMEO_METADATA_FAILED');

    return {
      resourceId,
      videoUri: response.body.uri || `/videos/${resourceId}`,
      name: response.body.name || null,
      duration: typeof response.body.duration === 'number' ? response.body.duration : null,
      sourceUrl: response.body.link || null,
      playbackUrl: response.body.player_embed_url || null,
      privacyView: response.body.privacy?.view || null,
      privacyEmbed: response.body.privacy?.embed || null,
      uploadStatus: response.body.upload?.status || null,
      transcodeStatus: response.body.transcode?.status || null,
    };
  },

  async waitForVideoMetadata(resourceIdOrUri: string) {
    let lastMetadata: Awaited<ReturnType<typeof vimeoService.getVideoMetadata>> | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      lastMetadata = await this.getVideoMetadata(resourceIdOrUri);
      if (
        lastMetadata.uploadStatus !== 'in_progress' &&
        lastMetadata.uploadStatus !== 'uploading' &&
        lastMetadata.transcodeStatus !== 'in_progress'
      ) {
        return lastMetadata;
      }

      await sleep(1000 * (attempt + 1));
    }

    if (!lastMetadata) {
      throw buildVimeoError('ไม่สามารถดึง metadata จาก Vimeo ได้', 502, 'VIMEO_METADATA_FAILED');
    }

    return lastMetadata;
  },

  parseVimeoUrl(input: string): string | null {
    return parseVimeoUrl(input);
  },

  async resolveVideo(urlOrResourceId: string) {
    const resourceId = extractResourceId(urlOrResourceId);
    if (!resourceId || !/^\d+$/.test(resourceId)) {
      throw buildVimeoError('URL หรือ Video ID ของ Vimeo ไม่ถูกต้อง', 400, 'VIMEO_INVALID_URL');
    }

    try {
      const metadata = await this.getVideoMetadata(resourceId);
      return {
        resourceId: metadata.resourceId,
        videoUri: metadata.videoUri,
        name: metadata.name,
        duration: metadata.duration,
        sourceUrl: metadata.sourceUrl,
        playbackUrl: metadata.playbackUrl,
        privacyView: metadata.privacyView,
        privacyEmbed: metadata.privacyEmbed,
        uploadStatus: metadata.uploadStatus,
        transcodeStatus: metadata.transcodeStatus,
      };
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.message?.includes('404')) {
        throw buildVimeoError('ไม่พบวิดีโอนี้ใน Vimeo หรือ token ไม่มีสิทธิ์เข้าถึง', 404, 'VIMEO_RESOLVE_FAILED');
      }
      throw normalizeVimeoFailure(error, 'ไม่สามารถตรวจสอบวิดีโอจาก Vimeo ได้', 'VIMEO_RESOLVE_FAILED');
    }
  },

  async ensureEmbedDomains(resourceId: string) {
    await setEmbedDomains(resourceId);
  },

  async deleteVideo(resourceIdOrUri: string) {
    if (!env.VIMEO_ACCESS_TOKEN) {
      return;
    }

    const resourceId = extractResourceId(resourceIdOrUri);
    if (!resourceId) {
      return;
    }

    try {
      await requestVimeo<Record<string, never>>({
        path: `/videos/${resourceId}`,
        method: 'DELETE',
      }, 'ลบวิดีโอจาก Vimeo ไม่สำเร็จ', 'VIMEO_DELETE_FAILED');
    } catch (error) {
      const normalized = normalizeVimeoFailure(error, 'ลบวิดีโอจาก Vimeo ไม่สำเร็จ', 'VIMEO_DELETE_FAILED');
      if (normalized.statusCode === 404) {
        return;
      }
      throw normalized;
    }
  },
};
