import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  getVideoByResourceId: vi.fn(),
  createVideo: vi.fn(),
  getVideoWithUsage: vi.fn(),
  updateVideoStatus: vi.fn(),
  getVideoById: vi.fn(),
}));

const vimeoMocks = vi.hoisted(() => ({
  initiateTusUpload: vi.fn(),
  waitForVideoMetadata: vi.fn(),
  ensureEmbedDomains: vi.fn(),
  deleteVideo: vi.fn(),
  resolveVideo: vi.fn(),
  getVideoMetadata: vi.fn(),
  parseVimeoUrl: vi.fn(),
}));

vi.mock('./courses.repository.js', () => ({
  coursesRepository: repositoryMocks,
}));

vi.mock('../audit-logs/audit-logs.service.js', () => ({
  auditLogsService: {
    recordAction: vi.fn(),
  },
}));

vi.mock('../../services/vimeo.service.js', () => ({
  vimeoService: vimeoMocks,
}));

import { coursesService } from './courses.service.js';

function buildForbiddenPrivacyError() {
  return Object.assign(new Error("The user isn't allowed to perform that action."), {
    statusCode: 403,
    code: 'VIMEO_PRIVACY_UPDATE_FAILED',
  });
}

describe('coursesService Vimeo import ownership fallback', () => {
  beforeEach(() => {
    repositoryMocks.getVideoByResourceId.mockReset();
    repositoryMocks.createVideo.mockReset();
    repositoryMocks.getVideoWithUsage.mockReset();
    repositoryMocks.updateVideoStatus.mockReset();
    repositoryMocks.getVideoById.mockReset();

    vimeoMocks.ensureEmbedDomains.mockReset();
    vimeoMocks.resolveVideo.mockReset();
    vimeoMocks.getVideoMetadata.mockReset();
    vimeoMocks.parseVimeoUrl.mockReset();
  });

  it('imports an existing Vimeo video when playback is already public even if privacy update is forbidden', async () => {
    repositoryMocks.getVideoByResourceId.mockResolvedValue(null);
    repositoryMocks.createVideo.mockResolvedValue({
      id: 71,
      name: 'Legacy Vimeo',
      provider: 'VIMEO',
      resourceId: '1158427919',
      duration: 90,
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
      status: 'READY',
    });
    repositoryMocks.getVideoWithUsage.mockResolvedValue({
      id: 71,
      name: 'Legacy Vimeo',
      provider: 'VIMEO',
      resourceId: '1158427919',
      duration: 90,
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
      status: 'READY',
      usage: {
        previewCourseCount: 0,
        lessonUsageCount: 0,
        totalUsageCount: 0,
      },
    });

    vimeoMocks.parseVimeoUrl.mockReturnValue('1158427919');
    vimeoMocks.resolveVideo.mockResolvedValue({
      resourceId: '1158427919',
      videoUri: '/videos/1158427919',
      name: 'Legacy Vimeo',
      duration: 90,
      sourceUrl: 'https://vimeo.com/1158427919',
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
      privacyView: 'anybody',
      privacyEmbed: 'public',
      uploadStatus: 'complete',
      transcodeStatus: 'complete',
    });
    vimeoMocks.ensureEmbedDomains.mockRejectedValue(buildForbiddenPrivacyError());

    const video = await coursesService.importVimeoVideo({
      resourceId: '1158427919',
    });

    expect(vimeoMocks.ensureEmbedDomains).toHaveBeenCalledWith('1158427919');
    expect(repositoryMocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'VIMEO',
      resourceId: '1158427919',
      status: 'READY',
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
    }));
    expect(video).toMatchObject({
      id: 71,
      resourceId: '1158427919',
      status: 'READY',
    });
  });

  it('keeps sync-status successful for public legacy Vimeo videos even if privacy update is forbidden', async () => {
    repositoryMocks.getVideoById.mockResolvedValue({
      id: 71,
      name: 'Legacy Vimeo',
      provider: 'VIMEO',
      resourceId: '1158427919',
      duration: 90,
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
      status: 'READY',
    });
    repositoryMocks.updateVideoStatus.mockResolvedValue({
      id: 71,
      status: 'READY',
    });
    repositoryMocks.getVideoWithUsage.mockResolvedValue({
      id: 71,
      name: 'Legacy Vimeo',
      provider: 'VIMEO',
      resourceId: '1158427919',
      duration: 90,
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
      status: 'READY',
      usage: {
        previewCourseCount: 0,
        lessonUsageCount: 0,
        totalUsageCount: 0,
      },
    });

    vimeoMocks.getVideoMetadata.mockResolvedValue({
      resourceId: '1158427919',
      videoUri: '/videos/1158427919',
      name: 'Legacy Vimeo',
      duration: 90,
      sourceUrl: 'https://vimeo.com/1158427919',
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
      privacyView: 'anybody',
      privacyEmbed: 'public',
      uploadStatus: 'complete',
      transcodeStatus: 'complete',
    });
    vimeoMocks.ensureEmbedDomains.mockRejectedValue(buildForbiddenPrivacyError());

    const video = await coursesService.syncVideoStatus(71);

    expect(vimeoMocks.ensureEmbedDomains).toHaveBeenCalledWith('1158427919');
    expect(repositoryMocks.updateVideoStatus).toHaveBeenCalledWith(71, 'READY', expect.objectContaining({
      playbackUrl: 'https://player.vimeo.com/video/1158427919?h=abc',
    }));
    expect(video).toMatchObject({
      id: 71,
      status: 'READY',
    });
  });

  it('still rejects import when the legacy Vimeo video is not publicly embeddable', async () => {
    repositoryMocks.getVideoByResourceId.mockResolvedValue(null);
    repositoryMocks.createVideo.mockResolvedValue({
      id: 72,
      name: 'Locked Vimeo',
      provider: 'VIMEO',
      resourceId: '2288',
      duration: 0,
      status: 'FAILED',
    });

    vimeoMocks.parseVimeoUrl.mockReturnValue('2288');
    vimeoMocks.resolveVideo.mockResolvedValue({
      resourceId: '2288',
      videoUri: '/videos/2288',
      name: 'Locked Vimeo',
      duration: 90,
      sourceUrl: 'https://vimeo.com/2288',
      playbackUrl: 'https://player.vimeo.com/video/2288?h=def',
      privacyView: 'anybody',
      privacyEmbed: 'whitelist',
      uploadStatus: 'complete',
      transcodeStatus: 'complete',
    });
    vimeoMocks.ensureEmbedDomains.mockRejectedValue(buildForbiddenPrivacyError());

    await expect(coursesService.importVimeoVideo({
      resourceId: '2288',
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'VIMEO_PRIVACY_UPDATE_FAILED',
    });
  });
});
