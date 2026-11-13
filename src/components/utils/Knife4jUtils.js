/**
 * 根据url菜单查找组件名称,用于打开Tab选项卡
 * @param {*} path 路径
 * @param {*} menuData 菜单集合
 */
export function findComponentsByPath(path, menuData) {
  path = decodeURIComponent(path)
  var tmpComp = null;
  for (var i = 0; i < menuData.length; i++) {
    if (menuData[i].path == path) {
      tmpComp = menuData[i];
      break;
    }
    if (tmpComp == null) {
      var chds = menuData[i].children;
      if (chds != undefined && chds !== null) {
        tmpComp = findComponentsByPath(path, chds);
      }
    }
  }
  return tmpComp;
}

/**
 * 根据url查找菜单项所在层级的所有父级菜单key,用于展开左侧导航
 * @param {*} path 路径
 * @param {*} menuData 菜单集合
 * @param {*} parentKeys 递归过程中的父级key集合
 * @returns {Array|null} 找到时返回父级key集合(顶级菜单返回空数组),未找到返回null
 */
export function findOpenKeysByPath(path, menuData, parentKeys = []) {
  path = decodeURIComponent(path)
  const data = menuData || [];
  for (var i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.path == path) {
      return parentKeys;
    }
    if (item.children != undefined && item.children !== null && item.children.length > 0) {
      const keys = findOpenKeysByPath(path, item.children, parentKeys.concat([item.key]));
      if (keys !== null) {
        return keys;
      }
    }
  }
  return null;
}

/**
 * 根据菜单主键key查找菜单项
 * @param {*} key key值
 * @param {*} menuData 菜单集合
 */
export function findMenuByKey(key, menuData) {
  var tmpComp = null;
  for (var i = 0; i < menuData.length; i++) {
    if (menuData[i].key == key) {
      tmpComp = menuData[i];
      break;
    }
    if (tmpComp == null) {
      var chds = menuData[i].children;
      if (chds != undefined && chds !== null) {
        tmpComp = findMenuByKey(key, chds);
      }
    }
  }
  return tmpComp;
}
