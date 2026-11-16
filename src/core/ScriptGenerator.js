import {
  builders as t,
} from "ast-types";
import generate from "@babel/generator";

/**
 * 首字母大写
 * @param {string} str
 * @returns
 */
 export function upperFirstCase(str) {
  const temp = str.split('');
  temp[0] = temp[0].toUpperCase();
  return temp.join('');
}

/**
 * 将任意名称转换为合法的TypeScript/JavaScript标识符
 * operationId、参数名中可能包含 '-'、'.' 等字符（如 xxx-fm、page.size），
 * 直接作为函数名、变量名或类型名会生成非法代码
 * @param {string} name
 * @param {string} fallback
 */
export function toIdentifierName(name, fallback = 'apiParam') {
  let res = name === null || name === undefined ? '' : String(name).trim();
  if (res === '') {
    return fallback;
  }
  res = res.replace(/[^\w$]/g, '_');
  if (/^\d/.test(res)) {
    res = '_' + res;
  }
  return res;
}

/**
 * 获取参数在生成代码中的变量名
 * 变量名必须是合法标识符，而URL上的参数名需要保持原始值（如 page.size）
 * @param {object} param
 */
function getParamVariable(param) {
  return param.varName || toIdentifierName(param.name, 'param');
}

/**
 *  当url含有路径参数时候获取url数组
 * @param {string} url
 */
 export function getUrls(url) {
  const arr = url.split('{');
  const res = arr.map(u => {
    if(u.includes('}')) {
      return u.split('}')[1]
    }
    return u
  })
  return res;
}

/**
 * 获取字符串模板路径
 * @param {string} path
 */
function getTemplateElement(path) {
  return t.templateElement({ raw: path, cooked: path }, true)
}

/**
 * 构建request请求的路径参数
 * query参数不在这里拼接(数组参数直接拼进模板字符串会变成ids=1,2),
 * 统一由getQueryStatements生成URLSearchParams后追加
 * @param {array} urls
 * @param {array} pathParams
 * @param {object} queryExpr 查询字符串表达式(如queryParams.toString()),为null时不拼接query
 */
export function getTemplateUrl(urls, pathParams, queryExpr) {
  const quasis = [];
  const expressions = [];
  urls.map(u => quasis.push(getTemplateElement(u)));
  pathParams.map(p => expressions.push(t.identifier(getParamVariable(p))));
  if (queryExpr) {
    const last = quasis.pop();
    // 固定url中已带?时使用&拼接
    const sep = String(last.value.raw).indexOf('?') > -1 ? '&' : '?';
    quasis.push(getTemplateElement(last.value.raw + sep));
    expressions.push(queryExpr);
    quasis.push(getTemplateElement('')); // 结尾 必须
  }
  const templateUrl = t.templateLiteral(quasis, expressions);
  return templateUrl;
}

/**
 * 生成query参数的拼接语句
 * 数组参数(如ids=[1,2])用模板字符串直接拼接会生成ids=1,2,后端按数组解析会失败;
 * 对象参数直接拼接会变成[object Object]。这里用URLSearchParams处理:
 * 数组按同名key重复append(ids=1&ids=2)并自动编码,对象序列化为JSON字符串
 * @param {array} queryParams
 * @param {array} reservedNames 已被使用的变量名(path参数等),内部变量名需要避开
 * @returns {{statements: array, expr: object}} statements为需要插入函数体的语句,expr为查询字符串表达式
 */
