import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const commitCount = execSync('git rev-list --count HEAD').toString().trim();

export default defineConfig({
  root: '.',
  server: { port: 9010 },
  publicDir: '../../assets',
  define: {
    __APP_VERSION__: JSON.stringify(`0.${commitCount}.0`),
  },
});
