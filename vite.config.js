import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { compression } from 'vite-plugin-compression2'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath, URL } from 'node:url'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

// 将体积较大的第三方依赖拆分成独立chunk，避免单个文件过大，同时提升浏览器缓存命中率
// 注意：这里只做"按库归组"，不再兜底到统一的 vendor chunk。
// 否则仅被懒加载路由使用的重型依赖（如 @babel/types、ast-types）会被提升到入口chunk中提前下载。
const vendorChunks = [
  { name: 'vendor-vue', test: /[\\/]node_modules[\\/](vue|@vue|vue-router|vue-i18n|pinia)[\\/]/ },
  { name: 'vendor-antd', test: /[\\/]node_modules[\\/](ant-design-vue|@ant-design)[\\/]/ },
  { name: 'vendor-ace', test: /[\\/]node_modules[\\/](ace-builds|vue3-ace-editor)[\\/]/ },
  // lodash 既被业务代码使用也被 mermaid 的布局依赖(dagre)使用，
  // 不单独分组会被 rollup 归入 mermaid chunk，导致入口提前加载整个 mermaid
  { name: 'vendor-lodash', test: /[\\/]node_modules[\\/]lodash[\\/]/ },
  // marked 会被入口静态引用（接口描述渲染）
  { name: 'vendor-marked', test: /[\\/]node_modules[\\/]marked[\\/]/ }
  // 注意：mermaid、@babel、ast-types 等仅由懒加载页面使用的重型依赖不要手动分组，
  // 否则 rollup 会把它们与其动态依赖合并并被提升为入口的静态依赖，导致首屏提前加载。
]

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueJsx(),
    Components({
      dts: false,
      resolvers: [AntDesignVueResolver({ importStyle: 'css' })]
    }),
    nodePolyfills({
      // 仅在确实使用Node内置模块时注入polyfill，减小打包体积
      include: ['buffer', 'process', 'stream', 'util', 'events', 'path', 'string_decoder', 'crypto']
    }),
    compression({
      algorithms: ['gzip'],
      threshold: 10240,
      deleteOriginalAssets: false
    })
  ],
  resolve: {
    alias: [
      { find: '@', replacement: srcDir },
      { find: /^~/, replacement: '' }
    ]
  },
  // 开启less支持
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8990',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    // 兼容内嵌在老系统、旧浏览器中的使用场景
    target: 'es2018',
    cssTarget: 'chrome80',
    chunkSizeWarningLimit: 2000,
    reportCompressedSize: false,
    rollupOptions: {
      input: 'doc.html',
      output: {
        chunkFileNames: 'webjars/js/[name]-[hash].js',
        entryFileNames: 'webjars/js/[name]-[hash].js',
        assetFileNames: 'webjars/[ext]/[name]-[hash].[ext]',
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }
          const chunk = vendorChunks.find((item) => item.test.test(id))
          // 未匹配到的依赖交给 rollup 决定归属，避免污染入口chunk
          return chunk ? chunk.name : undefined
        }
      }
    }
  }
})