export function getQueryStatements(queryParams, reservedNames) {
  const statements = [];
  if (!Array.isArray(queryParams) || queryParams.length === 0) {
    return { statements: statements, expr: null };
  }
  // 内部变量名需要避开同名请求参数,否则函数体内会重复声明
  const usedNames = [].concat(reservedNames || [], queryParams.map(query => getParamVariable(query)));
  let queryVar = 'queryParams';
  while (usedNames.indexOf(queryVar) > -1) {
    queryVar = '_' + queryVar;
  }
  // const queryParams = new URLSearchParams();
  statements.push(t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(queryVar),
      t.newExpression(t.identifier('URLSearchParams'), [])
    )
  ]));
  queryParams.forEach(query => {
    const varId = t.identifier(getParamVariable(query));
    const append = values => t.callExpression(
      t.memberExpression(t.identifier(queryVar), t.identifier('append')),
      [t.stringLiteral(query.name)].concat(values)
    );
    if (query.type === 'array') {
      // (Array.isArray(ids) ? ids : [ids]).filter(v => v != null).forEach(v => query.append('ids', v))
      const values = t.conditionalExpression(
        t.callExpression(t.memberExpression(t.identifier('Array'), t.identifier('isArray')), [varId]),
        varId,
        t.arrayExpression([varId])
      );
      const filtered = t.callExpression(
        t.memberExpression(values, t.identifier('filter')),
        [t.arrowFunctionExpression([t.identifier('v')], t.binaryExpression('!=', t.identifier('v'), t.nullLiteral()))]
      );
      statements.push(t.expressionStatement(t.callExpression(
        t.memberExpression(filtered, t.identifier('forEach')),
        [t.arrowFunctionExpression([t.identifier('v')], append([t.identifier('v')]))]
      )));
    } else if (query.type === 'object') {
      // query.append('filter', JSON.stringify(filter))
      statements.push(t.expressionStatement(append([t.callExpression(
        t.memberExpression(t.identifier('JSON'), t.identifier('stringify')),
        [varId]
      )])));
    } else {
      // query.append('page', String(page))
      // URLSearchParams只接受字符串,数字/布尔类型需要显式转换
      statements.push(t.expressionStatement(append([t.callExpression(
        t.identifier('String'),
        [varId]
      )])));
    }
  });
  return {
    statements: statements,
    expr: t.callExpression(t.memberExpression(t.identifier(queryVar), t.identifier('toString')), [])
  };
}

/**
 * 判断对象是否闭环，并获取闭环的属性名
 * @param {object} obj
 * @returns
 */
export function isLoopObject(obj) {
  let res = '';
  try {
    JSON.stringify(obj);
  }
  catch(err){
    res = err;
  }
  const resStr = res.toString();
  return {
    isLoop: resStr.indexOf('circular') === -1 ? false : true,
    loopPro: resStr && resStr.match(/property '(\S*)'/mg)[0].replace('property \'', '').replace('\'', '')
  }
}

/**
 * 获取响应参数
 * 引用类型通过schemaValue/refType匹配到模型后展开子属性
 * @param {array} resParams
 * @param {array} resRefParams
 * @param {array} refStack 当前展开路径上的模型名，用于中断循环引用
 */
function getResParams(resParams, resRefParams, refStack) {
  const params = [];
  if (!Array.isArray(resParams)) {
    return params;
  }
  const stack = Array.isArray(refStack) ? refStack : [];
  resParams.map(res => {
    const refName = res.schemaValue || res.refType;
    // 循环引用的模型不再展开，否则类型定义会无限递归
    if (!refName || stack.indexOf(refName) > -1) {
      params.push(res);
      return;
    }
    const schema = resRefParams.filter(ref => ref.name === refName)[0];
    // 模型没有可展开属性时保持原样，避免生成空类型字面量
    if (schema && Array.isArray(schema.params) && schema.params.length > 0) {
      res.children = schema.params
      getResParams(res.children, resRefParams, stack.concat([refName]))
    }
    params.push(res);
  })
  return params;
}

/**
 * 判断参数是否为文件类型
 * OAS2使用file/MultipartFile,OAS3使用binary格式
 * @param {object} parameter
 */
export function isFileParam(parameter) {
  if (!parameter) {
    return false;
  }
  const rawType = `${parameter.type || ''} ${parameter.schemaValue || ''}`.toLowerCase();
  return rawType.indexOf('multipartfile') > -1
    || rawType.indexOf('file') > -1
    || rawType.indexOf('binary') > -1;
}

/**
 * 判断接口是否为multipart/form-data请求
 * 解析阶段会给multipart接口设置contentType=multipart/form-data、contentValue=form-data,
 * 部分场景只能通过参数类型(MultipartFile/file)识别
 * @param {object} api
 */
