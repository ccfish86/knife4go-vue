/* eslint no-useless-escape:0 */
import md5 from 'js-md5'
import JSON5 from './json5.js'
import isObject from 'lodash/isObject'
import isNumber from 'lodash/isNumber'

const reg = /(((^https?:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)$/g;
const binaryContentType = {
  "application/octet-stream": true,
  "application/x-001": true,
  "text/h323": true,
  "drawing/907": true,
  "audio/x-mei-aac": true,
  "audio/aiff": true,
  "text/asa": true,
  "text/asp": true,
  "audio/basic": true,
  "application/vnd.adobe.workflow": true,
  "application/x-bmp": true,
  "application/x-c4t": true,
  "application/x-cals": true,
  "application/x-netcdf": true,
  "application/x-cel": true,
  "application/x-g4": true,
  "application/x-cit": true,
  "text/xml": true,
  "application/x-cmx": true,
  "application/pkix-crl": true,
  "application/x-csi": true,
  "application/x-cut": true,
  "application/x-dbm": true,
  "application/x-x509-ca-cert": true,
  "application/x-dib": true,
  "application/msword": true,
  "application/x-drw": true,
  "Model/vnd.dwf": true,
  "application/x-dwg": true,
  "application/x-dxf": true,
  "application/x-emf": true,
  "application/x-ps": true,
  "application/x-ebx": true,
  "image/fax": true,
  "application/fractals": true,
  "application/x-frm": true,
  "application/x-gbr": true,
  "image/gif": true,
  "application/x-gp4": true,
  "application/x-hmr": true,
  "application/x-hpl": true,
  "application/x-hrf": true,
  "text/x-component": true,
  "text/html": true,
  "image/x-icon": true,
  "application/x-iff": true,
  "application/x-igs": true,
  "application/x-img": true,
  "application/x-internet-signup": true,
  "java/*": true,
  "image/jpeg": true,
  "application/x-jpg": true,
  "application/x-laplayer-reg": true,
  "audio/x-liquid-secure": true,
  "audio/x-la-lms": true,
  "application/x-ltr": true,
  "video/x-mpeg": true,
  "video/mpeg4": true,
  "application/x-troff-man": true,
  "application/msaccess": true,
  "application/x-shockwave-flash": true,
  "message/rfc822": true,
  "audio/mid": true,
  "application/x-mil": true,
  "audio/x-musicnet-download": true,
  "application/x-javascript": true,
  "audio/mp1": true,
  "video/mpeg": true,
  "application/vnd.ms-project": true,
  "video/mpg": true,
  "audio/rn-mpeg": true,
  "image/pnetvue": true,
  "application/x-out": true,
  "application/x-pkcs12": true,
  "application/pkcs7-mime": true,
  "application/x-pkcs7-certreqresp": true,
  "application/x-pc5": true,
  "application/x-pcl": true,
  "application/pdf": true,
  "application/vnd.adobe.pdx": true,
  "application/x-pgl": true,
  "application/vnd.ms-pki.pko": true,
  "application/x-plt": true,
  "application/x-png": true,
  "application/vnd.ms-powerpoint": true,
  "application/x-ppt": true,
  "application/pics-rules": true,
  "application/x-prt": true,
  "application/postscript": true,
  "audio/vnd.rn-realaudio": true,
  "application/x-ras": true,
  "application/x-red": true,
  "application/vnd.rn-realsystem-rjs": true,
  "application/x-rlc": true,
  "application/vnd.rn-realmedia": true,
  "audio/x-pn-realaudio": true,
  "application/vnd.rn-realmedia-secure": true,
  "application/vnd.rn-realsystem-rmx": true,
  "image/vnd.rn-realpix": true,
  "application/vnd.rn-rsml": true,
  "video/vnd.rn-realvideo": true,
  "application/x-sat": true,
  "application/x-sdw": true,
  "application/x-slb": true,
  "drawing/x-slk": true,
  "application/smil": true,
  "text/plain": true,
  "application/futuresplash": true,
  "application/streamingmedia": true,
  "application/vnd.ms-pki.stl": true,
  "application/x-sty": true,
  "application/x-tg4": true,
  "image/tiff": true,
  "image/png": true,
  "drawing/x-top": true,
  "application/x-icq": true,
  "text/x-vcard": true,
  "application/vnd.visio": true,
  "application/x-vpeg005": true,
  "application/x-vsd": true,
  "audio/wav": true,
  "application/x-wb1": true,
  "application/x-wb3": true,
  "application/x-wk4": true,
  "application/x-wks": true,
  "audio/x-ms-wma": true,
  "application/x-wmf": true,
  "video/x-ms-wmv": true,
  "application/x-ms-wmz": true,
  "application/x-wpd": true,
  "application/vnd.ms-wpl": true,
  "application/x-wr1": true,
  "application/x-wrk": true,
  "application/x-ws": true,
  "application/vnd.adobe.xdp": true,
  "application/vnd.adobe.xfd": true,
  "application/x-xls": true,
  "application/x-xwd": true,
  "application/vnd.symbian.install": true,
  "application/x-x_t": true,
  "application/vnd.android.package-archive": true
}

function isUrl(path) {
  return reg.test(path);
}

const utils = {
  getOAuth2Html(production) {
    if (production) {
      return "webjars/oauth/oauth2.html";
    }
    return "oauth/oauth2.html";
  },
  getOAuth2BearerValue(schema, defaultValue) {
    if (schema == "bearer") {
      // 兼容用户已经填写了bearer的情况
      if (defaultValue != null && defaultValue != '') {
        let lowerStr = defaultValue.toLocaleLowerCase();
        if (lowerStr.indexOf("bearer") > -1) {
          // 不做任何处理，直接返回，用户已经填写了Bearer
          return defaultValue;
        } else {
          return "Bearer " + defaultValue;
        }
      }
    }
    return defaultValue;
  },
  groupName(url, defaultName) {
    var gname = defaultName;
    var reg = new RegExp(".*?group=(.*?)(&.*?)?$");
    if (reg.test(url)) {
      var tmpGroupName = RegExp.$1;
      if (this.strNotBlank(tmpGroupName)) {
        if (tmpGroupName != defaultName) {
          gname = tmpGroupName;
        }
      }
    }
    return gname;
  },
  oasmodel(oas2) {
    // 获取oas的definitions解析正则
    if (oas2) {
      return "#/definitions/(.*)$";
    } else {
      return "#/components/schemas/(.*)$";
    }
  },
  /**
   * 判断对象是否为一个引用对象
   * @param {*} obj 待判断对象
   */
  isRef(obj) {
    return this.checkUndefined(obj) && this.strNotBlank(obj['$ref']);
  },
  /**
   * 获取引用名称（引用地址的最后一段），如 #/components/schemas/User -> User
   * @param {*} ref 引用地址
   */
  getRefName(ref) {
    if (!this.strNotBlank(ref)) {
      return '';
    }
    var segments = ref.split('/');
    var name = segments[segments.length - 1] || '';
    return decodeURIComponent(name.replace(/~1/g, '/').replace(/~0/g, '~'));
  },
  /**
   * 解析文档内部的JSON Pointer引用
   * @param {*} ref 引用地址，仅支持文档内部引用（#/开头）
   * @param {*} root 文档根节点
   */
  resolveRef(ref, root) {
    if (!this.strNotBlank(ref) || !this.checkUndefined(root) || !ref.startsWith('#/')) {
      return null;
    }
    var paths = ref.substring(2).split('/');
    var current = root;
    for (var i = 0; i < paths.length; i++) {
      if (!this.checkUndefined(current) || typeof current != 'object') {
        return null;
      }
      var key = decodeURIComponent(paths[i].replace(/~1/g, '/').replace(/~0/g, '~'));
      current = current[key];
    }
    return this.checkUndefined(current) ? current : null;
  },
  /**
   * 将OAS3中allOf/oneOf/anyOf组合schema归一化，便于逐个解析属性
   * 返回的结构：{ type, format, description, required, properties, items, schema }
   * @param {*} schema 原始schema
   * @param {*} root 文档根节点，用于解析$ref
   * @param {*} depth 当前递归深度，避免循环引用
   */
  normalizeSchema(schema, root, depth) {
    var dft = depth == null ? 0 : depth;
    if (!this.checkUndefined(schema) || typeof schema != 'object' || dft > 8) {
      return { type: '', format: '', description: '', required: [], properties: null, items: null, schema: null };
    }
    // $ref直接引用时先展开
    if (this.isRef(schema) && this.checkUndefined(root)) {
      var target = this.resolveRef(schema['$ref'], root);
      if (this.checkUndefined(target)) {
        schema = target;
      }
    }
    var result = {
      type: this.propValue('type', schema, ''),
      format: this.propValue('format', schema, ''),
      description: this.propValue('description', schema, ''),
      required: this.propValue('required', schema, null) || [],
      properties: this.propValue('properties', schema, null),
      items: this.propValue('items', schema, null),
      schema: schema
    };
    // 3.1支持type为数组，形如 ["string", "null"]
    if (Array.isArray(result.type)) {
      var types = result.type.filter(t => t != 'null');
      result.type = types.length > 0 ? types[0] : 'string';
    }
    ['allOf', 'oneOf', 'anyOf'].forEach(group => {
      var list = this.propValue(group, schema, null);
      if (!Array.isArray(list) || list.length == 0) {
        return;
      }
      var mergedProperties = {};
      var mergedRequired = [];
      var mergedType = result.type;
      var mergedFormat = result.format;
      list.forEach(item => {
        var sub = this.normalizeSchema(item, root, dft + 1);
        if (!this.strNotBlank(mergedType) && this.strNotBlank(sub.type)) {
          mergedType = sub.type;
        }
        if (!this.strNotBlank(mergedFormat) && this.strNotBlank(sub.format)) {
          mergedFormat = sub.format;
        }
        if (this.checkUndefined(sub.properties)) {
          mergedProperties = Object.assign(mergedProperties, sub.properties);
        }
        if (Array.isArray(sub.required)) {
          mergedRequired = mergedRequired.concat(sub.required);
        }
        if (!this.checkUndefined(result.items) && this.checkUndefined(sub.items)) {
          result.items = sub.items;
        }
      });
      if (Object.keys(mergedProperties).length > 0) {
        result.properties = Object.assign(mergedProperties, result.properties || {});
      }
      if (mergedRequired.length > 0) {
        result.required = Array.from(new Set((result.required || []).concat(mergedRequired)));
      }
      result.type = mergedType;
      result.format = mergedFormat;
    });
    if (!this.strNotBlank(result.type)) {
      if (this.checkUndefined(result.properties)) {
        result.type = 'object';
      } else if (this.checkUndefined(result.items)) {
        result.type = 'array';
      }
    }
    return result;
  },
  filterIgnoreParameters(inType, name, ignoreParameters) {
    // 是否过滤参数
    if (ignoreParameters == null) {
      return true;
    }
    var tmpKeys = Object.keys(ignoreParameters || {});
    var ignoreParameterAllKeys = [];
    var reg = new RegExp("\\[0\\]", "gm");
    if (tmpKeys != null && tmpKeys.length > 0) {
      tmpKeys.forEach(tk => {
        ignoreParameterAllKeys.push(tk);
        if (tk.indexOf("[0]") > -1) {
          ignoreParameterAllKeys.push(tk.replace(reg, ""));
        }
      });
    }
    if (name.indexOf("[0]") > -1) {
      // 存在数组的情况
      if (ignoreParameterAllKeys.length > 0) {
        var containtsKey = ignoreParameterAllKeys.filter(ignoreName => name.startsWith(ignoreName));
        if (containtsKey.length > 0) {
          return false;
        } else {
          return true;
        }
      } else {
        return true;
      }
    } else {
      if (inType == 'query') {
        // console.log("ignoreParameterAllKeys")
        // console.log(ignoreParameterAllKeys)
        return !ignoreParameterAllKeys.some(key =>
          new RegExp(`^(${key}$|${key}[.[])`).test(name) || new RegExp(key, "g").test(name));
      } else {
        return !ignoreParameterAllKeys.includes(name);
      }
    }
  },
  appendBasePath(paths, basePath) {
    var appendBasePathFlag = false;
    try {
      if (this.checkUndefined(basePath) && this.strNotBlank(basePath) && basePath != '/') {
        var pathKeys = Object.keys(paths || {});
        var pathKeyLength = pathKeys.length;
        var num = 0;
        // https://gitee.com/xiaoym/knife4j/issues/I3B5BK
        let basePathStr = basePath + "/";
        for (var i = 0; i < pathKeys.length; i++) {
          if (pathKeys[i].startsWith(basePathStr)) {
            num++;
          }
        }
        if (num == pathKeyLength) {
          // 已经追加过basePath，无需再次追加
          appendBasePathFlag = true;
        }
      } else {
        // 其余情况都代表已经追加过
        appendBasePathFlag = true;
      }
    } catch (e) {
      // ignore
      appendBasePathFlag = true;
    }
    return appendBasePathFlag;
  },
  filterIncludeParameters(inType, name, includeParameters) {
    if (includeParameters == null) {
      return true;
    }
    var tmpKeys = Object.keys(includeParameters || {});
    var includeParameterAllKeys = [];
    var reg = new RegExp("\\[0\\]", "gm");
    if (tmpKeys != null && tmpKeys.length > 0) {
      tmpKeys.forEach(tk => {
        includeParameterAllKeys.push(tk);
        if (tk.indexOf("[0]") > -1) {
          includeParameterAllKeys.push(tk.replace(reg, ""));
        }
      });
    }
    if (name.indexOf("[0]") > -1) {
      // 存在数组的情况
      if (includeParameterAllKeys.length > 0) {
        var containtsKey = includeParameterAllKeys.filter(includeName => name.startsWith(includeName));
        if (containtsKey.length > 0) {
          return true;
        } else {
          return false;
        }
      } else {
        return true;
      }
    } else {
      if (inType == 'query') {
        /* return includeParameterAllKeys.some(key =>
          new RegExp(`^(${key}$|${key}[.[])`).test(name)); */
        return includeParameterAllKeys.includes(name);
      } else if (inType == 'body') {
        return true;
      } else {
        return includeParameterAllKeys.includes(name);
      }
    }
  },
  rootKeysPath(rootName, jsonInstance, includeKeys) {
    // 返回一个json对象的key属性集合
    var keyArrs = [];
    if (jsonInstance != null && jsonInstance != undefined) {
      for (var key in jsonInstance) {
        var tmpRootName = rootName + "." + key;
        var parentKeyFlag = includeKeys.some(key => key.startsWith(tmpRootName));
        if (!parentKeyFlag) {
          keyArrs.push(tmpRootName);
          // 是否对象
          var tmpJson = jsonInstance[key];
          // 判断是否是数组
          if (Array.isArray(tmpJson)) {
            // 是
            var tmpArrName = rootName + "." + key + "[0]";
            keyArrs = keyArrs.concat(this.rootKeysPath(tmpArrName, tmpJson[0], includeKeys));
            // keyArrs = keyArrs.concat(this.rootKeysPath(tmpRootName, tmpJson[0]));
          } else {
            if (isObject(tmpJson)) {
              keyArrs = keyArrs.concat(this.rootKeysPath(tmpRootName, tmpJson, includeKeys));
            }
          }
        }
      }
    }
    return keyArrs;
  },
  binaryContentType(produces, contentType) {
    var binary = false;
    var binaryType = "";
    if (produces != null && produces != undefined) {
      produces.forEach(function (p) {
        if (binaryContentType[p]) {
          binaryType = p;
          binary = true;
        }
      })
    }
    if (contentType != null) {
      if (!binary && binaryContentType[contentType]) {
        binary = true;
        binaryType = contentType;
      }
    }
    var bobj = {
      binary: binary,
      binaryType: binaryType
    };
    return bobj;
  },
  copyOneObject(source) {
    var target = {};
    for (var k in source) {
      target[k] = source[k];
    }
    return target;
  },
  randomMd5() {
    // 生成一个随机MD5码
    return md5(new Date().getTime().toString() +
      Math.floor(Math.random() * 100000).toString());
  },
  randomMd5Str(str) {
    // 生成一个随机MD5码
    return md5(new Date().getTime().toString() +
      Math.floor(Math.random() * 10000).toString() + str);
  },
  formatter: function (data, parentPath = "/", parentAuthority) {
    return data.map(item => {
      let {
        path
      } = item;
      if (!isUrl(path)) {
        path = parentPath + item.path;
      }
      const result = {
        ...item,
        path,
        authority: item.authority || parentAuthority
      };
      if (item.children) {
        result.children = this.formatter(
          item.children,
          `${parentPath}${item.path}/`,
          item.authority
        );
      }
      return result;
    });
  },
  md5Id: function (obj) {
    var md5Id = "";
    try {
      if (obj != null && obj != undefined) {
        var str = JSON.stringify(obj);
        if (str != "") {
          var strArr = str.split("");
          strArr.sort();
          var newStr = strArr.join("");
          md5Id = md5(newStr);
        }

      }
    } catch (err) { }
    return md5Id;

  },
  checkParamArrsExists: function (arr, param) {
    // console.log('arr:', arr)
    // console.log('param:', param)
    // 名称不能保证唯一，需要考虑输入类型
    // https://gitee.com/xiaoym/knife4j/issues/I3R9B3
    return (arr || []).some(row => row.name + row.in == param.name + param.in)
    //  var flag = false;
    //  if (arr != null && arr.length > 0) {
    //    arr.forEach(function (a) {
    //      if (a.name == param.name) {
    //        flag = true;
    //      }
    //    })
    //  }
    //  return flag;
  },
  isChinese: function (keyword) {
    // 判断是否包含中文
    var reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
    return reg.test(keyword);
  },
  json5stringifyNoFormat: function (rtext) {
    var ret = null;
    try {
      ret = JSON5.stringify(rtext);
    } catch (err) {
      // console(err)
      ret = JSON.stringify(rtext);
    }
    return ret;
  },
  json5stringify: function (rtext) {
    let ret = null
    try {
      ret = JSON5.stringify(rtext, null, 2);
    } catch (err) {
      // console(err)
      ret = JSON.stringify(rtext, null, 2);
    }
    return ret;
  },
  json5stringifyFormat: function (rtext, format, num) {
    var ret = null;
    try {
      ret = JSON5.stringify(rtext, format, num);
    } catch (err) {
      // console(err)
      ret = JSON.stringify(rtext, format, num);
    }
    return ret;

  },
  json5parse: function (rtext) {
    var ret = null;
    try {
      ret = JSON5.parse(rtext)
    } catch (err) {
      // console(err)
      ret = JSON.parse(rtext);
    }
    return ret;
  },
  filterJsonObject: function (prefix, originalJson, filterObject) {
    var _tmpValue = null;
    try {
      _tmpValue = utils.filterObject(prefix, originalJson, filterObject);
    } catch (err) {
      _tmpValue = originalJson;
    }
    return _tmpValue;
  },
  filterObject: function (preName, originalJsonObject, filterObject) {
    var newObj = {};
    if (filterObject != undefined && filterObject != null) {
      for (var x in originalJsonObject) {
        var _tmp = originalJsonObject[x];
        var filterName = preName + "." + x;
        if (!filterObject.hasOwnProperty(filterName)) {
          newObj[x] = _tmp;
        }
        var _type = utils.genericType(_tmp);
        if (_type == "object") {
          newObj[x] = utils.filterObject(filterName, _tmp, filterObject);
        } else if (_type == "array") {
          var _t1 = _tmp[0];
          var _na = new Array();
          _na.push(utils.filterObject(filterName, _t1, filterObject));
          newObj[x] = _na;
        }

      }
    } else {
      newObj = originalJsonObject;
    }

    return newObj;
  },
  genericType: function (value) {
    var _tmp = Object.prototype.toString.call(value);
    var _tmpType = "";
    if (_tmp != null && _tmp != undefined) {
      if (_tmp.indexOf("Array") != -1) {
        _tmpType = "array";
      } else if (_tmp.indexOf("Object") != -1) {
        _tmpType = "object";
      }
    }
    return _tmpType;
  },
  getJsonKeyLength: function (json) {
    var size = 0;
    if (json != null) {
      for (key in json) {
        if (json.hasOwnProperty(key)) size++;
      }
    }
    return size;
  },
  regexMatchStr: function (regex, str) {
    var flag = false;
    if (regex != null && regex != undefined && str != null && str != undefined) {
      var matchResult = str.match(regex);
      if (matchResult != null) {
        flag = true;
      }
    }
    return flag;
  },
  searchMatch(regex, str) {
    var flag = false;
    if (regex != null && regex != undefined && str != null && str != undefined) {
      /* var matchResult = str.match(regex);
      if (matchResult != null) {
        flag = true;
      } */
      flag = new RegExp(regex, "ig").test(str);
    }
    return flag;
  },
  validateJSR303: function (parameter, origin) {
    var max = origin["maximum"],
      min = origin["minimum"],
      emin = origin["exclusiveMinimum"],
      emax = origin["exclusiveMaximum"];
    var pattern = origin["pattern"];
    var maxLength = origin["maxLength"],
      minLength = origin["minLength"];
    if (max || min || emin || emax) {
      parameter.validateStatus = true;
      parameter.validateInstance = {
        minimum: min,
        maximum: max,
        exclusiveMaximum: emax,
        exclusiveMinimum: emin
      };
    } else if (pattern) {
      parameter.validateStatus = true;
      parameter.validateInstance = {
        "pattern": origin["pattern"]
      };
    } else if (maxLength || minLength) {
      parameter.validateStatus = true;
      parameter.validateInstance = {
        maxLength: maxLength,
        minLength: minLength
      };
    }
  },
  checkUndefined: function (obj) {
    var flag = false;
    if (obj != undefined && obj != null && typeof (obj) != "undefined") {
      flag = true;
    }
    return flag;
  },
  arrNotEmpty(arr) {
    // 集合非空
    var flag = false;
    if (arr != undefined && arr != null && arr.length > 0) {
      flag = true;
    }
    return flag;
  },
  arrEmpty(arr) {
    return !this.arrNotEmpty(arr);
  },
  strBlank(str) {
    return !this.strNotBlank(str);
  },
  strNotBlank(str) {
    var flag = false;
    if (
      str != undefined &&
      str != null &&
      str != ""
    ) {
      flag = true;
    }
    return flag;
  },
  propValue: function (key, obj, defaultValue) {
    var t = defaultValue;
    if (obj.hasOwnProperty(key)) {
      t = obj[key];
    }
    return t;
  },
  getExample(key, obj, defaultValue) {
    var v = this.propValue(key, obj, defaultValue);
    // 判断是否是双精度64位，如果是，直接返回
    if (isNumber(v)) {
      return v;
    } else {
      if (typeof (v) == 'object') {
        // v=this.json5stringify(v);
        v = this.json5stringifyNoFormat(v);
      }
    }
    return v;
  },
  checkIsBasicType: function (type) {
    var basicTypes = ["string", "integer", "number", "object", "boolean", "int32", "int64", "float", "double"];
    var flag = false;
    if (type != null) {
      // 解析阶段会为类型追加format后缀（如 string(date-time)、integer(int64)），
      // 此类类型本质上仍是基础类型，不能当作引用模型去展开
      var normalized = String(type).trim().replace(/^([^\s(]+)\s*\(.*\)$/, '$1');
      if (basicTypes.indexOf(normalized) > -1) {
        flag = true;
      }
    }
    return flag;
  },
  getBasicTypeValue: function (type) {
    var propValue = "";
    // 是否是基本类型
    if (type == "integer") {
      propValue = 0;
    }
    if (type == "boolean") {
      propValue = true;
    }
    if (type == "object") {
      propValue = {};
    }
    if (type == "number") {
      propValue = parseFloat(0);
    }
    return propValue;
  },
  getValue: function (obj, key, defaultValue, checkEmpty) {
    var val = defaultValue;
    if (obj != null && obj != undefined) {
      if (obj.hasOwnProperty(key)) {
        val = obj[key];
        if (checkEmpty) {
          if (val == null || val == "") {
            val = defaultValue;
          }
        }
      }
    }
    return val;
  },
  getClassName: function (item, oas2) {
    if (oas2) {
      var regex = new RegExp("#/definitions/(.*)$", "ig");
      if (regex.test(item)) {
        var ptype = RegExp.$1;
        return ptype;
      }
    } else {
      var regex = new RegExp("#/components/schemas/(.*)$", "ig");
      if (regex.test(item)) {
        var ptype = RegExp.$1;
        return ptype;
      }
    }

    return null;
  },
  getRefParameterName: function (item) {
    var regex = new RegExp("#/components/parameters/(.*)$", "ig");
    if (regex.test(item)) {
      var ptype = RegExp.$1;
      return ptype;
    }
    return null;
  },
  trim(text) {
    var whitespace = "[\\x20\\t\\r\\n\\f]";
    var rtrim = new RegExp("^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g");
    return text == null ? "" : (text + "").replace(rtrim, "");
  },
  getStringValue: function (obj) {
    var str = "";
    if (obj != undefined && typeof (obj) != 'undefined' && obj != null) {
      str = obj.toString();
    }
    return str;
  },
  toString(obj, defutStr) {
    var str = defutStr;
    if (obj != undefined && typeof (obj) != 'undefined' && obj != null) {
      str = obj.toString();
    }
    return str;
  },
  randomNumber: function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  },
  htmlEncode: function (html) {
    if (html !== null) {
      return html.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
      return '';
    }
  },
  jsString: function (s) {
    s = JSON.stringify(s).slice(1, -1);
    return utils.htmlEncode(s);
  },
  replaceMultipLineStr: function (str) {
    if (str != null && str != undefined && str != "") {
      var newLinePattern = /(\r\n|\n\r|\r|\n)/g;
      if (newLinePattern.test(str)) {
        var newDes = str.replace(newLinePattern, '\\n');
        return newDes;
      }
      return str;
    }
    return "";
  },
  camelCase: function (str) {
    if (str != null && str != undefined && str != "") {
      if (str.length == 1) {
        return str.toLocaleLowerCase();
      } else {
        return str.substr(0, 1).toLocaleLowerCase() + str.substr(1);
      }
    }
    return "";
  },
  generUUID: function () {
    return (utils.randomNumber() + utils.randomNumber() + "-" + utils.randomNumber() + "-" + utils.randomNumber() + "-" + utils.randomNumber() + "-" + utils.randomNumber() + utils.randomNumber() + utils.randomNumber());
  },
  base64Encode: function (str) {
    var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "",
      i = 0,
      len = str.length,
      c1, c2, c3;
    while (i < len) {
      c1 = str.charCodeAt(i++) & 0xff;
      if (i == len) {
        out += CHARS.charAt(c1 >> 2);
        out += CHARS.charAt((c1 & 0x3) << 4);
        out += "==";
        break;
      }
      c2 = str.charCodeAt(i++);
      if (i == len) {
        out += CHARS.charAt(c1 >> 2);
        out += CHARS.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        out += CHARS.charAt((c2 & 0xF) << 2);
        out += "=";
        break;
      }
      c3 = str.charCodeAt(i++);
      out += CHARS.charAt(c1 >> 2);
      out += CHARS.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
      out += CHARS.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
      out += CHARS.charAt(c3 & 0x3F);
    }
    return out;
  },
  binToBase64: function (bitString) {
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""); // 索引表
    var result = "";
    var tail = bitString.length % 6;
    var bitStringTemp1 = bitString.substr(0, bitString.length - tail);
    var bitStringTemp2 = bitString.substr(bitString.length - tail, tail);
    for (var i = 0; i < bitStringTemp1.length; i += 6) {
      var index = parseInt(bitStringTemp1.substr(i, 6), 2);
      result += code[index];
    }
    bitStringTemp2 += new Array(7 - tail).join("0");
    if (tail) {
      result += code[parseInt(bitStringTemp2, 2)];
      result += new Array((6 - tail) / 2 + 1).join("=");
    }
    return result;
  },
  checkExtensionsUndefined: function (obj) {
    return obj && (this.checkUndefined(obj['extensions']) || this.checkUndefined(obj['x-extensions']) || this.hasVendorExtensions(obj))
  },
  /**
   * 判断对象上是否直接平铺了以x-开头的扩展属性
   * @param {*} obj
   */
  hasVendorExtensions: function (obj) {
    if (!this.checkUndefined(obj) || typeof obj != 'object') {
      return false;
    }
    return Object.keys(obj).some(function (key) {
      return key.indexOf('x-') === 0 && key != 'x-extensions';
    });
  },
  /**
   * 读取扩展属性，兼容OAS3平铺的x-*属性与服务端包装的extensions节点
   * @param {*} obj
   */
  getExtensions: function (obj) {
    if (!this.checkUndefined(obj) || typeof obj != 'object') {
      return undefined;
    }
    var merged = {};
    var wrapped = obj['extensions'] || obj['x-extensions'];
    if (this.checkUndefined(wrapped) && typeof wrapped == 'object') {
      Object.assign(merged, wrapped);
    }
    Object.keys(obj).forEach(function (key) {
      if (key.indexOf('x-') === 0 && key != 'x-extensions' && !merged.hasOwnProperty(key)) {
        merged[key] = obj[key];
      }
    });
    return Object.keys(merged).length > 0 ? merged : undefined;
  }
}


export default utils;
