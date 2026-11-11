#### 安装
```
yarn install
```

#### 开发
```
yarn dev
```
访问 `http://localhost:5173/doc.html`

#### 打包
```
yarn build
```

参考
https://github.com/xiaoymin/knife4j/tree/dev/knife4j-vue3

#### 变更履历

##### 4.6.0（2026-11-11）

**工程化与构建**

- 技术栈升级：Vue 3.5 + Vite 7 + Pinia 3 + vue-i18n 11 + marked 18 + mermaid 12 + ace 1.45，要求 Node >= 20.19.0
- 改用 pnpm 管理依赖并提交 `pnpm-lock.yaml`，移除或替换不再使用的依赖
- `vite.config.js`：使用 `fileURLToPath` 解析别名；`nodePolyfills` 按需注入；使用 `vite-plugin-compression2` 生成 gzip；按库拆分 vendor chunk（vue/antd/ace/lodash/marked），重型懒加载依赖交由 rollup 自动分组，避免首屏提前加载
- 构建目标下调至 `es2018` / `chrome80` CSS，兼容内嵌旧系统场景；AntDesignVueResolver 改为按需引入样式，关闭 dts 生成

**部署路径**

- 修复 `doc.html` 部署在子路径（context-path）时 `v3/api-docs/swagger-config` 地址拼接错误

**OpenAPI 3 解析增强**

- 新增引用工具方法（`isRef` / `getRefName` / `resolveRef` / `normalizeSchema`），支持文档内 JSON Pointer 引用解析
- 支持 `allOf` / `oneOf` / `anyOf` 组合 schema 的属性合并，模型详情、请求参数、响应结构、代码生成统一生效
- 支持 OAS 3.1 的 `type` 数组（如 `["string","null"]`）
- `components` 缺失时容错；`requestBody`、`responses`、`headers`、`examples`、媒体类型对象支持 `$ref`
- 结构化 JSON 请求体作为单个 body 参数展示，并自动生成请求 JSON 骨架与字段列表
- 支持 `servers[].variables` 默认值替换；OpenApi 页签补齐 `security` / `tags` / `externalDocs` 展示
- 安全方案按规范处理请求位置：`http`(basic/bearer)、`openIdConnect` 统一使用 `Authorization` 头；接口未声明 `security` 时继承根级配置，安全方案去重
- 兼容 `x-setting` 为对象写法、`x-ignoreParameters` / `x-includeParameters` 为数组或对象的写法，忽略非法的 `x-order`
- 支持 OAS3 平铺在节点上的 `x-*` 扩展属性读取

**响应示例与文档展示**

- 响应示例按规范优先读取媒体类型的 `example` / `examples`（示例内容取 `value` 字段、支持 `$ref`、`summary` 缺省时使用 key），均未提供时回退到 schema 级示例
- 多状态码响应按页签展示，标题为「状态码 + 描述」，默认选中 2xx 响应；无多状态码时优先展示成功响应
- 同一响应存在多个命名示例时提供下拉框切换
- 修复响应媒体类型收集不全、数组标记跨状态码污染的问题

**代码生成**

- 参数名、operationId、接口名转换为合法标识符，URL 上仍保留原始参数名；注释 `@param` 与实际生成的变量名保持一致
- 非法属性名生成字符串字面量；TS 类型注解改用 `tsTypeAnnotation`，基础类型数组生成 `string[]` 等准确类型，`object` / `any` 回退为 `any`，避免出现空 interface 与 `Record<string, unknown>`

**Markdown / Mermaid**

- 适配 marked 12+ 的 renderer token 签名，代码块内容做 HTML 转义
- mermaid 改为动态 `import` 按需加载 + 异步渲染，语法错误时降级为普通代码块

**其他**

- 清理前端控制台调试日志

##### 4.6.0 之前

- 基于上游 `knife4j-vue3` 复用代码，作为本项目基线版本