import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
// 定义构造函数 Vue
// 传入的options 就是new Vue({...})中的对象
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 执行_init()方法，并传入options 对象
  this._init(options)
}

initMixin(Vue)   // 混入init函数 实现了 _init()
stateMixin(Vue)  // 状态相关: $data, $props, $set, $delete, $watch
eventsMixin(Vue)  // 事件相关: $on, $emit, $once, $off
lifecycleMixin(Vue) // 生命周期相关: _update, $forceUpdate, $destroy
renderMixin(Vue)    // 渲染DOM相关: $nextTick, _render

export default Vue
