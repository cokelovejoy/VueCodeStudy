/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)
// patch方法和平台相关，在web和weex环境中，它们把VNode映射到平台DOM的方法是不同的。因此每个平台都有各自的nodeOps和platformModules。
// createPatchFunction 返回 patch()函数，其内部封装了比较新旧VNode的一系列方法，并在patch中进行了调用。
export const patch: Function = createPatchFunction({ nodeOps, modules })
