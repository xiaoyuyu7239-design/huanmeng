// 这个文件是"施工图纸"：告诉打包工具 Vite 去哪里找源码、素材放在哪、怎么分包。
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 素材(全景图/视频/音乐/剧情JSON)都放在「公共资源」文件夹，
  // 里面的路径和线上完全一致(/games /panoramas /videos /music /voices)
  publicDir: '公共资源',
  build: {
    rollupOptions: {
      output: {
        // 和线上一样：React、Three.js 这种大块头单独分包，加载更快
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          three: ['three'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: { port: 5173, open: false },
});
