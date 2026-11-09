import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import type { Plugin } from 'vite';

const compress = promisify(brotliCompress);

/** Brotli 11 при сборке: сервер отдаёт готовый файл и не жмёт его на лету. */
export function precompress(): Plugin {
  return {
    name: 'spofy-precompress',
    apply: 'build',
    async writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist';
      const files = Object.keys(bundle).filter((name) => /\.(js|css)$/.test(name));
      await Promise.all(
        files.map(async (name) => {
          const file = path.join(outDir, name);
          const body = await compress(await readFile(file), {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
          });
          await writeFile(`${file}.br`, body);
        }),
      );
    },
  };
}
