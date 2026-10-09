import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const CORE_SOURCES = Object.freeze([
  'engine/jurisdictions/uk/vat/historical-comparison.ts',
  'engine/jurisdictions/uk/vat/optimiser.ts',
  'engine/jurisdictions/uk/vat/compute.ts',
  'engine/jurisdictions/uk/vat/config.ts',
  'engine/jurisdictions/uk/vat/types.ts',
  'frontend/src/app/plan/vat-comparison-client.tsx',
  'frontend/src/app/globals.css',
  'frontend/src/lib/format.ts',
  'frontend/src/lib/parse.ts',
]);

const fixed = new Set([
  'index.html', 'README.md', 'LICENSE', 'CONTENT-LICENSE', 'THIRD_PARTY_NOTICES.txt',
  '.nojekyll', '.gitignore', 'build-info.json', 'assets/app.js', 'assets/app.css',
  'source/package.json', 'source/README.md', 'source/LICENSE', 'source/CONTENT-LICENSE', 'source/showcase/index.html',
  'source/showcase/build.mjs', 'source/showcase/publication.mjs', 'source/showcase/engine-entry.ts',
  ...CORE_SOURCES.map(path => `source/${path}`),
]);
const publicGallerySource = /^source\/showcase\/src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:ts|tsx|css)$/;
const privateMaterial = /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/|hf_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

export function assertPublicPath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.startsWith('/') ||
      path.split('/').some(part => part === '..' || part === '.' || part === '')) {
    throw new Error(`Public artifact path not allowed: ${String(path)}`);
  }
  if (!fixed.has(path) && !publicGallerySource.test(path)) {
    throw new Error(`Public artifact path not allowed: ${path}`);
  }
}

export async function auditPublicFolder(root) {
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink()) throw new Error('Public artifact root is a symlink');
  if (!rootStat.isDirectory()) throw new Error('Public artifact root is not a directory');
  const files = [];
  let totalBytes = 0;
  async function visit(relative = '') {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      const stat = await lstat(join(root, path));
      if (stat.isSymbolicLink()) throw new Error(`Public artifact symlink refused: ${path}`);
      if (stat.isDirectory()) {
        if (entry.name.startsWith('.') || !/^[A-Za-z0-9_-]+$/.test(entry.name) || path.split('/').length > 10) {
          throw new Error(`Public artifact directory not allowed: ${path}`);
        }
        await visit(path);
        continue;
      }
      assertPublicPath(path);
      if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw new Error(`Unsupported public artifact file: ${path}`);
      totalBytes += stat.size;
      if (totalBytes > 12 * 1024 * 1024 || files.length >= 100) throw new Error('Public artifact exceeds its bounded size');
      const bytes = await readFile(join(root, path));
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (privateMaterial.test(text)) throw new Error(`Public artifact contains private material: ${path}`);
      files.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  await visit();
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { schema: 'taxsorted.public-artifact/1', files, totalBytes };
}