export function isMultipartRequest(api) {
  if (!api) {
    return false;
  }
  const contentType = String(api.contentType || '').toLowerCase();
  if (contentType.indexOf('multipart/form-data') > -1 || api.contentValue === 'form-data') {
    return true;
  }
  const consumes = Array.isArray(api.consumes) ? api.consumes : [];
  if (consumes.some(consume => String(consume).toLowerCase().indexOf('multipart/form-data') > -1)) {
    return true;
  }
  return Array.isArray(api.parameters) && api.parameters.some(parameter => isFileParam(parameter));
}

/**
 * 获取函数配置
 * @param {obj} api
 * @returns
 */
export function formatApi(api) {
  // console.log(api);
  // operationId可能包含 '-'、'.' 等字符，直接作为函数名/接口名会生成非法代码；缺失时用method+url兜底
  const rawName = api.operationId
    ? String(api.operationId).split('Using')[0]
    : `${api.methodType || 'api'}${api.url || ''}`;
  // multipart/form-data必须用FormData提交,不能拼query
  const multipart = isMultipartRequest(api);
  const config = {
    name: toIdentifierName(rawName, 'api'), // 函数名称
    method: String(api.methodType || 'get').toLowerCase(), // http方法;
    url: api.url,
    pathParams: [], // path请求参数
    queryParams: [], // query请求参数
    bodyParams: [], // body请求参数
    formParams: [], // multipart表单字段
    isMultipart: multipart, // 是否multipart/form-data请求
    contentType: multipart ? 'multipart/form-data' : (api.contentType || 'application/json'), // 请求数据类型
    resParam: {}, // res响应参数
  };
  if(Array.isArray(api.parameters)) {
    api.parameters.map(p => {
      if (p.in === 'path') {
        config.pathParams.push({
          name: p.name,
          varName: toIdentifierName(p.name, 'id'),
          type: getBaseType(p.type),
          in: 'path'
        });
        return;
      }
      if (multipart) {
        // OAS3解析后表单字段的in会被改写为query,OAS2为formData;文件字段统一走表单
        if (p.in === 'query' || p.in === 'formData' || p.in === 'body') {
          config.formParams.push({
            name: p.name,
            varName: toIdentifierName(p.name, 'field'),
            type: getBaseType(p.type),
            rawType: p.type,
            isFile: isFileParam(p)
          });
        }
        return;
      }
      if (p.in === 'query') {
        config.queryParams.push({
          name: p.name,
          varName: toIdentifierName(p.name, 'query'),
          type:  getBaseType(p.type),
          in: 'query'
        });
        return;
      }
      config.bodyParams.push({
        name: 'params',
        type:  p.type === 'array' ? 'array' : 'object',
        children: p.children
      });
    })
  }
  if(Array.isArray(api.responseCodes)) {
    // let loopObj = {}; // 被循环引用的对象
    // const resRefParamsTemp = api.responseRefParameters.map(ref =>
    //   ref.params && ref.params.map(param => {
    //     const { isLoop, loopPro } = isLoopObject(param);
    //     if(isLoop) {
    //       // loopObj = param[loopPro];
    //       param[loopPro] = null; // 解除循环应用
    //     }
    //     return param;
    //   })
    // )
    let type = '';
    if(api.responseJson instanceof Array) {
      type = 'array';
    } else if(api.responseJson instanceof Object) {
      type = 'object';
    } else if(api.responseBasicType && api.responseText) {
      // 响应体是基础类型（如 string、number）时直接使用其类型，避免生成空接口
      type = getBaseType(api.responseText);
    }
    // else {
    //   throw new Error('类型不正确')
    // }
    config.resParam = {
      name: 'res',
      type,
      children: getResParams(api.responseParameters, api.responseRefParameters)
    };
  }
  return config
}

/**
 * 获取基本类型
 * 文档解析阶段会在类型后追加format（如 string(date-time)、integer(int64)），
 * 且不同框架输出的类型名不统一，这里统一归一化为TypeScript可用的基础类型
 * @param {string} type
 */
