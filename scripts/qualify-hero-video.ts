import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { prepareHeroVideo, hasFastStart, VIDEO_LIMITS } from '../src/server/media/video';

const directory = '.test-runtime/video-qualification';
const samples = [
  { name: 'representative-hdr', dimensions: '854x886', seconds: 14 },
  { name: 'bounded-4k-hdr', dimensions: '3840x2160', seconds: 1 },
];
async function main() {
  if (process.argv.includes('--generate')) {
    mkdirSync(directory, { recursive: true });
    for (const sample of samples) {
      execFileSync(
        'ffmpeg',
        [
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          `testsrc2=size=${sample.dimensions}:rate=60:duration=${sample.seconds}`,
          '-filter_threads',
          '1',
          '-vf',
          'format=yuv420p10le',
          '-c:v',
          'libx265',
          '-threads',
          '1',
          '-preset',
          'ultrafast',
          '-x265-params',
          'pools=none:frame-threads=1:log-level=error:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc',
          '-y',
          join(directory, `${sample.name}.mov`),
        ],
        { timeout: 90_000, stdio: 'pipe' },
      );
    }
  } else {
    assert.equal(process.platform, 'linux');
    const reserve = Buffer.alloc(192 * 1024 * 1024, 1);
    const results = [];
    for (const sample of samples) {
      const started = performance.now();
      const input = readFileSync(join(directory, `${sample.name}.mov`));
      const output = await prepareHeroVideo(input);
      const milliseconds = performance.now() - started;
      assert.ok(milliseconds < VIDEO_LIMITS.timeoutMs);
      assert.ok(hasFastStart(output));
      assert.equal(reserve[reserve.length - 1], 1);
      results.push({
        ...sample,
        inputBytes: input.length,
        outputBytes: output.length,
        milliseconds,
      });
    }
    const evidence = {
      ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' })
        .split('\n')
        .slice(0, 3),
      cpuMax: readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim(),
      memoryMax: readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim(),
      memoryPeak: readFileSync('/sys/fs/cgroup/memory.peak', 'utf8').trim(),
      memoryEvents: readFileSync('/sys/fs/cgroup/memory.events', 'utf8').trim(),
      appHeadroomReservedBytes: reserve.length,
      appHeadroomScope:
        'Resident synthetic reservation plus test Node process; not a live application load test.',
      childAddressSpaceBytes: 268435456,
      results,
    };
    assert.equal(evidence.memoryMax, '536870912');
    assert.equal(evidence.cpuMax, '25000 100000');
    assert.match(evidence.memoryEvents, /oom_kill 0/);
    writeFileSync(
      join(directory, 'qualification.json'),
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence, null, 2));
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
