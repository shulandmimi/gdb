import { defineConfig } from 'vite';

export default defineConfig({
    esbuild: {
        sourcemap: true,
        treeShaking: false,
    },

    root: './',
});