export function getBaseType(type) {
  if (type === null || type === undefined) {
    return 'any';
  }
  let raw = String(type).trim();
  if (raw === '') {
    return 'any';
  }
  // 去掉format后缀
  const formatMatch = raw.match(/^([A-Za-z_$][\w$.]*)\s*\((.*)\)$/);
  if (formatMatch) {
    raw = formatMatch[1];
  }
  const lower = raw.toLowerCase();
  switch(lower) {
    case 'string':
    case 'char':
    case 'character':
    case 'uuid':
    case 'text':
    case 'byte':
    case 'binary':
    case 'password':
    case 'email':
    case 'date':
    case 'time':
    case 'datetime':
    case 'timestamp':
      return 'string';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'number':
    case 'integer':
    case 'int':
    case 'long':
    case 'short':
    case 'bigdecimal':
    case 'biginteger':
    case 'decimal':
    case 'double':
    case 'float':
      return 'number';
    case 'array':
    case 'list':
    case 'set':
    case 'collection':
      return 'array';
    case 'object':
    case 'map':
    case 'json':
    case 'any':
      return 'object';
    default:
      break;
  }
  // 日期时间类引用类型（如 java.time.LocalDateTime）按字符串处理
  if (/date|time/i.test(lower)) {
    return 'string';
  }
  // 其余视为引用类型，后续按对象展开
  return 'object';
}

/**
 * 获取引用类型
 * @param {string} name
 * @returns
 */
function getReferenceTSType (name) {
  return t.tsTypeReference(t.identifier(name))
}

/**
 * 获取基础类型对应的TypeScript类型节点
 * @param {string} type
 */
function getSimpleTsType(type) {
  const baseType = getBaseType(type);
  if (baseType === 'array') {
    return t.tsArrayType(t.tsAnyKeyword());
  }
  if (baseType === 'object' || baseType === 'any') {
    // object/any 这类名称不是有效的TS类型引用，回退为any
    return t.tsAnyKeyword();
  }
  return getReferenceTSType(baseType);
}

/**
 * 获取属性名节点
 * 非法标识符需要转换成字符串字面量（如 "user-name": string）
 * @param {string} name
 */
function getPropertyKey(name) {
  const key = name === null || name === undefined ? '' : String(name);
  if (/^[A-Za-z_$][\w$]*$/.test(key)) {
    return t.identifier(key);
  }
  return t.stringLiteral(key);
}

/**
 * 获取泛型body参数
 * @param {array} props
 * @param {boolean} openOptional
 */
export function getInterfaceBody(props, openOptional) {
 return props.map(p => {
    return t.tsPropertySignature(
      getPropertyKey(p.name),
      t.tsTypeAnnotation(getTsType(p, getBaseType(p.type), openOptional)),
      openOptional ? !p.require : false,
    )
  })
}

/**
 * 获取ts类型
 * @param {object} prop
 * @param {string} type
 * @param {boolean} openOptional
 */
export function getTsType(prop, type, openOptional) {
  const baseType = ['boolean', 'string', 'number'];
  if (baseType.includes(type)) {
    return getReferenceTSType(type);
  }
  if (type === 'any') {
    return t.tsAnyKeyword();
  }
  // 空children不能作为类型字面量，否则会生成不可用的 {} 类型
  const children = Array.isArray(prop.children) && prop.children.length > 0 ? prop.children : null;
  if (type === 'object') {
    if(children) {
      const InterfaceBody = getInterfaceBody(children, openOptional);
      return t.tsTypeLiteral(InterfaceBody);
    } else {
      // 无法解析出结构时使用any，避免Record<string, unknown>导致字段无法直接访问
      return t.tsAnyKeyword();
    }
  }
  if (type === 'array') {
    if(children) {
      const InterfaceBody = getInterfaceBody(children, openOptional);
      return t.tsArrayType(t.tsTypeLiteral(InterfaceBody));
    } else {
      // 基础类型数组直接使用对应类型，如 string[]
      const itemType = getBaseType(prop.schemaValue || prop.refType || '');
      if (baseType.includes(itemType)) {
        return t.tsArrayType(getReferenceTSType(itemType));
      }
      return t.tsArrayType(t.tsAnyKeyword());
    }
  }
  return getReferenceTSType(type);
}

