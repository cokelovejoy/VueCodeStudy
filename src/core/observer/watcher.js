/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 一个Watch解析表达式，收集依赖，当表达式的值发生变化的时候出发回调
// $watch()的api方法和指令都会使用到它
export default class Watcher {
  vm: Component;          // 当前Watcher 实例监听 管理的 vm
  expression: string;     // 表达式
  cb: Function;           // 回调函数
  id: number;             // Watcher实例的 ID
  deep: boolean;          // 是否深度遍历对象
  user: boolean;          // 
  lazy: boolean;          // 
  sync: boolean;          // 是否立刻同步
  dirty: boolean;         
  active: boolean;
  deps: Array<Dep>;       // 依赖信息
  newDeps: Array<Dep>;    // 最新的依赖信息 
  depIds: SimpleSet;      // 依赖信息IDs
  newDepIds: SimpleSet;   // 最新的依赖信息IDs
  before: ?Function;
  getter: Function;       // 获取对象属性值的方法
  value: any;
  // watcher 在vue2.x版本里面 是一个组件一个watcher.可能里面有一些watch选项.
  constructor (
    vm: Component,
    expOrFn: string | Function,    // 表达式
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []          // 存储Dep实例
    this.depIds = new Set()   
    this.newDepIds = new Set() // 通过set存储dep的id
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      // 赋值给 getter
      this.getter = expOrFn 
    } else {
      // expOrFn是 字符串 就解析之后再赋值给 getter
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 计算值
    // this.get() 首次获取值，缓存原始值，触发get方法 observer中的响应式的get方法会触发收集依赖.
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  // 求值，并重新收集依赖
  get () {
    // get函数被调用时，Dep.target就变成了watcher实例了
    // pushTarget() 会将当前watcher 赋值给Dep.target
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 执行赋值给 getter 的函数 ，其中使用了响应属性的值，就会跳到 defineReactive中的get函数中
      // 就是将当前的wathcer记录到Dep实例的subs 数组中。
      // 调用 vm 的getter 函数取值，赋值给 value
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 递归遍历
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    // 返回value
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 添加依赖
  addDep (dep: Dep) {
    const id = dep.id
    // 已经有了id 就不再添加依赖
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 清除依赖收集器
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 注册接口，当依赖改变的时候被调用
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // 调度任务接口，将会被任务调度调用
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 求watcher的值， 这个只能被lazy Watcher调用
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // 依赖于watcher收集到的所有依赖
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // 从所有依赖的用户列表中删除自身
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
