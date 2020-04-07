import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

// 初始化全局API
initGlobalAPI(Vue)
// 给Vue原型上添加属性 $isServer
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})
// 给Vue原型上添加属性 $ssrContext
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
// 给Vue类 上增加属性 FunctionalRenderContext , 函数渲染上下文.
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
