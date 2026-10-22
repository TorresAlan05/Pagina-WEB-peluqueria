import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'peluqueria',
    // Aiven (y casi cualquier MySQL en la nube) exige SSL: poné DB_SSL=true
    ssl: process.env.DB_SSL === 'true',
    // Certificado CA de Aiven: el texto completo (en Vercel) o la ruta al archivo ca.pem (en tu PC)
    sslCa: process.env.DB_SSL_CA?.replace(/\\n/g, '\n'),
    sslCaFile: process.env.DB_SSL_CA_FILE,
    // Conexiones por instancia. En Vercel usá un número bajo (3) porque cada función abre su propio pool
    poolSize: Number(process.env.DB_POOL_SIZE ?? 10)
  },
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? 'peluqueria-maty-alan',
  corsOrigins: (process.env.CORS_ORIGINS ??
    'http://localhost:4200,https://peluqueria-maty-alan.web.app,https://peluqueria-maty-alan.firebaseapp.com')
    .split(',').map((s) => s.trim()).filter(Boolean)
};
