export type VideoStatus = 'PROCESSING' | 'READY' | 'FAILED';

export function deriveVideoStatus(
  uploadStatus?: string | null,
  transcodeStatus?: string | null,
  duration?: number | null,
  playbackUrl?: string | null,
): VideoStatus {
  const normalizedUploadStatus = String(uploadStatus || '').toLowerCase();
  const normalizedTranscodeStatus = String(transcodeStatus || '').toLowerCase();
  const safeDuration = Number(duration ?? 0);
  const hasPlayableDuration = Number.isFinite(safeDuration) && safeDuration > 0;
  const hasPlaybackUrl = typeof playbackUrl === 'string' && playbackUrl.length > 0;

  if (normalizedUploadStatus === 'error' || normalizedTranscodeStatus === 'error') {
    return 'FAILED';
  }

  if (normalizedUploadStatus === 'complete' && normalizedTranscodeStatus === 'complete' && hasPlayableDuration && hasPlaybackUrl) {
    return 'READY';
  }

  return 'PROCESSING';
}

export function isVideoReadyForPlayback(video?: { status?: string | null; duration?: number | null; playbackUrl?: string | null } | null) {
  return video?.status === 'READY' && Number(video.duration ?? 0) > 0 && Boolean(video.playbackUrl);
}
