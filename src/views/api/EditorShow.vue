<template>
  <div>
    <editor :value="value" @init="editorInit" :lang="lang" theme="eclipse" width="100%" :style="{height: editorHeight + 'px'}"
      @input="change"></editor>
  </div>
</template>

<script>
import { VAceEditor } from 'vue3-ace-editor'
import ace from "ace-builds";
import modeJson from "ace-builds/src-noconflict/mode-json?url";
import modeXml from "ace-builds/src-noconflict/mode-xml?url";
import themeEclipse from "ace-builds/src-noconflict/theme-eclipse?url";
import extLanguageTools from "ace-builds/src-noconflict/ext-language_tools?url";

ace.config.setModuleUrl('ace/mode/json', modeJson)
ace.config.setModuleUrl('ace/mode/xml', modeXml)
ace.config.setModuleUrl('ace/theme/eclipse', themeEclipse)
ace.config.setModuleUrl('ace/ext-language/tools', extLanguageTools)

export default {
  name: "EditorShow",
  components: { editor: VAceEditor },
  props: {
    value: {
      type: [String, Object],
      required: true,
      default: ""
    },
    xmlMode: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  emits: ['showDescription', 'change'],
  data() {
    return {
      lang: "json",
      editor: null,
      editorHeight: 200
    };
  },
  watch: {
    // 内容可能在组件挂载后才到达(接口解析延后完成、切换示例等),需要按实际行数重算高度
    value: function () {
      if (this.editor != null) {
        this.resetEditorHeight();
      }
    }
  },
  methods: {
    change(value) {
      this.$emit("change", value);
    },
    resetEditorHeight() {
      const that = this
      // 重设高度
      setTimeout(() => {
        if (that.editor == null || that.editor.session == null) {
          return;
        }
        let length_editor = that.editor.session.getLength()
        if (length_editor == 1) {
          length_editor = 10;
        }
        // 行数未变化时不触发重排,避免每次输入都引起高度更新
        const newHeight = length_editor * 16;
        if (newHeight != that.editorHeight) {
          that.editorHeight = newHeight;
        }
      }, 300);
    },
    editorInit(editor) {
      const that = this
      this.editor = editor;
      // require("brace/ext/language_tools"); //language extension prerequsite...
      // require("brace/mode/json");
      // require("brace/mode/xml");
      if (this.xmlMode) {
        this.lang = "xml";
      }
      // require("brace/theme/eclipse");
      // 重设高度
      this.resetEditorHeight();
      this.editor.renderer.on("afterRender", function () {
        that.$emit("showDescription", "123")
      });
    }
  }
};
</script>
