import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html2pdfSource = path.join(root, 'node_modules', 'html2pdf.js', 'dist', 'html2pdf.bundle.min.js');
const html2pdfTarget = path.join(root, 'html2pdf.bundle.min.js');
const excelJsSource = path.join(root, 'node_modules', '@andreeewill', 'exceljs', 'dist', 'exceljs.min.js');
const excelJsTarget = path.join(root, 'exceljs.bundle.min.js');
const nativeBundleTarget = path.join(root, 'invoice-native.bundle.js');
const reportBundleTarget = path.join(root, 'report-export.bundle.js');
const cloudBundleTarget = path.join(root, 'cloud-sync.bundle.js');

await copyFile(html2pdfSource, html2pdfTarget);
await copyFile(excelJsSource, excelJsTarget);
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

await build({ entryPoints: [path.join(root, 'src', 'report-export.js')], outfile: reportBundleTarget, bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true, legalComments: 'none' });
await build({ entryPoints: [path.join(root, 'src', 'cloud-sync.js')], outfile: cloudBundleTarget, bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true, legalComments: 'none' });
console.log('Prepared local PDF, native file sharing, secure Excel export and cloud sync bundles.');
