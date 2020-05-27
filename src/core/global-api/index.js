/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// 全局属性 config util options
// 全局方法 set delete nextTick observable use mixin extend components directive filter
// 绑定到Vue类上
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 给Vue 新增config 属性
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods. 暴露工具方法
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // Vue uitl 属性
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }
  // Vue set 方法: 给指定对象修改数据
  Vue.set = set
  // Vue delete 方法 : 删除对象的属性方法
  Vue.delete = del
  // Vue nextTick 方法 
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue
  // 继承 将父组件中的属性 绑定到子组件中
  extend(Vue.options.components, builtInComponents)
  // Vue use()方法 用来注入插件
  initUse(Vue)
  // Vue mixin()方法 混入
  initMixin(Vue)
  // Vue extend()方法 继承
  initExtend(Vue)
  // Vue component()方法 构建组件
  // Vue directive()方法 构建指令
  // Vue filter()方法 构建过滤器
  initAssetRegisters(Vue)
}
