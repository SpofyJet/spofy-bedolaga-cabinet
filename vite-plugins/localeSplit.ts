import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Разделы admin.*, которые нужны и обычным экранам: заголовок ссылки на админку, страницы FAQ. */
const SHARED_ADMIN_SECTIONS = ['nav', 'infoPages'];

type Dictionary = Record<string, unknown> & { admin?: Record<string, unknown> };

function userPart({ admin = {}, ...rest }: Dictionary): Dictionary {
  const shared = Object.fromEntries(
    SHARED_ADMIN_SECTIONS.filter((key) => key in admin).map((key) => [key, admin[key]]),
  );
  return { ...rest, admin: shared };
}

function adminPart({ admin = {} }: Dictionary): Dictionary {
  return { admin };
}

const REQUEST = /^(.+\/locales\/[a-z]+\.json)\?(?:import&)?(user|admin)$/;
const VIRTUAL_PREFIX = '\0locale-split:';

/**
 * Две трети словаря — админка, а её открывает один человек. `ru.json?user` и
 * `ru.json?admin` делят файл при сборке: источник перевода остаётся один.
 */
export function localeSplit(): Plugin {
  return {
    name: 'spofy-locale-split',
    enforce: 'pre',
    resolveId(source, importer) {
      const match = REQUEST.exec(source);
      if (!match || !importer) return null;
      const file = path.resolve(path.dirname(importer.split('?')[0]), match[1]);
      // Суффикс .js: иначе сборщик примет модуль за JSON и не разберёт код ниже.
      return `${VIRTUAL_PREFIX}${match[2]}:${file}.js`;
    },
    async load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null;
      const separator = id.indexOf(':', VIRTUAL_PREFIX.length);
      const part = id.slice(VIRTUAL_PREFIX.length, separator);
      const file = id.slice(separator + 1, -'.js'.length);
      const dictionary = JSON.parse(await readFile(file, 'utf8')) as Dictionary;
      const body = JSON.stringify(part === 'user' ? userPart(dictionary) : adminPart(dictionary));
      return `export default JSON.parse(${JSON.stringify(body)});`;
    },
  };
}
