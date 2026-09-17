import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { MediaError } from './uploadPolicy';

export const VIDEO_LIMITS = {
  timeoutMs: 90_000,
  outputBytes: 12 * 1024 * 1024,
  longEdge: 1280,
  fps: 30,
  threads: 1,
  childAddressSpaceBytes: 320 * 1024 * 1024,
} as const;

type VideoStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  color_range?: string;
  sample_aspect_ratio?: string;
  avg_frame_rate?: string;
  duration?: string;
  tags?: { DURATION?: string };
  side_data_list?: { rotation?: number }[];
};
type Probe = { streams: VideoStream[]; format: { duration?: string } };
type Options = {
  signal?: AbortSignal;
  timeoutMs?: number;
  tempRoot?: string;
  outputBytes?: number;
};

// Standalone Next runs one Node process. Symbol.for also fences separately bundled routes.
const slotKey = Symbol.for('torchick.hero-video.active');
const slots = globalThis as typeof globalThis & { [slotKey]?: boolean };
const uploadKey = Symbol.for('torchick.hero-video.upload');
const uploads = globalThis as typeof globalThis & { [uploadKey]?: boolean };

export function claimHeroVideoUpload() {
  if (uploads[uploadKey])
    throw new MediaError('מתבצעת הכנת סרטון נוסף. יש לנסות שוב בעוד רגע.', 429);
  uploads[uploadKey] = true;
  return () => {
    uploads[uploadKey] = false;
  };
}

function invalid() {
  return new MediaError('הסרטון אינו תקין או אינו נתמך להכנה. יש לבחור סרטון אחר.', 415);
}

export function videoProcessError(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
): MediaError {
  if (signal || (exitCode === 244 && /\bOut of memory\b/i.test(stderr))) {
    return new MediaError(
      'הסרטון חורג ממגבלת משאבי ההכנה. יש לבחור סרטון קטן יותר.',
      422,
    );
  }
  return invalid();
}

