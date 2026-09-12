import { pathToFileURL } from 'node:url';

import {
  BusinessImportError,
  importBusinessFromUrl,
  type BusinessImportDraft,
} from '../src/server/businessImport/index';

type Importer = (url: string) => Promise<BusinessImportDraft>;

export interface BusinessImportCliDependencies {
  importer?: Importer;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
}

export async function runBusinessImportCli(
  args: string[],
  dependencies: BusinessImportCliDependencies = {},
): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const url = args[0];
  if (!url || args.length !== 1) {
    stderr.write('Usage: npm run import:business -- <url>\n');
    return 2;
  }

  try {
    const draft = await (dependencies.importer ?? importBusinessFromUrl)(url);
    stdout.write(`${JSON.stringify(draft, null, 2)}\n`);
    return 0;
  } catch (error) {
    const payload =
      error instanceof BusinessImportError
        ? {
            error: error.code,
            message: error.message,
            url: error.url,
            status: error.status,
            diagnostics: error.diagnostics,
          }
        : {
            error: 'unexpected_error',
            message: error instanceof Error ? error.message : String(error),
          };
    stderr.write(`${JSON.stringify(payload)}\n`);
    return 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entrypoint === import.meta.url) {
  void runBusinessImportCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
