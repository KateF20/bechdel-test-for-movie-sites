// Uploads the packed extension to the Chrome Web Store and submits it for review.
//
//   node scripts/publish.ts <package.zip>
import { readFile } from 'node:fs/promises';
import { publishChrome } from './chrome-web-store.ts';

const [archivePath] = process.argv.slice(2);
if (!archivePath) {
  console.error('Usage: node scripts/publish.ts <package.zip>');
  process.exit(2);
}

await publishChrome(await readFile(archivePath));
