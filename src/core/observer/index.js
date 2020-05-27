/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// Observer 类 附加于每一个object， 给 object 中的每个属性key, 设置get 和set 函数.
// 用于收集依赖 和 分发更新
// 如果data是对象就会有一个Observer实例与之对应
// Observer 目的: 判断数据类型,分别处理.
export class Observer {
  value: any; // value is data {}
  dep: Dep; // watcher容器
  vmCount: number; // number of vms that have this object as root $data
 
  constructor (value: any) {
    this.value = value
    // 创建Dep实例
    this.dep = new Dep() 
    this.vmCount = 0
    def(value, '__ob__', this)
    // 判断当前是否是数组
    if (Array.isArray(value)) {
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
      // 遍历 data obj 所有的属性 
      // 对每个属性配置get set
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 返回Observer对象实例 为data创建一个observer对象实例
// value 参数就是data 对象{}
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建一个observer对象实例
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  // 返回Observer对象实例
  return ob
}

/**
 * Define a reactive property on an Object.
 * 当有watcher调用get的时候，就把watcher存入dep的subs中
 * 当调用set的时候，就遍历dep的subs中的watcher实例，通知update
 * vue组件data中的每一个属性，其实就对应一个Dep实例，就是被观察的目标
 */
// 响应化处理

export function defineReactive (
  obj: Object, // 要做响应化处理的对象 即data 对象
  key: string, // 属性名
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 创建Dep实例
  const dep = new Dep()
  // 获取属性本身的属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 不可配置 直接退出
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 获取get set函数 没有为 undefined
  const getter = property && property.get
  const setter = property && property.set
  
  // 没有get 直接将属性值赋值给 val
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 如果内部是对象,递归处理 对该属性也创建observer实例
  let childOb = !shallow && observe(val)
  // 核心环节 数据拦截 增加get set函数
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // getter 为undefined 将val 赋值给value
      const value = getter ? getter.call(obj) : val
      // 当有watcher访问该数据的时候
      // 全局变量Dep.target = 该watcher实例
      if (Dep.target) {
        // 调用 Dep.target.addDep(this)，该方法将dep实例存入watcher实例的一个数组newDeps中，同时也将watcher实例存入到dep实例subs的一个数组中, 互相存起来。
        dep.depend()
        // 如果有子ob存在
        if (childOb) {
          childOb.dep.depend()
          // 如果是数组还要继续处理
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal // 更新value
      }
      // 如果用户设置的值是对象, 还需要额外的响应化处理
      childOb = !shallow && observe(newVal)
      // 通知更新, 遍历之前存储的watcher，调用update()方法
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
