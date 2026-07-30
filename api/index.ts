import app from '../src/server';

// Vercel memanggil file ini sebagai serverless function.
// Express app yang di-export dari src/server.ts sudah berupa
// request handler (req, res) => void, jadi cukup di-export ulang
// di sini tanpa memanggil app.listen().
export default app;