import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react-native': path.resolve(__dirname, 'src/lib/reactNativeWebWrapper.ts'),
        'react-native-svg': path.resolve(__dirname, 'src/lib/svgWebStub.tsx'),
        '@react-native/assets-registry/registry': path.resolve(__dirname, 'src/lib/assetsRegistryStub.ts'),
        '@react-native/assets-registry': path.resolve(__dirname, 'src/lib/assetsRegistryStub.ts'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
