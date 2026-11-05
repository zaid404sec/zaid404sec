import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html2pdfSource = path.join(root, 'node_modules', 'html2pdf.js', 'dist', 'html2pdf.bundle.min.js');
const html2pdfTarget = path.join(root, 'html2pdf.bundle.min.js');
const nativeBundleTarget = path.join(root, 'invoice-native.bundle.js');

await copyFile(html2pdfSource, html2pdfTarget);
await build({
  entryPoints: [path.join(root, 'src', 'invoice-native.js')],
  outfile: nativeBundleTarget,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
});

console.log('Prepared local PDF generator and native file-sharing bridge.');
