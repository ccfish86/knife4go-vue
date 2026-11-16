<template>
  <div class="generate">
    <!--query参数拼接方式切换:默认交给axios序列化,也可切换为URLSearchParams手动拼接-->
    <div class="api-switch">
      <span class="api-switch-label">{{ $t('script.queryMode') }}</span>
      <a-radio-group v-model:value="queryMode" size="small" :disabled="isMultipart" @change="generateCode">
        <a-radio-button value="axios">Axios</a-radio-button>
        <a-radio-button value="urlsearchparams">URLSearchParams</a-radio-button>
      </a-radio-group>
      <span class="api-switch-tip" v-if="isMultipart">{{ $t('script.multipartTip') }}</span>
      <span class="api-switch-tip" v-else-if="queryMode === 'axios'">{{ $t('script.axiosTip') }}</span>
    </div>
    <!--js脚本示例-->
    <div>
      <div class="api-title" v-html="$t('script.JSExample')"></div>
      <editor-script :value="jsCode" :key="'js-' + queryMode"></editor-script>
    </div>
    <!--ts脚本示例-->
    <div>
      <div class="api-title" v-html="$t('script.TSExample')"></div>
      <editor-script :value="tsCode" :tsMode="true" :key="'ts-' + queryMode"></editor-script>
    </div>
  </div>
</template>
<script>
import {
  formatApi,
  getComment,
  upperFirstCase,
  getJsFunctionDeclaration,
  getTsInterfaceDeclaration,
  getTsFunctionDeclaration
} from '@/core/ScriptGenerator.js';
import { defineAsyncComponent} from 'vue'
import { useGlobalsStore } from '@/store/modules/global.js'

export default {
  name: "ScriptView",
  components: {
    "EditorScript": defineAsyncComponent(() => import('./EditorScript.vue'))
  },
  props: {
    api: {
      type: Object,
      required: true
    },
    swaggerInstance: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      jsCode: '',
      tsCode: '',
      // 参数拼接方式:axios(默认,由axios序列化query) / urlsearchparams(手动拼接)
      queryMode: 'axios',
      // multipart/form-data接口固定使用FormData提交,切换方式不生效
      isMultipart: false
    };
  },
  created() {
    // 文档页的接口二次解析已延后到空闲时段执行,用户若在解析完成前直接切到示例代码页,
    // 这里同步补齐一次,避免生成不完整的请求代码
    const swagger = useGlobalsStore().swagger;
    if (this.api != null && this.api != undefined && !this.api.init &&
      swagger != null && typeof swagger.initApiInfoAsync === 'function') {
      swagger.initApiInfoAsync(this.api);
    }
    this.generateCode();
  },
  methods: {
    generateCode() {
      // 格式化api数据
      const config = formatApi(this.api);
      const options = { queryMode: this.queryMode };
      this.isMultipart = config.isMultipart;

      let jsCode = '';
      let tsCode = '';
      try {
        const jsComment = getComment(this.api);
        const jsFun = getJsFunctionDeclaration(config, options);

        const interfaceName = upperFirstCase(`${config.name}`);
        const tsParamsInterface = config.bodyParams[0]
          ? '// 参数接口\n' + getTsInterfaceDeclaration(config.bodyParams[0], `${interfaceName}Params`, true)
          : ''; // 参数interface
        const tsResInterface = config.resParam
          ? '// 响应接口\n' + getTsInterfaceDeclaration(config.resParam, `${interfaceName}Res`, false)
          : ''; // 响应interface
        const tsComment = getComment(this.api); // 函数注释
        const tsFun = getTsFunctionDeclaration(config, interfaceName, options); // 函数本体

        jsCode = jsComment + jsFun;
        tsCode = tsParamsInterface + tsResInterface + tsComment + tsFun; // 函数本体
      } catch(err) {
        console.error(err);
      }
      this.jsCode = jsCode;
      this.tsCode = tsCode;
    }
  }
};
</script>
<style lang="less" scoped>
.api-switch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 14px;

  .api-switch-label {
    margin-right: 8px;
    font-weight: 600;
  }

  .api-switch-tip {
    margin-left: 12px;
    color: #d48806;
    font-size: 12px;
  }
}
.api-title {
  margin-top: 10px;
  margin-bottom: 5px;
  font-size: 16px;
  font-weight: 600;
  height: 30px;
  line-height: 30px;
  border-left: 4px solid #00ab6d;
  text-indent: 8px;
}
</style>
