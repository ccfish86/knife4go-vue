import KUtils from '../utils'

import { Knife4jOAS3ExampleInfo } from './OAS3BaseModel'

/**
 * OAS3.0规范解析响应example对象
 * 规范中的顺序：Media Type Object 上的 example / examples；
 * 若二者均未提供，则回退到 schema 上的 example / examples。
 * @param {*} source 媒体类型对象（Media Type Object），如 application/json 对应的对象
 * @param {*} components 当前文档的 components 节点，用于解析 examples 的 $ref
 * @param {*} schema 当前媒体类型的 schema，用于回退读取示例
 */
function Knife4jOAS3ResponseExampleReader(source, components, schema) {
    this.source = source;
    this.components = components || null;
    this.schema = schema || KUtils.propValue('schema', source || {}, null);
    this.hasExample = false;
    this.hasMoreExample = false;
    // 如果既存在example又存在examples，那么examples优先
    this.responseText = null;
    this.responseValue = null;
    this.responseTextArray = [];
    this.init();
}

/**
 * 解析
 * https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#mediaTypeObject
 */
Knife4jOAS3ResponseExampleReader.prototype.init = function () {
    if (KUtils.checkUndefined(this.source)) {
        let example = KUtils.propValue('example', this.source, null);
        let moreExample = KUtils.propValue('examples', this.source, null);
        if (KUtils.checkUndefined(moreExample)) {
            this.hasMoreExample = true;
            this.multipleExample(moreExample);
        }
        // example 与 examples 互斥，同时存在时以 examples 为准，但仍保留单一 example 作为兜底
        if (KUtils.checkUndefined(example)) {
            this.hasExample = true;
            this.oneExample(example);
        }
    }
    if (!this.hasExample && !this.hasMoreExample) {
        // 媒体类型未声明示例时，回退到 schema 级别示例
        let schemaExample = this.getSchemaExample();
        if (KUtils.checkUndefined(schemaExample)) {
            this.hasExample = true;
            this.oneExample(schemaExample);
        }
    }
    if (!this.hasExample && this.responseTextArray.length > 0) {
        // 仅存在多个示例时，默认展示第一个可用示例
        let first = this.responseTextArray.filter(item => KUtils.checkUndefined(item.example))[0];
        if (first) {
            this.oneExample(first.example);
        }
    }
};

/**
 * 读取 schema 级别的示例
 * 3.0 使用 example，3.1 支持 examples 数组
 */
Knife4jOAS3ResponseExampleReader.prototype.getSchemaExample = function () {
    let schema = this.schema;
    if (!KUtils.checkUndefined(schema)) {
        return null;
    }
    let example = KUtils.propValue('example', schema, null);
    if (KUtils.checkUndefined(example)) {
        return example;
    }
    let examples = KUtils.propValue('examples', schema, null);
    if (Array.isArray(examples) && examples.length > 0) {
        return examples[0];
    }
    return null;
}

/**
 * 解析 components 中的本地引用，如 #/components/examples/foo
 * @param {*} ref 引用地址
 */
Knife4jOAS3ResponseExampleReader.prototype.resolveRef = function (ref) {
    if (!KUtils.strNotBlank(ref) || !KUtils.checkUndefined(this.components)) {
        return null;
    }
    let prefix = '#/components/';
    if (!ref.startsWith(prefix)) {
        return null;
    }
    let paths = ref.substring(prefix.length).split('/');
    let current = this.components;
    for (let i = 0; i < paths.length; i++) {
        if (!KUtils.checkUndefined(current)) {
            return null;
        }
        current = current[paths[i]];
    }
    return KUtils.checkUndefined(current) ? current : null;
}

/**
 * 处理单个example
 * @param {*} example 示例值
 */
Knife4jOAS3ResponseExampleReader.prototype.oneExample = function (example) {
    if (KUtils.checkUndefined(example)) {
        this.responseText = example;
        this.responseValue = KUtils.json5stringifyFormat(example, null, '\t');
    }
}

/**
 * 处理多个example
 * 规范中 examples 的值是 Example Object，示例内容位于 value 字段
 * @param {*} moreExample 示例集合
 */
Knife4jOAS3ResponseExampleReader.prototype.multipleExample = function (moreExample) {
    if (!KUtils.checkUndefined(moreExample)) {
        return;
    }
    for (let key in moreExample) {
        let singleExample = moreExample[key];
        if (KUtils.checkUndefined(singleExample) && KUtils.strNotBlank(singleExample['$ref'])) {
            // examples 中的每一项允许使用 $ref 引用 components/examples
            singleExample = this.resolveRef(singleExample['$ref']) || {};
        }
        if (!KUtils.checkUndefined(singleExample)) {
            continue;
        }
        // summary 为可选字段，缺省时使用示例的 key 作为下拉框显示值
        let summary = KUtils.propValue('summary', singleExample, null) || key;
        let description = KUtils.propValue('description', singleExample, null);
        // 规范字段为 value，同时兼容部分框架错误输出为 example 的情况
        let value = KUtils.propValue('value', singleExample, null);
        if (!KUtils.checkUndefined(value)) {
            value = KUtils.propValue('example', singleExample, null);
        }
        let externalValue = KUtils.propValue('externalValue', singleExample, null);
        this.responseTextArray.push(new Knife4jOAS3ExampleInfo(summary, description, value, externalValue));
    }
}

export default Knife4jOAS3ResponseExampleReader;