/**
 * 获取子属性注释
 * @param {object} common
 * @param {object} data
 * @param {string} parent
 * @returns
 */
function getChildCommon(common, data, parent) {
  if(Array.isArray(data)) {
    data.map(child=>{
      common += ` * @param {${getBaseType(child.type)}} ${parent}.${child.name} ${child.description}\n`
      getChildCommon(common, child.children, `${parent}.${child.name}`)
    })
  }
  return common
}

/**
 * 获取注释
 * @param {object} api
 * @returns
 */
export function getComment(api) {
  const { summary, parameters } = api;
  let common = ``;
  // 构造函数注释
  common += `/** \n`
  common += ` * ${summary}\n`
  Array.isArray(parameters) && parameters.map(parameter => {
    if(parameter.in === 'path') {
      // path/query参数合并为对象参数，注释里的属性名保持接口原始定义
      common += ` * @param {string} params.${parameter.name} ${parameter.description}\n `
    }
    if(parameter.in === 'query') {
      common += ` * @param {string} params.${parameter.name} ${parameter.description}\n `
    }
    if(parameter.in === 'formData') {
      // multipart表单字段:文件类型标注file,其余按基础类型
      common += ` * @param {${isFileParam(parameter) ? 'file' : getBaseType(parameter.type)}} params.${parameter.name} ${parameter.description}\n `
    }
    if(parameter.in === 'body') {
      const bodyType = parameter.type === 'array' ? 'array' : 'object';
      const hasChildren = Array.isArray(parameter.children) && parameter.children.length > 0;
      if(bodyType === 'array' || hasChildren || parameter.type === 'object') {
        common += ` * @param {${bodyType}} params ${parameter.description}\n`
        if(bodyType === 'object') {
          common = getChildCommon(common, parameter.children, 'params')
        }
      }
    }
  })
  common += ` * @returns\n`
  common += ` */\n`
  return common;
}

/**
 * 获取参数对应的TypeScript类型节点
 * 参数类型已在formatApi中归一化为string/number/boolean/array/object
 * @param {object} param
 * @returns
 */
function getTypeAnnotationNode(param) {
  const baseType = getBaseType(param.type);
  if (baseType === 'array') {
    return t.tsArrayType(t.tsAnyKeyword());
  }
  if (baseType === 'object' || baseType === 'any') {
    // 自定义类型（如 xxxParams）保留类型名，object/any 这类基础名称回退为any
    const rawName = toIdentifierName(param.type, '');
    return rawName !== '' && rawName !== 'object' && rawName !== 'any'
      ? t.tsTypeReference(t.identifier(rawName))
      : t.tsAnyKeyword();
  }
  return t.tsTypeReference(t.identifier(baseType));
}

/**
 * 获取类型注释
 * @param {object} param
 * @returns
 */
export function getTypeAnnotation (param) {
  // 参数名可能是 file-id、page.size 等非法标识符，需要转换后才能生成变量
  let arg = t.identifier(toIdentifierName(param.name, 'params'));
  // TS类型注解需要使用tsTypeAnnotation，否则Flow类型校验会报错
  arg.typeAnnotation = t.tsTypeAnnotation(getTypeAnnotationNode(param));
  return arg;
}

/**
 * 将参数转换为同名对象属性，名称合法且未改名时使用简写
 * @param {array} params
 */
function getObjectProperties(params) {
  return params.map(param => {
    const key = getPropertyKey(param.name);
    const value = t.identifier(getParamVariable(param));
    const prop = t.objectProperty(key, value);
    // 名称合法且未改名时使用简写 { ids }，否则输出 { 'user-tags': user_tags }
    prop.shorthand = key.type === 'Identifier' && key.name === value.name;
    return prop;
  })
}

/**
 * 将path/query参数转换为对象解构属性
 * 键保持接口原始参数名(如'user-tags')，变量名使用合法标识符(user_tags)
 * @param {array} params
 */
