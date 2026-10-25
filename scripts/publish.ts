// Uploads the packed extension to a store and submits it for review.
//
//   node scripts/publish.ts chrome <package.zip>
//   node scripts/publish.ts edge <package.zip>
import { readFile } from 'node:fs/promises';
import { publishChrome, publishEdge } from './stores.ts';

const [store, archivePath] = process.argv.slice(2);
if (!archivePath || (store !== 'chrome' && store !== 'edge')) {
  console.error('Usage: node scripts/publish.ts <chrome|edge> <package.zip>');
  process.exit(2);
}

const archive = await readFile(archivePath);
const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
if (store === 'chrome') await publishChrome(archive);
else await publishEdge(archive, version);
