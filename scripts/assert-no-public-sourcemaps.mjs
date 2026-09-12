import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = join(process.cwd(), '.next', 'static');
const sourceMaps = [];

async function visit(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Expected .next/static after production build');
    }
    throw error;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile() && entry.name.endsWith('.map')) sourceMaps.push(relative(process.cwd(), path));
  }
}

await visit(root);
if (sourceMaps.length > 0) {
  throw new Error(`Public source maps detected:\n${sourceMaps.join('\n')}`);
}
