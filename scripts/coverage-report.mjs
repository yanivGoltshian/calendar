import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { transformSync } from 'esbuild';
import { TraceMap, decodedMappings } from '@jridgewell/trace-mapping';

const [input, output, scope, ...gates] = process.argv.slice(2);
if (!input || !output || !['unit', 'integration'].includes(scope))
  throw new Error(
    'Usage: coverage-report.mjs input-directory output.json unit|integration [file:minimum-percent]',
  );
const root = process.cwd();
const inventory = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n');
const production = [...new Set(inventory)].filter(
  (file) =>
    ((file.startsWith('src/') && /\.(ts|tsx|js|jsx)$/.test(file)) ||
      file === 'middleware.ts' ||
      file === 'next.config.mjs' ||
      (file.startsWith('public/') && /\.js$/.test(file))) &&
    !/\.(test|spec)\./.test(file) &&
    !/\.d\.ts$/.test(file),
);
const rows = new Map();
for (const file of production) {
  const text = readFileSync(file, 'utf8');
  const transformed = transformSync(text, {
    loader: file.endsWith('.tsx') ? 'tsx' : file.endsWith('.ts') ? 'ts' : 'js',
    sourcefile: resolve(file),
    sourcemap: 'external',
    sourcesContent: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
  });
  const mapped = new Set(
    decodedMappings(new TraceMap(transformed.map))
      .flat()
      .filter((segment) => segment.length >= 4)
      .map((segment) => segment[2] + 1),
  );
  rows.set(file, { file, mapped, hit: new Set(), loaded: false });
}
for (const name of readdirSync(input).filter((name) => name.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(input, name), 'utf8'));
  for (const script of raw.result) {
    if (!script.url.startsWith('file:')) continue;
    const row = rows.get(relative(root, fileURLToPath(script.url)));
    if (!row) continue;
    row.loaded = true;
    const cache = raw['source-map-cache']?.[script.url];
    if (!cache?.data) continue;
    const starts = [0];
    for (const length of cache.lineLengths) starts.push(starts.at(-1) + length + 1);
    const ranges = script.functions
      .flatMap((fn) => fn.ranges)
      .sort((a, b) => a.endOffset - a.startOffset - (b.endOffset - b.startOffset));
    const mappings = decodedMappings(new TraceMap(cache.data));
    for (let line = 0; line < mappings.length; line++) {
      for (const segment of mappings[line]) {
        if (segment.length < 4) continue;
        const offset = starts[line] + segment[0];
        const range = ranges.find(
          (range) => range.startOffset <= offset && offset < range.endOffset,
        );
        if (range?.count > 0 && row.mapped.has(segment[2] + 1))
          row.hit.add(segment[2] + 1);
      }
    }
  }
}
const files = [...rows.values()].map((row) => ({
  file: row.file,
  loaded: row.loaded,
  mappedLines: row.mapped.size,
  hitMappedLines: row.hit.size,
  percent: row.mapped.size ? +((100 * row.hit.size) / row.mapped.size).toFixed(2) : null,
  uncoveredMappedLines: [...row.mapped]
    .filter((line) => !row.hit.has(line))
    .sort((a, b) => a - b),
}));
const sum = (key) => files.reduce((total, file) => total + file[key], 0);
const totals = {
  files: files.length,
  loadedFiles: files.filter((file) => file.loaded).length,
  mappedLines: sum('mappedLines'),
  hitMappedLines: sum('hitMappedLines'),
  percent: +((100 * sum('hitMappedLines')) / sum('mappedLines')).toFixed(2),
};
writeFileSync(
  output,
  JSON.stringify(
    {
      scope,
      totals,
      method:
        'Same audit method: V8 executed ranges mapped through tsx source maps; all runtime src TS/TSX/JS, middleware, Next config and public JavaScript form the esbuild-mapped denominator, including unloaded files as zero. A positive mapped segment counts its source line. Not Istanbul statements or branches. Excludes tests, declarations, CSS, schema/migrations/seed, infrastructure and developer scripts. Integration coverage covers directly imported modules, not compiled Next HTTP handlers or browser execution; scopes are never merged.',
      files,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ scope, totals, report: output }));
for (const gate of gates) {
  const separator = gate.lastIndexOf(':');
  const file = gate.slice(0, separator);
  const minimum = Number(gate.slice(separator + 1));
  const actual =
    file === 'all' ? totals.percent : files.find((entry) => entry.file === file)?.percent;
  if (!Number.isFinite(minimum) || actual == null || actual < minimum)
    throw new Error(
      `${scope} coverage floor failed for ${file}: ${actual ?? 'missing'} < ${minimum}`,
    );
}
