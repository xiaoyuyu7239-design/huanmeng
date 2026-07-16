// 这个文件是"施工图纸"：告诉打包工具 Vite 去哪里找源码、素材放在哪、怎么分包。
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { 创建关系AI中间件 } from './服务端/关系AI代理.js';

function 关系AI服务插件() {
  const 安装 = (server) => {
    // 只在 dev / preview 服务真正启动时读取进程环境；构建阶段既不加载 .env，
    // 也不把服务端密钥交给 Vite 的 env 调试器。
    server.middlewares.use(创建关系AI中间件({ env: process.env }));
  };
  return {
    name: 'yanjing-relationship-ai-server',
    configureServer: 安装,
    configurePreviewServer: 安装,
  };
}

export default defineConfig(() => ({
  plugins: [
    关系AI服务插件(),
    react(),
  ],
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
}));
