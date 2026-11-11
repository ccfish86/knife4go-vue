<template>
  <div ref="container" class="knife4j-markdown" v-html="markdownSource"></div>
</template>

<script>
import { marked } from 'marked';

// marked 12+ 的 renderer 回调统一接收 token 对象
// https://marked.js.org/using_pro#renderer

// HTML 转义，避免代码块内容被当作标签解析
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const markdownRenderer = {
  code({ text, lang }) {
    // 语言标识可能带有额外信息，例如 ```js title
    const language = (lang || '').trim().split(/\s+/)[0];
    const code = text == null ? '' : text;
    if (language === 'mermaid') {
      // mermaid 12 的渲染是异步的，无法在同步的 renderer 中完成，
      // 这里先输出占位节点，组件渲染完成后再异步绘制
      return '<div class="mermaid" data-mermaid-code="' + escapeHtml(code) + '"></div>';
    }
    return '<pre><code class="language-' + escapeHtml(language) + '">' + escapeHtml(code) + '</code></pre>';
  }
};

marked.use({
  gfm: true,
  breaks: false,
  renderer: markdownRenderer
});

// 全局只初始化一次 mermaid
let mermaidPromise = null;
let mermaidSeed = 0;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        logLevel: 'fatal',
        securityLevel: 'loose'
      });
      return mermaid;
    }).catch((e) => {
      mermaidPromise = null;
      throw e;
    });
  }
  return mermaidPromise;
}

export default {
  name: "Markdown",
  props: {
    source: {
      type: String,
      default: ''
    }
  },
  computed: {
    markdownSource() {
      return marked.parse(this.source == null ? '' : this.source);
    }
  },
  watch: {
    markdownSource() {
      this.$nextTick(this.renderMermaid);
    }
  },
  mounted() {
    this.renderMermaid();
  },
  methods: {
    async renderMermaid() {
      const container = this.$refs.container;
      if (!container) {
        return;
      }
      const nodes = container.querySelectorAll('.mermaid[data-mermaid-code]');
      if (!nodes.length) {
        return;
      }
      let mermaid;
      try {
        mermaid = await loadMermaid();
      } catch (e) {
        return;
      }
      await Promise.all(Array.prototype.map.call(nodes, async (node) => {
        if (node.dataset.rendered === '1') {
          return;
        }
        node.dataset.rendered = '1';
        const code = node.getAttribute('data-mermaid-code') || '';
        mermaidSeed += 1;
        try {
          const { svg } = await mermaid.render('knife4j-mermaid-' + mermaidSeed, code);
          node.innerHTML = svg;
        } catch (e) {
          // 语法错误时降级为普通代码块，避免页面空白
          node.innerHTML = '<pre><code class="language-mermaid">' + escapeHtml(code) + '</code></pre>';
        }
      }));
    }
  }
}
</script>
