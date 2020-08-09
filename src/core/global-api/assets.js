/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  // Vue.component = function() {}
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        // 如果没有传definition, 直接返回options 下的components, filters , directives
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }

        // definition是对象
        if (type === 'component' && isPlainObject(definition)) {
          // 定义组件name
          definition.name = definition.name || id
          // 组件的构造函数创建 得到VueComponent的构造函数
          definition = this.options._base.extend(definition)
        }
        // 
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 注册组件 components[id]: {comp : Comp}
        // 注册指令 directives[id]
        // 注册过滤器 filters[id]
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
