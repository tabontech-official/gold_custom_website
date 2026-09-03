import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [hydrogen(), oxygen(), reactRouter(), tsconfigPaths()],
  build: {
    // Allow a strict Content-Security-Policy
    // withtout inlining assets as base64:
    assetsInlineLimit: 0,
    /**
     * Vite's default ('modules' — es2020 + a few 2019-era browsers) makes esbuild
     * down-level async/await, optional chaining, nullish coalescing and class
     * fields into generator/helper boilerplate that every browser this store
     * actually serves has supported natively since 2021. That boilerplate is the
     * "Legacy JavaScript" Lighthouse reports (~13 KiB): bytes shipped, parsed and
     * executed to polyfill nothing.
     *
     * es2022 is Baseline widely available (Chrome/Edge 94+, Safari 15.4+,
     * Firefox 93+) and is already below Hydrogen's own floor — Oxygen runs
     * workerd, and the Customer Account API flow requires a browser newer than
     * this regardless, so nothing is dropped that could have checked out anyway.
     */
    target: 'es2022',
  },
  ssr: {
    optimizeDeps: {
      /**
       * Include dependencies here if they throw CJS<>ESM errors.
       * For example, for the following error:
       *
       * > ReferenceError: module is not defined
       * >   at /Users/.../node_modules/example-dep/index.js:1:1
       *
       * Include 'example-dep' in the array below.
       * @see https://vitejs.dev/config/dep-optimization-options
       */
      include: ['set-cookie-parser', 'cookie', 'react-router'],
    },
  },
  server: {
    allowedHosts: ['.tryhydrogen.dev', 'amaze-saint-haziness.ngrok-free.dev',],
  },
});
