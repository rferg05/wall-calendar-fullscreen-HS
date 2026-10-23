import { defineConfig } from 'vite';

// Preview page only (npm run preview): runs the module against dev/main.tsx's mock calendar.
export default defineConfig({
  root: __dirname,
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
  server: { port: 5179 },
});
