/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})
// 先引入 vue原型上的$mount方法
const mount = Vue.prototype.$mount
// 扩展 $mount方法
// 处理 template 和el 选项,尝试编译它们为render函数
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

/* istanbul ignore if */
// 对于任何非空HTML文档，document.documentElement将始终是一个<html>元素.
// document.body 返回当前文档的 <body> 元素.
// el如果是html和body,则不能挂载,退出.
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
// 退出
    return this
  }
// 处理 el 和 template 选项
// 获取当前实例的属性选项
  const options = this.$options
// resolve template/el and convert to render function
// render不存在时 才考虑 el 和 template选项(优先级 render > template > el)
// 如果实例定义的属性选项$options中没有render属性
  if (!options.render) {
    let template = options.template
// 如果有template
    if (template) {
// template 是DOM元素的选择器的字符串时
      if (typeof template === 'string') {
// id选择器
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
/* istanbul ignore if */
// template为空的时候,报警告.
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } 
// template 是一个dom元素时 (nodeType属性为1 为元素节点,为2为属性节点)
      else if (template.nodeType) {
// 取节点的innerHTML,返回html的字符串
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    }
// 判断el是否存在 
    else if (el) {
// 获取el中的元素,并赋值给template
      template = getOuterHTML(el)
    }
// 判断template存在
    if (template) {
/* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
// 标记时间戳
        mark('compile')
      }
// 编译成render函数
// 最终都是为了将template字符串转换成 render函数
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

/* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
// 如果el有outerHTML,就返回outerHTML
  if (el.outerHTML) {
    return el.outerHTML
  } else {
// 没有outerHTML,就自己新创建一个div元素
    const container = document.createElement('div')
// 然后将el节点全部追加到新建的div元素下.
    container.appendChild(el.cloneNode(true))
// 返回div内部的html元素.
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
