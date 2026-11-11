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
 * @param {array} urls
 * @param {array} pathParams
 * @param {array} queryParams
 */
export function getTemplateUrl(urls, pathParams, queryParams) {
  let templateUrl = null;
  const quasis = [];
  const expressions = [];
  // 既不存在path也不存在query参数时
  if(pathParams.length === 0 && queryParams.length === 0) {
    urls.map(u => quasis.push(getTemplateElement(u)));
  }
  // 存在path但不存在query参数时
  else if(pathParams.length > 0 && queryParams.length === 0) {
    urls.map(u => quasis.push(getTemplateElement(u)));
    pathParams.map(p => expressions.push(t.identifier(getParamVariable(p))));
  }
  // 存在query但不存在path参数时
  else if(pathParams.length === 0 && queryParams.length > 0) {
    // 针对第一项的query特殊处理 /url/path?name=name
    quasis.push(getTemplateElement(`${urls[0]}?${queryParams[0].name}=`));
    expressions.push(t.identifier(getParamVariable(queryParams[0])));
    // 第一项以后的处理方式
    queryParams.map((query, index) => {
      if(index > 0) {
        quasis.push(getTemplateElement(`&${query.name}=`));
        expressions.push(t.identifier(getParamVariable(query)));
      }
    })
    quasis.push(getTemplateElement('')); // 结尾 必须
  }
  // 既存在path也存在query时
  else {
    urls.map((u, i) => {
      // 针对最后一个url特殊处理
      if(i + 1 === urls.length) {
        quasis.push(getTemplateElement(`${u}?${queryParams[0].name}=`));
      } else {
        quasis.push(getTemplateElement(u));
      }
    });
    pathParams.map(p => expressions.push(t.identifier(getParamVariable(p))));
    expressions.push(t.identifier(getParamVariable(queryParams[0])));
    queryParams.map((q, i) =>{
      if(i > 0) {
        quasis.push(getTemplateElement(`&${q.name}=`));
        expressions.push(t.identifier(getParamVariable(q)));
      }
    })
    quasis.push(getTemplateElement('')); // 结尾 必须
  }
  templateUrl = t.templateLiteral(quasis, expressions);
  return templateUrl;
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
  const config = {
    name: toIdentifierName(rawName, 'api'), // 函数名称
    method: String(api.methodType || 'get').toLowerCase(), // http方法;
    url: api.url,
    pathParams: [], // path请求参数
    queryParams: [], // query请求参数
    bodyParams: [], // body请求参数
    resParam: {}, // res响应参数
  };
  if(Array.isArray(api.parameters)) {
    api.parameters.map(p => {
      switch(p.in) {
        case 'path':
          config.pathParams.push({
            name: p.name,
            varName: toIdentifierName(p.name, 'id'),
            type: getBaseType(p.type)
          });
          break;
        case 'query':
          config.queryParams.push({
            name: p.name,
            varName: toIdentifierName(p.name, 'query'),
            type:  getBaseType(p.type)
          });
          break;
        default:
          config.bodyParams.push({
            name: 'params',
            type:  p.type === 'array' ? 'array' : 'object',
            children: p.children
          });
          break;
      }
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
      // 实际生成的变量名可能已被转成合法标识符（如 order-id -> order_id），注释需保持一致
      common += ` * @param {string} ${toIdentifierName(parameter.name, 'param')} ${parameter.description}\n `
    }
    if(parameter.in === 'query') {
      common += ` * @param {string} ${toIdentifierName(parameter.name, 'param')} ${parameter.description}\n `
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
 * 获取类型注释
 * @param {object} param
 * @returns
 */
export function getTypeAnnotation (param) {
  // 参数名可能是 file-id、page.size 等非法标识符，需要转换后才能生成变量
  let arg = t.identifier(toIdentifierName(param.name, 'params'));
  const baseType = getBaseType(param.type);
  let annotation = null;
  if (baseType === 'array') {
    annotation = t.tsArrayType(t.tsAnyKeyword());
  } else if (baseType === 'object' || baseType === 'any') {
    // 自定义类型（如 xxxParams）保留类型名，object/any 这类基础名称回退为any
    const rawName = toIdentifierName(param.type, '');
    annotation = rawName !== '' && rawName !== 'object' && rawName !== 'any'
      ? t.tsTypeReference(t.identifier(rawName))
      : t.tsAnyKeyword();
  } else {
    annotation = t.tsTypeReference(t.identifier(baseType));
  }
  // TS类型注解需要使用tsTypeAnnotation，否则Flow类型校验会报错
  arg.typeAnnotation = t.tsTypeAnnotation(annotation);
  return arg;
}

/**
 * js函数构造器
 * @param {object} api
 * @returns
 */
export function getJsFunctionDeclaration(api) {
  const {
    name,
    method,
    url,
    pathParams,
    queryParams,
    bodyParams,
  } = api;

  const funParams = [];
  const requestParams = [];
  // 构建request请求的路径参数
  requestParams.push(getTemplateUrl(getUrls(url), pathParams, queryParams));
  [].concat(pathParams, queryParams).map(param => {
    funParams.push(t.identifier(getParamVariable(param)));
  })
  bodyParams.map(param => {
    const temp = t.identifier(toIdentifierName(param.name, 'params'));
    funParams.push(temp);
    requestParams.push(temp);
  })
  const declaration = t.functionDeclaration(
    t.identifier(name),
    funParams,
    t.blockStatement([
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
 * @returns
 */
 export function getTsFunctionDeclaration(api, interfaceName) {
  const {
    name,
    method,
    url,
    pathParams,
    queryParams,
    bodyParams,
    resParam,
  } = api;

  const funParams = [];
  const requestParams = [];
  // 构建request请求的路径参数
  requestParams.push(getTemplateUrl(getUrls(url), pathParams, queryParams));
  [].concat(pathParams, queryParams).map(param => {
    funParams.push(getTypeAnnotation(param));
  })
  bodyParams.map(param => {
    // 指定接口类型名称：数组请求体用any[]，对象请求体用自动生成的Params接口
    const bodyType = param.type === 'array' ? 'array' : `${interfaceName}Params`;
    funParams.push(getTypeAnnotation({ name: param.name, type: bodyType }));
    requestParams.push(t.identifier(toIdentifierName(param.name, 'params')));
  })
  const declaration = t.functionDeclaration(
    t.identifier(name),
    funParams,
    t.blockStatement([
      t.returnStatement(
        t.callExpression( // 方法调用
          t.memberExpression(
            t.identifier('request'),
            t.identifier(method),
          ),
          requestParams,
        )
      )
    ])
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
