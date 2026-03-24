import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const commitCount = execSync('git rev-list --count HEAD').toString().trim();
const appVersion = `0.${commitCount}.0`;

export default defineConfig({
  root: '.',
  server: { port: 9010 },
  publicDir: '../../assets',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
});