async function command(
  binary: string,
  args: string[],
  signal: AbortSignal,
  stage: 'probe-source' | 'encode' | 'probe-output',
): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const limited = process.platform === 'linux';
    const child = spawn(
      limited ? 'prlimit' : binary,
      limited
        ? [
            `--as=${VIDEO_LIMITS.childAddressSpaceBytes}`,
            '--cpu=75',
            '--',
            binary,
            ...args,
          ]
        : args,
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env, OMP_NUM_THREADS: '1', MALLOC_ARENA_MAX: '2' },
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let diagnosticBytes = 0;
    let bytes = 0;
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill('SIGKILL');
    };
    const abort = () =>
      stop(new MediaError('הכנת הסרטון הופסקה או ארכה זמן רב מדי.', 408));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    child.stdout.on('data', (data: Buffer) => {
      bytes += data.length;
      if (bytes > 1024 * 1024) stop(invalid());
      else stdout.push(data);
    });
    child.stderr.on('data', (data: Buffer) => {
      const bounded = data.subarray(0, Math.max(0, 4096 - diagnosticBytes));
      diagnosticBytes += bounded.length;
      if (bounded.length) stderr.push(Buffer.from(bounded));
    });
    child.on('error', () => {
      failure = new MediaError('הכנת סרטונים אינה זמינה כרגע.', 503);
    });
    child.on('close', (code, childSignal) => {
      signal.removeEventListener('abort', abort);
      if (failure || childSignal || code !== 0) {
        let detail = stripVTControlCharacters(Buffer.concat(stderr).toString('utf8'));
        const error = failure ?? videoProcessError(code, childSignal, detail);
        for (const argument of args.filter(isAbsolute))
          detail = detail.replaceAll(argument, '[media-file]');
        detail = Array.from(detail)
          .filter(
            (char) =>
              char !== '\uFFFD' &&
              (char.charCodeAt(0) >= 32 || char === '\n' || char === '\t'),
          )
          .join('');
        error.cause = {
          stage,
          binary,
          wrapper: limited ? 'prlimit' : null,
          exitCode: code,
          signal: childSignal,
          stderr: Buffer.from(detail)
            .subarray(0, 4096)
            .toString('utf8')
            .replaceAll('\uFFFD', ''),
        };
        reject(error);
      } else resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

const inputOptions = [
  '-v',
  'error',
  '-max_alloc',
  '67108864',
  '-threads',
  '1',
  '-protocol_whitelist',
  'file',
  '-format_whitelist',
  'mov,matroska,webm',
  '-probesize',
  '5242880',
  '-analyzeduration',
  '5000000',
];

async function probe(
  path: string,
  signal: AbortSignal,
  stage: 'probe-source' | 'probe-output',
): Promise<Probe> {
  const json = await command(
    'ffprobe',
    [
      ...inputOptions,
      '-show_entries',
      'stream=codec_type,codec_name,width,height,pix_fmt,color_space,color_transfer,color_primaries,color_range,sample_aspect_ratio,avg_frame_rate,duration:stream_tags=DURATION:stream_side_data=rotation:format=duration',
      '-of',
      'json',
      path,
    ],
    signal,
    stage,
  );
  const value: Probe = JSON.parse(json);
  if (!Array.isArray(value.streams) || !value.format) throw invalid();
  return value;
}

function ratio(value: string | undefined, separator: string): number {
  const [a, b] = (value ?? '').split(separator).map(Number);
  return a > 0 && b > 0 ? a / b : NaN;
}

export function videoEncodingPlan(source: Probe) {
  const video = source.streams.find((stream) => stream.codec_type === 'video');
  const durationTag = video?.tags?.DURATION;
  const match = durationTag?.match(/^(\d{2,}):([0-5]\d):([0-5]\d(?:\.\d+)?)$/);
  const taggedDuration = match
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : undefined;
  const duration = Number(video?.duration ?? taggedDuration ?? source.format.duration);
  if (!video?.width || !video.height || !Number.isFinite(duration) || duration <= 0)
    throw invalid();
  const rotation =
    video.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? 0;
  if (rotation % 90 !== 0) throw invalid();
  const sar = ratio(video.sample_aspect_ratio, ':');
  const aspect = Number.isFinite(sar) ? sar : 1;
  let width = video.width * aspect;
  let height = video.height;
  const scale = Math.min(1, 1 / aspect, VIDEO_LIMITS.longEdge / Math.max(width, height));
  width = Math.floor((width * scale) / 2) * 2;
  height = Math.floor((height * scale) / 2) * 2;
  if (Math.abs(rotation % 180) === 90) [width, height] = [height, width];
  if (width < 2 || height < 2) throw invalid();
  const inputFps = ratio(video.avg_frame_rate, '/');
  if (!Number.isFinite(inputFps)) throw invalid();
  const fps = Math.min(VIDEO_LIMITS.fps, inputFps);
  const hdr =
    video.color_transfer === 'smpte2084' || video.color_transfer === 'arib-std-b67';
  let color: string;
  if (hdr) {
    if (video.color_primaries !== 'bt2020' || video.color_space !== 'bt2020nc')
      throw invalid();
    color = [
      `zscale=pin=bt2020:tin=${video.color_transfer}:min=bt2020nc:rin=${video.color_range === 'pc' ? 'pc' : 'tv'}:p=bt2020:t=linear:m=gbr:npl=100`,
      'format=gbrpf32le',
      'zscale=p=bt709',
      'tonemap=tonemap=hable:desat=0',
      'zscale=t=bt709:m=bt709:r=tv',
      'format=yuv420p',
    ].join(',');
  } else {
    // Untagged conventional SDR is assumed BT.709; unknown high-bit-depth color fails closed.
    if (
      (!video.color_transfer || video.color_transfer === 'unknown') &&
      /(?:10|12|16)/.test(video.pix_fmt ?? '')
    )
      throw invalid();
    const primaries =
      video.color_primaries && video.color_primaries !== 'unknown'
        ? video.color_primaries
        : 'bt709';
    const transfer =
      video.color_transfer && video.color_transfer !== 'unknown'
        ? video.color_transfer
        : 'bt709';
    const matrix =
      video.color_space && video.color_space !== 'unknown' ? video.color_space : 'bt709';
    color = `zscale=pin=${primaries}:tin=${transfer}:min=${matrix}:rin=${video.color_range === 'pc' ? 'pc' : 'tv'}:p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p`;
  }
  return {
    width,
    height,
    fps,
    duration,
    filter: `fps=${fps},scale=${width}:${height},setsar=1,${color}`,
  };
}

export function hasFastStart(input: Buffer): boolean {
  let offset = 0;
  let moov = false;
  while (offset + 8 <= input.length) {
    const size32 = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    if (size32 === 1 && offset + 16 > input.length) return false;
    const size = size32 === 1 ? Number(input.readBigUInt64BE(offset + 8)) : size32;
    if (
      !Number.isSafeInteger(size) ||
      size < (size32 === 1 ? 16 : 8) ||
      offset + size > input.length
    )
      return false;
    if (type === 'moov') moov = true;
    if (type === 'mdat') return moov;
    offset += size;
  }
  return false;
}

export async function prepareHeroVideo(
  input: Buffer,
  options: Options = {},
): Promise<Buffer> {
  if (slots[slotKey])
    throw new MediaError('מתבצעת הכנת סרטון נוסף. יש לנסות שוב בעוד רגע.', 429);
  slots[slotKey] = true;
  let directory: string | undefined;
  const deadline = AbortSignal.timeout(options.timeoutMs ?? VIDEO_LIMITS.timeoutMs);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const outputBytes = Math.min(
    options.outputBytes ?? VIDEO_LIMITS.outputBytes,
    VIDEO_LIMITS.outputBytes,
  );
  try {
    if (signal.aborted) throw new MediaError('הכנת הסרטון הופסקה.', 408);
    directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'torchick-video-'));
    const source = join(directory, 'source');
    const target = join(directory, 'ready.mp4');
    await writeFile(source, input, { mode: 0o600, signal });
    const plan = videoEncodingPlan(await probe(source, signal, 'probe-source'));
    await command(
      'ffmpeg',
      [
        ...inputOptions,
        '-nostdin',
        '-xerror',
        '-filter_threads',
        '1',
        '-i',
        source,
        '-map',
        '0:v:0',
        '-an',
        '-sn',
        '-dn',
        '-map_metadata',
        '-1',
        '-vf',
        plan.filter,
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-preset',
        'ultrafast',
        '-crf',
        '25',
        '-maxrate',
        '1600k',
        '-bufsize',
        '3200k',
        '-pix_fmt',
        'yuv420p',
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
        '-colorspace',
        'bt709',
        '-color_range',
        'tv',
        '-movflags',
        '+faststart',
        '-fs',
        String(outputBytes),
        '-y',
        target,
      ],
      signal,
      'encode',
    );
    const size = (await stat(target)).size;
    // FFmpeg's -fs can exit successfully after truncation. Never publish a capped encode.
    if (size >= outputBytes || size < 32)
      throw new MediaError('הסרטון חורג ממגבלת ההכנה. יש לבחור סרטון קטן יותר.', 413);
    const output = await probe(target, signal, 'probe-output');
    const video = output.streams[0];
    if (
      output.streams.length !== 1 ||
      video?.codec_name !== 'h264' ||
      video.pix_fmt !== 'yuv420p' ||
      video.width !== plan.width ||
      video.height !== plan.height ||
      video.color_primaries !== 'bt709' ||
      video.color_transfer !== 'bt709' ||
      video.color_space !== 'bt709' ||
      video.color_range !== 'tv' ||
      ratio(video.avg_frame_rate, '/') > 30 ||
      !Number.isFinite(Number(output.format.duration)) ||
      Math.abs(Number(output.format.duration) - plan.duration) >
        Math.max(0.1, 2 / plan.fps)
    )
      throw invalid();
    const ready = await readFile(target, { signal });
    if (!hasFastStart(ready)) throw invalid();
    return ready;
  } catch (error) {
    if (signal.aborted)
      throw new MediaError('הכנת הסרטון הופסקה או ארכה זמן רב מדי.', 408);
    throw error;
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      slots[slotKey] = false;
    }
  }
}
