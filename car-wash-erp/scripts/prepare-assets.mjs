import { build } from 'esbuild';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pdfMakeSource = path.join(root, 'node_modules', 'pdfmake', 'build', 'pdfmake.min.js');
const pdfMakeFontsSource = path.join(root, 'node_modules', 'pdfmake', 'build', 'vfs_fonts.js');
const pdfMakeTarget = path.join(root, 'pdfmake.bundle.min.js');
const pdfMakeFontsTarget = path.join(root, 'pdfmake-vfs.js');
const excelJsSource = path.join(root, 'node_modules', '@andreeewill', 'exceljs', 'dist', 'exceljs.min.js');
const excelJsTarget = path.join(root, 'exceljs.bundle.min.js');
const nativeBundleTarget = path.join(root, 'invoice-native.bundle.js');
const reportBundleTarget = path.join(root, 'report-export.bundle.js');
const cloudBundleTarget = path.join(root, 'cloud-sync.bundle.js');
const notificationsBundleTarget = path.join(root, 'notifications-native.bundle.js');
const communicationsBundleTarget = path.join(root, 'communications.bundle.js');
const nativeLinksBundleTarget = path.join(root, 'native-links.bundle.js');

await copyFile(pdfMakeSource, pdfMakeTarget);
const pdfMakeFonts = await readFile(pdfMakeFontsSource, 'utf8');
if (!pdfMakeFonts.includes('addVirtualFileSystem(vfs)')) {
  throw new Error('The bundled PDFMake VFS font file is not compatible with the installed PDFMake runtime.');
}
// pdfmake 0.2.23 installs font data with addVirtualFileSystem(); it does not
// expose the legacy pdfMake.vfs object. Set a readiness marker only after the
// VFS script has executed successfully in the app's WebView.
await writeFile(
  pdfMakeFontsTarget,
  pdfMakeFonts + '\n;window.__primeAutoCarePdfFontsReady = !!(window.pdfMake && typeof window.pdfMake.createPdf === \'function\' && typeof window.pdfMake.addVirtualFileSystem === \'function\');\n',
  'utf8'
);
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
await build({ entryPoints: [path.join(root, 'src', 'local-notifications.js')], outfile: notificationsBundleTarget, bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true, legalComments: 'none' });
await build({ entryPoints: [path.join(root, 'src', 'communications.js')], outfile: communicationsBundleTarget, bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true, legalComments: 'none' });
await build({ entryPoints: [path.join(root, 'src', 'native-links.js')], outfile: nativeLinksBundleTarget, bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true, legalComments: 'none' });
console.log('Prepared native PDFMake invoices, native file sharing, local notifications, secure Excel export, cloud sync and queued communications and native SMS composer bundles.');
