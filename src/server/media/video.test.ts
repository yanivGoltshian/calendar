import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  prepareHeroVideo,
  hasFastStart,
  videoEncodingPlan,
  videoProcessError,
  VIDEO_LIMITS,
} from './video';
import { createUploadHandler } from './uploadHandler';
import { MediaError } from './uploadPolicy';

test('confirmed decoder ENOMEM is an actionable resource error without reclassifying invalid input', () => {
  const failure = videoProcessError(
    244,
    null,
    '[hevc] Error submitting packet to decoder: Out of memory',
  );
  assert.equal(failure.status, 422);
  assert.match(failure.message, /משאבי/);
  assert.equal(videoProcessError(244, null, 'Invalid data').status, 415);
  assert.equal(videoProcessError(1, null, 'Invalid data').status, 415);
  assert.equal(videoProcessError(null, 'SIGXCPU', '').status, 422);
});

export function syntheticVideo(path: string, hdr = false, seconds = 2) {
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=854x886:rate=60:duration=${seconds}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${seconds}`,
      '-filter_threads',
      '1',
      '-vf',
      hdr ? 'format=yuv420p10le' : 'format=yuv420p',
      '-c:v',
      hdr ? 'libx265' : 'libx264',
      '-threads',
      '1',
      '-preset',
      'ultrafast',
      ...(hdr
        ? [
            '-x265-params',
            'pools=none:frame-threads=1:log-level=error:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc',
          ]
        : []),
      '-c:a',
      'aac',
      '-y',
      path,
    ],
    { timeout: 60_000, stdio: 'pipe' },
  );
}

test('real SDR and HDR inputs become complete muted SDR faststart MP4 with bounded dimensions and frames', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-test-'));
  try {
    for (const hdr of [false, true]) {
      const source = join(root, `source-${hdr}.mov`);
      syntheticVideo(source, hdr);
      const input = await readFile(source);
      assert.equal(hasFastStart(input), false);
      const started = performance.now();
      const output = await prepareHeroVideo(input, { tempRoot: root });
      const ready = join(root, `ready-${hdr}.mp4`);
      await writeFile(ready, output);
      assert.equal(hasFastStart(output), true);
      assert.ok(output.length < VIDEO_LIMITS.outputBytes);
      const decoded = execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        ready,
      ]);
      const metadata = JSON.parse(decoded.toString());
      assert.equal(metadata.streams.length, 1);
      const v = metadata.streams[0];
      assert.equal(v.codec_name, 'h264');
      assert.equal(v.pix_fmt, 'yuv420p');
      assert.equal(v.color_transfer, 'bt709');
      assert.equal(v.color_primaries, 'bt709');
      assert.equal(v.color_space, 'bt709');
      assert.deepEqual([v.width, v.height], [854, 886]);
      assert.equal(v.avg_frame_rate, '30/1');
      assert.equal(Number(v.duration), 2);
      assert.equal(Number(v.nb_frames), 60);
      execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', ready, '-f', 'null', '-']);
      console.log(
        JSON.stringify({
          hdr,
          bytes: output.length,
          milliseconds: performance.now() - started,
        }),
      );
    }
    assert.deepEqual(
      (await readdir(root)).filter((name) => name.startsWith('torchick-video-')),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rotation is baked into pixels and small input is never upscaled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-rotation-'));
  try {
    const original = join(root, 'small.mp4');
    const rotated = join(root, 'rotated.mov');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x180:rate=12:duration=1',
      '-c:v',
      'libx264',
      '-threads',
      '1',
      '-y',
      original,
    ]);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-display_rotation',
      '90',
      '-i',
      original,
      '-c',
      'copy',
      '-y',
      rotated,
    ]);
    const output = await prepareHeroVideo(await readFile(rotated), { tempRoot: root });
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_streams', '-of', 'json', '-i', 'pipe:0'],
        { input: output },
      ).toString(),
    );
    assert.deepEqual([probe.streams[0].width, probe.streams[0].height], [180, 320]);
    assert.equal(probe.streams[0].avg_frame_rate, '12/1');
    assert.ok(
      !(probe.streams[0].side_data_list ?? []).some(
        (s: { rotation?: number }) => s.rotation,
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('single process slot rejects busy work; invalid, timeout and aborted jobs clean temp and release slot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-errors-'));
  try {
    const source = await readFile('e2e/assets/hero-portrait.mp4');
    const first = prepareHeroVideo(source, { tempRoot: root });
    await assert.rejects(
      prepareHeroVideo(source, { tempRoot: root }),
      (error: unknown) => error instanceof MediaError && error.status === 429,
    );
    await first;
    await assert.rejects(
      prepareHeroVideo(Buffer.from('invalid'), { tempRoot: root }),
      (error: unknown) => {
        assert.ok(error instanceof MediaError);
        assert.equal(error.status, 415);
        const detail = error.cause;
        assert.ok(detail && typeof detail === 'object');
        assert.ok('stderr' in detail && typeof detail.stderr === 'string');
        assert.ok(Buffer.byteLength(detail.stderr) <= 4096);
        assert.ok(!detail.stderr.includes(root));
        assert.ok('stage' in detail && detail.stage === 'probe-source');
        return true;
      },
    );
    await assert.rejects(
      prepareHeroVideo(source, { tempRoot: root, timeoutMs: 1 }),
      (error: unknown) => error instanceof MediaError && error.status === 408,
    );
    await assert.rejects(
      prepareHeroVideo(source, { tempRoot: root, outputBytes: 1024 }),
      (error: unknown) => error instanceof MediaError && error.status === 413,
    );
    const controller = new AbortController();
    const aborted = prepareHeroVideo(source, {
      tempRoot: root,
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(
      aborted,
      (error: unknown) => error instanceof MediaError && error.status === 408,
    );
    await prepareHeroVideo(source, { tempRoot: root });
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hero upload preserves original and only returns stored derivative; either storage failure keeps old publication', async () => {
  const source = await readFile('e2e/assets/hero-portrait.mp4');
  for (const failure of [0, 1, 2]) {
    let published = 'https://owned.example/old.mp4';
    const stored: Buffer[] = [];
    const handler = createUploadHandler({
      email: async () => 'synthetic@example.invalid',
      business: async () => ({
        id: 'synthetic-video',
        accountStatus: 'ACTIVE',
        plan: 'premium',
        subscriptionStatus: 'active',
        trialEndsAt: null,
        paidUntil: new Date(Date.now() + 86400_000),
      }),
      configured: () => true,
      store: async (_id, _email, bytes, type, ext) => {
        stored.push(bytes);
        if (stored.length === failure) throw new Error('Synthetic storage failure');
        assert.equal(type, 'video/mp4');
        assert.equal(ext, 'mp4');
        return `https://owned.example/${stored.length}.mp4`;
      },
    });
    const form = new FormData();
    form.set(
      'file',
      new Blob([new Uint8Array(source)], { type: 'video/mp4' }),
      'hero.mp4',
    );
    const response = await handler(
      new Request('https://app.example/api/upload/hero-video', {
        method: 'POST',
        body: form,
      }),
      true,
    );
    const body = await response.json();
    if (response.ok) published = body.url;
    assert.equal(response.status, failure ? 500 : 200);
    assert.ok(stored[0].equals(source));
    if (failure) {
      assert.equal(published, 'https://owned.example/old.mp4');
      assert.equal(body.url, undefined);
    } else {
      assert.equal(stored.length, 2);
      assert.ok(hasFastStart(stored[1]));
      assert.equal(published, 'https://owned.example/2.mp4');
    }
  }
});

