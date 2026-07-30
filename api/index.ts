import path from 'path';
import moduleAlias from 'module-alias';

// Vercel meng-compile setiap file TypeScript apa adanya, tanpa
// meresolusi alias "@/..." seperti yang dilakukan `tsc` saat build
// lokal. Alias itu didaftarkan manual di sini, menunjuk ke folder
// "src" persis seperti struktur yang Vercel deploy (/var/task/src/...),
// SEBELUM file server di-require di bawah.
moduleAlias.addAlias('@', path.join(__dirname, '..', 'src'));

// Pakai require() biasa (bukan `import`) supaya urutan eksekusi
// dijamin berjalan SETELAH addAlias di atas.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../src/server').default;

export default app;