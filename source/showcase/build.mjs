import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { lstat, mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { CORE_SOURCES, auditPublicFolder } from './publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const here = join(root, 'showcase');
const out = join(here, 'dist');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function regular(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Only regular source files may be published');
  return readFile(path);
}
async function galleryFiles(directory = join(here, 'src')) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Unexpected gallery source entry');
    if (stat.isDirectory()) files.push(...await galleryFiles(path));
    else if (/\.(?:tsx?|css)$/.test(entry.name) && stat.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
    else throw new Error('Unexpected gallery source type');
  }
  if (files.length > 30) throw new Error('Gallery source exceeds the reviewed publication scope');
  return files.sort();
}
async function packageVersion(name) {
  return JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
}

// Never publish frontend/out: its deployment guards are not portable to static hosts.
try {
  await auditPublicFolder(out);
  await rm(out, { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(join(out, 'assets'), { recursive: true });
const gallery = await galleryFiles();
const ownSources = ['showcase/index.html', 'showcase/build.mjs', 'showcase/publication.mjs', 'showcase/engine-entry.ts', ...gallery, ...CORE_SOURCES];
const allowedInput = new Set(ownSources);
const sourceHashes = new Map(await Promise.all(ownSources.map(async path => [path, hash(await regular(join(root, path)))])));
const bundle = await build({
  absWorkingDir: root,
  entryPoints: ['showcase/src/main.tsx'],
  outfile: join(out, 'assets/app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  metafile: true,
  legalComments: 'inline',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    '@taxsorted/engine/uk/vat': join(here, 'engine-entry.ts'),
    '@/lib/format': join(root, 'frontend/src/lib/format.ts'),
    '@/lib/parse': join(root, 'frontend/src/lib/parse.ts'),
  },
});
for (const input of Object.keys(bundle.metafile.inputs)) {
  const path = relative(root, resolve(root, input)).replaceAll('\\', '/');
  if (!allowedInput.has(path) && !/^node_modules\/(?:react|react-dom|scheduler|date-fns)\//.test(path)) {
    throw new Error(`Unexpected bundle dependency outside the public study: ${path}`);
  }
}
const brand = (await regular(join(root, 'frontend/src/app/globals.css'))).toString('utf8').replace('@import "tailwindcss";', '');
const custom = (await Promise.all(gallery.filter(path => path.endsWith('.css')).map(path => regular(join(root, path))))).join('\n');
const css = `@import "tailwindcss" source(none);\n@source "../frontend/src/app/plan/vat-comparison-client.tsx";\n@source "./src";\n${brand}\n${custom}`;
const styled = await postcss([tailwind({ base: root })]).process(css, { from: join(here, 'styles.entry.css'), map: false });
await writeFile(join(out, 'assets/app.css'), styled.css);
await copyFile(join(here, 'index.html'), join(out, 'index.html'));
await mkdir(join(out, 'source'), { recursive: true });
for (const filename of ['LICENSE', 'CONTENT-LICENSE']) {
  await copyFile(join(root, filename), join(out, filename));
  await copyFile(join(root, filename), join(out, 'source', filename));
}
await writeFile(join(out, '.nojekyll'), '');
await writeFile(join(out, '.gitignore'), 'source/node_modules/\nsource/showcase/dist/\n');

const sources = [];
for (const path of ownSources) {
  const bytes = await regular(join(root, path));
  if (hash(bytes) !== sourceHashes.get(path)) throw new Error(`Source changed during the build: ${path}`);
  const destination = join(out, 'source', path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  sources.push({ path: `source/${path}`, sha256: hash(bytes) });
}
const dependencies = {}, devDependencies = {};
for (const name of ['react', 'react-dom', 'date-fns']) dependencies[name] = await packageVersion(name);
for (const name of ['esbuild', 'postcss', '@tailwindcss/postcss', 'tailwindcss']) devDependencies[name] = await packageVersion(name);
const moduleType = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).type;
await writeFile(join(out, 'source/package.json'), JSON.stringify({ name: 'taxsorted-studies-source', private: true, type: moduleType, license: 'AGPL-3.0', engines: { node: '22.x' }, scripts: { build: 'node showcase/build.mjs' }, dependencies, devDependencies }, null, 2) + '\n');
await writeFile(join(out, 'source/README.md'), '# Corresponding source\n\nThis is the allowlisted source for the published TaxSorted study, not a full TaxSorted release.\n\nUse Node 22. Run `npm install`, then `npm run build` here. Output is `showcase/dist`. The tax rules remain a stored reference model, not admitted advice. Code is AGPL-3.0; see the parent LICENSE.\n');
let notices = 'Third-party software included in this public artifact\n\n';
for (const name of ['react', 'react-dom', 'scheduler', 'date-fns', 'tailwindcss', 'esbuild']) {
  const directory = join(root, 'node_modules', name);
  const filename = (await readdir(directory)).find(file => /^license(?:\.md|\.txt)?$/i.test(file));
  if (!filename) throw new Error(`Missing third-party licence: ${name}`);
  notices += `\n--- ${name} ${await packageVersion(name)} ---\n\n${await readFile(join(directory, filename), 'utf8')}\n`;
}
await writeFile(join(out, 'THIRD_PARTY_NOTICES.txt'), notices);
await writeFile(join(out, 'build-info.json'), JSON.stringify({ schema: 'taxsorted.study-release/1', sourceReview: 'not-admitted-for-advice', includesPrivateSiteExport: false, calculation: 'historical-illustration-only', sources, dependencies }, null, 2) + '\n');
await writeFile(join(out, 'README.md'), `---
title: TaxSorted Studies
sdk: static
app_file: index.html
license: agpl-3.0
short_description: Small, connected studies in lawful tax choices.
tags:
  - tax
  - education
  - typescript
  - local-first
---

# TaxSorted Studies

A small public working room: recognition, time, choice and repair. Start with a question, follow its connections, and try one bounded historical VAT illustration.

- [Open the study](https://cambridgetcg.github.io/taxsorted-studies/)
- [Visit TaxSorted](https://taxsorted.io/)
- [Read the corresponding source](source/)

## The honest boundary

The comparison uses a stored model, not verified rules for your tax period. It does not establish scheme eligibility, a switching opportunity, a refund entitlement or future savings. Use fictional data. Calculations happen in your browser; this application does not save or submit your figures. Hosting providers may process access metadata.

This artifact deliberately excludes the wider application, private records, account/filing services, research corpora, local agent context and credentials. It is suitable for a static Hugging Face Space or GitHub Pages. No model endpoint, GPU or paid runtime is required.

## Source and licence

Code is AGPL-3.0. TaxSorted-authored writing is CC BY-SA 4.0; attribute TaxSorted (taxsorted.io). See LICENSE, CONTENT-LICENSE and THIRD_PARTY_NOTICES.txt. Exact study source is included under source/ with dependency versions and rebuild instructions. build-info.json identifies its source bytes; it is not evidence of legal-source approval.
`);
const audit = await auditPublicFolder(out);
console.log(JSON.stringify({ ok: true, artifact: 'showcase/dist', files: audit.files.length, bytes: audit.totalBytes, scope: 'allowlisted-public-study', sourceReview: 'not-admitted-for-advice' }, null, 2));
