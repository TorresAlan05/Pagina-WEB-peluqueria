import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'peluqueria'
  },
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? 'peluqueria-maty-alan',
  corsOrigins: (process.env.CORS_ORIGINS ??
    'http://localhost:4200,https://peluqueria-maty-alan.web.app,https://peluqueria-maty-alan.firebaseapp.com')
    .split(',').map((s) => s.trim()).filter(Boolean)
};
