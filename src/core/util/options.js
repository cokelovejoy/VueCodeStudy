/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
// 选项重写策略是能处理 如何合并父选项值和子选项值到一个最终的值 的一些方法.
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  // 没有vm参数，说明不是实例化的时候，el和propsData选项，只能用于实例化的时候传。
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    // 返回 默认策略 函数： 有child 返回child 没有返回parent
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
// 真正用来合并选项对象的，递归地合并两个对象
// 将from的值添加到to上，最后返回to
function mergeData (to: Object, from: ?Object): Object {
  // from 没有的时候直接返回 to （to就是instanceData）
  if (!from) return to
  let key, toVal, fromVal
  // 获取from的key，用于遍历
  const keys = hasSymbol
    ? Reflect.ownKeys(from) // 有symbol类型
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    // 如果对象被观察了，就会有__ob__属性，这个属性不处理
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    // 如果to上没有该属性，则直接将from对应的值赋值给to[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      // 如果to, from都有值，并且不相同，而且都是纯对象
      // 递归调用mergeData进行合并
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
// 
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 没有vm, 则代表使用Vue.extend,Vue.mixin合并
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // 返回一个合并的data函数
    // 当调用mergedDataFn才会执行mergeData
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    // vm存在的情况, 返回的是一个方法 合并实例data 的方法mergedInstanceDataFn
    return function mergedInstanceDataFn () {
      // instance merge
      // instanceData {xx:""}
      // 实例化合并，判断是否是函数，函数执行得到对象
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      // parentVal undefined
      // defaultData undefined
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        // 如果子选项data有值，则通过mergeData合并。
        // 当调用mergedInstanceDataFn才会执行mergeData
        return mergeData(instanceData, defaultData)
      } else {
        // 子选项没有data，直接返回默认data
        return defaultData
      }
    }
  }
}
// 对于data选项的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 不传入vm的情况
  if (!vm) {
    // 如果子选项data属性值 不是一个function就会报warning
    // 为了防止对象引用造成修改会影响到其他组件的data
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      // 返回父选项的值
      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }
  // 将父的data属性值和子的data属性值 合并
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
// 钩子函数当作数组合并来处理，最后返回数组
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal 
    ? parentVal // child有值
      ? parentVal.concat(childVal)// parent 有值，与child直接数组拼接
      : Array.isArray(childVal) // parent没有值，将child变成数组
        ? childVal
        : [childVal]
    : parentVal // child没有值直接返回parent，parent如果有值，一定是被mergeOptions处理过一次，因此一定会变成数组。
  return res
    ? dedupeHooks(res)
    : res
}
// 数组去重
function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

// 每一个生命周期钩子函数的策略都是 mergeHook
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
// components，directives, filters选项的合并策略
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  // 创建空对象，将parentVal添加到res.__proto__上
  const res = Object.create(parentVal || null)
  if (childVal) {
    // 校验childVal[key] 是否是对象，不是给出警告
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    // 然后将childVal的属性添加到res上
    return extend(res, childVal)
  } else {
    return res
  }
}
// components，directives, filters选项使用同一种合并策略
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
// watch选项的合并策略
// watch选项合并就是判断父子是否都有监听同一个值，如果同时监听了，就变成一个数组。否则就正常合并到一个纯对象就可以
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // Firefox浏览器自带watch，如果是原生的watch，则置空
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  
  /* istanbul ignore if */
  // 如果没有childVal,则返回空对象，通过__proto__可以访问parentVal
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 如果没有parentVal，返回childVal
  if (!parentVal) return childVal
  const ret = {}
  // 把parentVal属性添加到ret
  extend(ret, parentVal)

  // 遍历childVal
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    // 如果parent存在，则变成数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    // 返回数组
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
// props methods inject computed 的合并策略
// props、methods、inject、computed选项的合并是合并到同一个纯对象上，对于父子有同样的key值，采取子选项上对应的值.
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 校验childVal是否是对象
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 没有parenVal 返回childVal
  if (!parentVal) return childVal
  const ret = Object.create(null)
  // 将parentVal属性添加到ret
  extend(ret, parentVal)
  // 如果childVal有值，也将属性添加到ret
  if (childVal) extend(ret, childVal)
  return ret
}

// provide选型合并采用data选项的合并策略
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
// strats[key]不存在时，使用默认策略
const defaultStrat = function (parentVal: any, childVal: any): any {
  // 默认策略 没有child 就返回 parent 有child 就返回child，覆盖式合并
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
// 检查组件名字是否符合规范
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  // 符合HTML5规范的标签命名，由普通字符和-组成，必须以字母开头
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  // isBuiltInTag检查名字不能与slot，component重名
  // isReservedTag检查名字不能与html，svg内置标签重名
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  // props是数组时，里面的值只能是字符串
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        // 将key变成驼峰形式
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
  // props是对象时，
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      // 是对象，直接赋值，不是则赋值{ type：String }
      // 例如：{ sex: String, job: { type: String, default: 'xxx' } }
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // 不是数组和对象给出警告
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject (options: Object, vm: ?Component) {
  // 保存inject引用
  const inject = options.inject
  if (!inject) return
  // 重置对象，之后重新赋值
  const normalized = options.inject = {}
  // 是数组时
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
  // 是对象时，如果key值对应的是对象，则通过extend合并，如果不是，则代表直接是from，from属性是必须的
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    // 遍历对象，如果key值对应的是函数。则修改成对象形式
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

// strategies 这里面的属性全部是上面定义的方法functions 会赋值到 vm.$options 上
// strats: { 
// propsData, el, data, 
// beforeCreate, created, beforeMount, mounted, beforeUpdate, updated, 
// beforeDestroy, destroyed, activated, deactivated, errorCaptured, serverPrefetch,
// components, directives, filters, watch, computed, inject, methods, props, provide }

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
// 两个options对象合并成一个对象返回,用于实例化和继承的核心函数。
// Vue.mixin和Vue.extend方法中都调用了这个函数，其中第三个参数是可选的，如果有vm，则是实例化选项合并，没有vm参数为继承选项合并，根据有无vm做不用的处理。
// Vue实例化时，parent为Vue构造函数的 options，child为传入的options 对象。
export function mergeOptions (
  parent: Object, // options object
  child: Object,  // options object
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {
    // 检查组件名字是否符合规范
    checkComponents(child)
  }
  // 如果child参数 类型为function，则此时的child为Vue构造函数或者是通过Vue.extend创建的在子类构造函数。
  // 获取构造函数的 options
  if (typeof child === 'function') {
    child = child.options
  }
  // 对props，inject，directives选项规范化
  // props可以是数组或对象，处理之后，都转换成对象的形式绑定到options.props上。
  normalizeProps(child, vm)
  // inject可以是数组或者对象，转换成对象
  normalizeInject(child, vm)
  // Directives里面的函数转换成对象
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  // 处理 extends继承和mixins混入的 options，它们的options都要被合并处理
  // 被合并过的选项就会带有_base属性，没有_base属性进入递归调用继续去合并
  if (!child._base) {
    // 处理子组件选项的extends和mixins选项。
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options = {}
  let key
  // 遍历最先的 parent options 对象的每个属性
  for (key in parent) {
    mergeField(key)
  }
  // 遍历child options 对象的每个属性
  for (key in child) {
    // 并且这个属性在 parent options中没有，才做合并
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  // 根据key获取对应的合并策略，然后赋值到options[key]上。
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  // 最终option对象返回
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
