/* @flow */

import { warn } from 'core/util/index'

// 实际上并没有被导入当前模块,只是相当于对外转发了这几个接口，导致当前模块不能直接使用这几个模块里的东西.
// 引入当前文件, 就可以使用这些模块下面的东西.
// 注意，export *命令会忽略模块里的的default方法。
export * from './attrs'
export * from './class'
export * from './element'

/**
 * Query an element selector if it's not an element already.
 */
export function query (el: string | Element): Element {
  if (typeof el === 'string') {
    // document.querySelector()
    // 返回文档中与指定选择器或选择器组匹配的第一个 html元素Element。如果找不到匹配项，则返回null。
    const selected = document.querySelector(el)
    // 如果没有找到元素
    if (!selected) {
      // 如果不是生产环境,就 报警告 'Cannot find element: xxx' 
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      // 创建一个div元素返回
      return document.createElement('div')
    }
    // 知道元素直接返回该元素
    return selected
  } else {
    // el不是字符串,是元素的时候直接返回
    return el
  }
}
