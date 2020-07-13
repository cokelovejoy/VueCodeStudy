/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
// 初始化函数的实现
export function initMixin (Vue: Class<Component>) {
  // 将_init()方法 写到 Vue构造函数的原型上
  Vue.prototype._init = function (options?: Object) {
    // 获取 Vue 实例
    const vm: Component = this
    // a uid
    // unique id 唯一id
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // 合并options选项
    if (options && options._isComponent) {
      // optimize internal component instantiation (优化内部组件实例化)
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment. (由于动态选项合并很慢,而且内部组件选项不需要特别处理)
      // 初始化内部组件
      // 是组件的话就会进入这个if
      initInternalComponent(vm, options)
    } else {
      // vm.constructor 就是 Vue 
      // 将Vue 的options 和 当前实例的options合并
      // 是Vue构造函数的时候，先将这个Vue的options和vm实例的options合并。
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // Vue's options
        options || {},                             // options
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm) // 生命周期的初始化 $parent,$root,$children, $refs
    initEvents(vm)    // 事件初始化 处理父组件传递的监听器.
    initRender(vm)    // $slots,$scopedSlots,_c(), $createElement()
    callHook(vm, 'beforeCreate') // 在beforeCreate 之前都无法拿到 state

    initInjections(vm)// resolve injections before data/props 获取注入的数据(父组件的)
    initState(vm)     // 初始化组件中的 props,methods,data,computed, watch(自己的)
    initProvide(vm)   // resolve provide after data/props 提供数据
    callHook(vm, 'created') // 要使用data中的数据 最早也只能在created 钩子函数中.

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // 如果有el选项, 就执行$mount 在此执行挂载
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 初始化内部组件函数
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration. (动态枚举)
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  // 事件监听器
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag
  // 有render选项
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// Ctor is Constructor (Vue)
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 没有继承,就没有super属性
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // 返回 Vue 的 options
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