function getObjectPatternProperties(params) {
  return getObjectProperties(params);
}

/**
 * 构建axios请求配置对象: { params: { page, ids } }
 * axios会自行序列化query参数(null/undefined会被忽略),
 * 数组需要在axios实例配置 paramsSerializer.indexes = null,否则会序列化成ids[]=1
 * @param {array} queryParams
 */
function getAxiosConfigExpression(queryParams) {
  return t.objectExpression([
    t.objectProperty(t.identifier('params'), t.objectExpression(getObjectProperties(queryParams)))
  ]);
}

/**
 * 获取请求体参数变量名
 * 与path/query解构出来的变量重名时需要避让，否则会重复声明
 * @param {array} inputParams
 */
function getBodyParamName(inputParams) {
  const usedNames = inputParams.map(param => getParamVariable(param));
  const candidates = ['params', 'data', 'body'];
  const matched = candidates.filter(name => usedNames.indexOf(name) === -1);
  return matched.length > 0 ? matched[0] : 'requestBody';
}

/**
 * 获取FormData变量名
 * 与解构出来的字段变量重名时需要避让,否则会重复声明
 * @param {array} fields
 */
function getFormDataName(fields) {
  const usedNames = fields.map(field => getParamVariable(field));
  let formDataName = 'formData';
  while (usedNames.indexOf(formDataName) > -1) {
    formDataName = '_' + formDataName;
  }
  return formDataName;
}

/**
 * 生成formData.append语句
 * FormData只接受string/Blob,基础类型需转字符串,对象转JSON字符串,文件类型直接append
 * @param {string} formDataName
 * @param {object} param
 */
function getFormAppendStatements(formDataName, param) {
  const varId = t.identifier(getParamVariable(param));
  // 箭头函数体需要表达式,语句则在外层加expressionStatement
  const appendExpression = value => t.callExpression(
    t.memberExpression(t.identifier(formDataName), t.identifier('append')),
    [t.stringLiteral(param.name), value]
  );
  const appendStatement = value => t.expressionStatement(appendExpression(value));
  if (param.type === 'array') {
    // 数组字段(如多文件)按同名key重复append
    const values = t.conditionalExpression(
      t.callExpression(t.memberExpression(t.identifier('Array'), t.identifier('isArray')), [varId]),
      varId,
      t.arrayExpression([varId])
    );
    const filtered = t.callExpression(
      t.memberExpression(values, t.identifier('filter')),
      [t.arrowFunctionExpression([t.identifier('v')], t.binaryExpression('!=', t.identifier('v'), t.nullLiteral()))]
    );
    const itemValue = param.isFile ? t.identifier('v') : t.callExpression(t.identifier('String'), [t.identifier('v')]);
    return [t.expressionStatement(t.callExpression(
      t.memberExpression(filtered, t.identifier('forEach')),
      [t.arrowFunctionExpression([t.identifier('v')], appendExpression(itemValue))]
    ))];
  }
  if (param.isFile) {
    return [appendStatement(varId)];
  }
  if (param.type === 'object') {
    // 表单里的复杂对象按JSON字符串提交
    return [appendStatement(t.callExpression(
      t.memberExpression(t.identifier('JSON'), t.identifier('stringify')),
      [varId]
    ))];
  }
  return [appendStatement(t.callExpression(t.identifier('String'), [varId]))];
}

/**
 * 构建multipart/form-data请求参数
 * multipart不能使用URLSearchParams,需要用FormData拼装字段并指定Content-Type
 * @param {object} api
 * @param {array} funParams 函数参数
 * @param {array} requestParams 请求参数
 * @param {array} statements 函数体语句
 * @param {boolean} withTypeAnnotation 是否生成TS类型注解
 */
