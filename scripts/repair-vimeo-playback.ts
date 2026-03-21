import process from 'process';
import postgres from 'postgres';
import 'dotenv/config';
import { vimeoService } from '../src/services/vimeo.service.js';
import { deriveVideoStatus, type VideoStatus } from '../src/features/courses/video-status.js';

type VideoRow = {
  id: number;
  name: string | null;
  provider: string;
  resource_id: string;
  duration: number | null;
  playback_url: string | null;
  status: VideoStatus;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString);

function shouldMarkVideoFailed(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; statusCode?: number };
  return candidate.code === 'VIMEO_METADATA_FAILED'
    || candidate.code === 'VIMEO_RESOLVE_FAILED'
    || candidate.code === 'VIMEO_INVALID_URL'
    || candidate.code === 'VIMEO_PRIVACY_UPDATE_FAILED'
    || candidate.code === 'VIMEO_EMBED_DOMAIN_FAILED'
    || candidate.statusCode === 403
    || candidate.statusCode === 404;
}

async function updateVideoRow(
  videoId: number,
  status: VideoStatus,
  extra?: { duration?: number | null; name?: string | null; playbackUrl?: string | null },
) {
  await sql`
    update videos
    set
      status = ${status},
      duration = ${extra?.duration ?? null},
      name = ${extra?.name ?? null},
      playback_url = ${extra?.playbackUrl ?? null},
      updated_at = now()
    where id = ${videoId}
  `;
}

async function main() {
  const videos = await sql<VideoRow[]>`
    select id, name, provider, resource_id, duration, playback_url, status
    from videos
    where provider = 'VIMEO'
    order by id asc
  `;

  if (videos.length === 0) {
    console.log('No Vimeo videos found.');
    return;
  }

  let readyCount = 0;
  let processingCount = 0;
  let failedCount = 0;

  for (const video of videos) {
    try {
      const metadata = await vimeoService.getVideoMetadata(video.resource_id);
      const nextStatus = deriveVideoStatus(
        metadata.uploadStatus,
        metadata.transcodeStatus,
        metadata.duration,
        metadata.playbackUrl,
      );

      if (nextStatus !== 'FAILED') {
        await vimeoService.ensureEmbedDomains(video.resource_id);
      }

      await updateVideoRow(video.id, nextStatus, {
        duration: metadata.duration ?? video.duration,
        name: metadata.name ?? video.name,
        playbackUrl: metadata.playbackUrl ?? video.playback_url,
      });

      if (nextStatus === 'READY') {
        readyCount += 1;
      } else if (nextStatus === 'PROCESSING') {
        processingCount += 1;
      } else {
        failedCount += 1;
      }

      console.log(
        `[video:${video.id}] ${video.resource_id} -> ${nextStatus} (duration=${metadata.duration ?? 0}, playbackUrl=${metadata.playbackUrl ? 'yes' : 'no'})`,
      );
    } catch (error) {
      const nextStatus: VideoStatus = shouldMarkVideoFailed(error) ? 'FAILED' : 'PROCESSING';
      await updateVideoRow(video.id, nextStatus, {
        duration: video.duration,
        name: video.name,
        playbackUrl: video.playback_url,
      });

      if (nextStatus === 'FAILED') {
        failedCount += 1;
      } else {
        processingCount += 1;
      }

      console.error(`[video:${video.id}] ${video.resource_id} -> ${nextStatus}`, error);
    }
  }

  console.log(`Repair completed. READY=${readyCount}, PROCESSING=${processingCount}, FAILED=${failedCount}`);
}

main()
  .catch((error) => {
    console.error('repair-vimeo-playback failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