test('plan keeps duration uncapped and preserves display aspect within even-pixel rounding', () => {
  const plan = videoEncodingPlan({
    format: { duration: '61' },
    streams: [
      {
        codec_type: 'video',
        width: 1920,
        height: 1080,
        avg_frame_rate: '60000/1001',
        sample_aspect_ratio: '1:1',
      },
    ],
  });
  assert.deepEqual(
    [plan.width, plan.height, plan.fps, plan.duration],
    [1280, 720, 30, 61],
  );
  assert.ok(!plan.filter.includes('trim'));
});

test('generic video upload retains its original bytes and single-store behavior', async () => {
  const source = await readFile('e2e/assets/hero-portrait.mp4');
  let stores = 0;
  const handler = createUploadHandler({
    email: async () => 'synthetic@example.invalid',
    business: async () => ({
      id: 'generic-video',
      accountStatus: 'ACTIVE',
      plan: 'premium',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      paidUntil: new Date(Date.now() + 86400_000),
    }),
    configured: () => true,
    store: async (_id, _email, bytes) => {
      stores++;
      assert.ok(bytes.equals(source));
      return 'https://owned.example/original.mp4';
    },
  });
  const form = new FormData();
  form.set(
    'file',
    new Blob([new Uint8Array(source)], { type: 'video/mp4' }),
    'generic.mp4',
  );
  const response = await handler(
    new Request('https://app.example/api/upload/media', { method: 'POST', body: form }),
  );
  assert.equal(response.status, 200);
  assert.equal(stores, 1);
  assert.deepEqual(await response.json(), { url: 'https://owned.example/original.mp4' });
});

test('WebM selected-video duration excludes a longer audio tail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'video-webm-'));
  try {
    const source = join(root, 'audio-tail.webm');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x180:rate=12:duration=1',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-c:v',
      'libvpx-vp9',
      '-threads',
      '1',
      '-c:a',
      'libopus',
      '-y',
      source,
    ]);
    const probe = JSON.parse(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        source,
      ]).toString(),
    );
    const stream = probe.streams.find(
      (value: { codec_type: string }) => value.codec_type === 'video',
    );
    assert.equal(stream.duration, undefined);
    assert.ok(Number(probe.format.duration) > 2);
    assert.ok(videoEncodingPlan(probe).duration < 1.1);
    const output = await prepareHeroVideo(await readFile(source), { tempRoot: root });
    const target = join(root, 'ready.mp4');
    await writeFile(target, output);
    const ready = JSON.parse(
      execFileSync('ffprobe', [
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        target,
      ]).toString(),
    );
    assert.equal(ready.streams.length, 1);
    assert.equal(Number(ready.streams[0].nb_frames), 12);
    assert.equal(Number(ready.format.duration), 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('missing and explicitly unknown high-bit-depth transfer cannot silently become SDR', () => {
  for (const transfer of [undefined, 'unknown']) {
    assert.throws(
      () =>
        videoEncodingPlan({
          format: { duration: '1' },
          streams: [
            {
              codec_type: 'video',
              width: 320,
              height: 180,
              avg_frame_rate: '30/1',
              pix_fmt: 'yuv420p10le',
              color_transfer: transfer,
            },
          ],
        }),
      (error: unknown) => error instanceof MediaError && error.status === 415,
    );
  }
});