function buildMultipartRequest(api, funParams, requestParams, statements, withTypeAnnotation) {
  const { url, pathParams, queryParams, formParams } = api;
  const fields = [].concat(pathParams, queryParams || [], formParams || []);
  // path/query/form字段合并为一个对象参数
  if (fields.length > 0) {
    const pattern = t.objectPattern(getObjectPatternProperties(fields));
    if (withTypeAnnotation) {
      pattern.typeAnnotation = t.tsTypeAnnotation(t.tsTypeLiteral(
        fields.map(param => t.tsPropertySignature(
          getPropertyKey(param.name),
          t.tsTypeAnnotation(getTypeAnnotationNode(param)),
          // path参数必填,query/form字段按可选处理
          param.in !== 'path'
        ))
      ));
    }
    funParams.push(pattern);
  }
  // const formData = new FormData();
  const formDataName = getFormDataName(fields);
  statements.push(t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(formDataName),
      t.newExpression(t.identifier('FormData'), [])
    )
  ]));
  // formData.append('file', file)
  (formParams || []).forEach(param => {
    statements.push(...getFormAppendStatements(formDataName, param));
  });
  // request.post(`/common/upload/image`, formData, { headers: {...} })
  requestParams.push(getTemplateUrl(getUrls(url), pathParams, null));
  requestParams.push(t.identifier(formDataName));
  const configProps = [];
  if (queryParams && queryParams.length > 0) {
    configProps.push(t.objectProperty(t.identifier('params'), t.objectExpression(getObjectProperties(queryParams))));
  }
  configProps.push(t.objectProperty(t.identifier('headers'), t.objectExpression([
    t.objectProperty(t.stringLiteral('Content-Type'), t.stringLiteral('multipart/form-data'))
  ])));
  requestParams.push(t.objectExpression(configProps));
}

/**
 * js函数构造器
 * @param {object} api
 * @param {object} options queryMode: axios(默认,交给axios序列化query) | urlsearchparams(手动拼接)
 * @returns
 */
export function getJsFunctionDeclaration(api, options) {
  const {
    name,
    method,
    url,
    pathParams,
    queryParams,
    bodyParams,
  } = api;
  const opts = options || {};
  // 默认把query交给axios的params参数,传queryMode='urlsearchparams'时改为手动拼接
  const useAxiosParams = opts.queryMode !== 'urlsearchparams';

  const funParams = [];
  const requestParams = [];
  const statements = [];
  if (api.isMultipart) {
    // multipart/form-data必须用FormData+Content-Type提交,不能使用URLSearchParams
    buildMultipartRequest(api, funParams, requestParams, statements, false);
  } else {
    const inputParams = [].concat(pathParams, queryParams);
    // axios模式:query由axios序列化;URLSearchParams模式:避免数组参数被拼成ids=1,2
    const queryInfo = useAxiosParams
      ? { statements: [], expr: null }
      : getQueryStatements(queryParams, inputParams.map(param => getParamVariable(param)));
    statements.push(...queryInfo.statements);
    // 构建request请求的路径参数
    requestParams.push(getTemplateUrl(getUrls(url), pathParams, queryInfo.expr));
    // path/query参数合并为一个对象参数{ id, page },避免参数名和顺序被固定
    if (inputParams.length > 0) {
      funParams.push(t.objectPattern(getObjectPatternProperties(inputParams)));
    }
    const bodyName = getBodyParamName(inputParams);
    bodyParams.map(() => {
      const temp = t.identifier(bodyName);
      funParams.push(temp);
      requestParams.push(temp);
    })
    // axios模式:query参数作为请求config的params字段传入
    if (useAxiosParams && queryParams.length > 0) {
      requestParams.push(getAxiosConfigExpression(queryParams));
    }
  }
  const declaration = t.functionDeclaration(
    t.identifier(name),
    funParams,
    t.blockStatement([].concat(statements, [
      t.returnStatement(
        t.callExpression( // 方法调用
          t.memberExpression(
            t.identifier('request'),
            t.identifier(method),
          ),
          requestParams,
        )
      )
    ])))
  return generate(t.exportNamedDeclaration(declaration)).code;
}

/**
 * 生成ts接口
 * @param {object} prop
 * @param {string} interfaceName
 * @param {boolean} openOptional 是否开启可选
 * @returns
 */
