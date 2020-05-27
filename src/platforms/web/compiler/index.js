/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'
// createCompiler(baseOptions) 的返回值
// {
//     compile,
//     compileToFunctions: createCompileToFunctionFn(compile)
//  }
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