export function getTsInterfaceDeclaration(prop, interfaceName, openOptional) {
  // 接口名可能包含非法字符，需要归一化后才能生成合法代码
  const name = t.identifier(toIdentifierName(interfaceName, 'ApiType'));
  const children = Array.isArray(prop.children) && prop.children.length > 0 ? prop.children : null;
  let declaration = null;
  if (!children) {
    // 没有可展开的子属性时生成类型别名，避免出现空interface或Record<string, unknown>这类不可用类型
    declaration = t.tsTypeAliasDeclaration(name, getSimpleTsType(prop.type));
  } else {
    declaration = t.tsInterfaceDeclaration(
      name,
      t.tsInterfaceBody(getInterfaceBody(children, openOptional)),
    )
  }
  return generate(t.exportNamedDeclaration(declaration)).code + '\n\n';
}

/**
 * ts函数构造器
 * @param {object} api
 * @param {string} interfaceName
 * @param {object} options queryMode: axios(默认,交给axios序列化query) | urlsearchparams(手动拼接)
 * @returns
 */
 export function getTsFunctionDeclaration(api, interfaceName, options) {
  const {
    name,
    method,
    url,
    pathParams,
    queryParams,
    bodyParams,
    resParam,
  } = api;
  const opts = options || {};
  // 默认把query交给axios的params参数,传queryMode='urlsearchparams'时改为手动拼接
  const useAxiosParams = opts.queryMode !== 'urlsearchparams';

  const funParams = [];
  const requestParams = [];
  const statements = [];
  if (api.isMultipart) {
    // multipart/form-data必须用FormData+Content-Type提交,不能使用URLSearchParams
    buildMultipartRequest(api, funParams, requestParams, statements, true);
  } else {
    const inputParams = [].concat(pathParams, queryParams);
    // axios模式:query由axios序列化;URLSearchParams模式:避免数组参数被拼成ids=1,2
    const queryInfo = useAxiosParams
      ? { statements: [], expr: null }
      : getQueryStatements(queryParams, inputParams.map(param => getParamVariable(param)));
    statements.push(...queryInfo.statements);
    // 构建request请求的路径参数
    requestParams.push(getTemplateUrl(getUrls(url), pathParams, queryInfo.expr));
    // path/query参数合并为一个对象参数: ({ id, page }: { id: string; page?: number })
    if (inputParams.length > 0) {
      const pattern = t.objectPattern(getObjectPatternProperties(inputParams));
      pattern.typeAnnotation = t.tsTypeAnnotation(t.tsTypeLiteral(
        inputParams.map(param => t.tsPropertySignature(
          getPropertyKey(param.name),
          t.tsTypeAnnotation(getTypeAnnotationNode(param)),
          // path参数必填,query参数按可选处理
          param.in !== 'path'
        ))
      ));
      funParams.push(pattern);
    }
    const bodyName = getBodyParamName(inputParams);
    bodyParams.map(param => {
      // 指定接口类型名称：数组请求体用any[]，对象请求体用自动生成的Params接口
      const bodyType = param.type === 'array' ? 'array' : `${interfaceName}Params`;
      funParams.push(getTypeAnnotation({ name: bodyName, type: bodyType }));
      requestParams.push(t.identifier(bodyName));
    })
    // axios模式:query参数作为请求config的params字段传入
    if (useAxiosParams && queryParams.length > 0) {
      requestParams.push(getAxiosConfigExpression(queryParams));
    }
  }
  const declaration = t.functionDeclaration(
    t.identifier(name),
    funParams,
    t.blockStatement([].concat(statements, [
      t.returnStatement(
        t.callExpression( // 方法调用
          t.memberExpression(
            t.identifier('request'),
            t.identifier(method),
          ),
          requestParams,
        )
      )
    ]))
  )
  const resType = resParam.type === 'array' ? `${interfaceName}Res[]` : `${interfaceName}Res`;
  declaration.returnType = t.tsTypeAnnotation(
    t.tsTypeReference(
      t.identifier('Promise'),
      t.tsTypeParameterInstantiation( //泛型
        [t.tsTypeReference(
          t.identifier(resType),
        )]
      )
    )
  )
  return generate(t.exportNamedDeclaration(declaration)).code;
}
