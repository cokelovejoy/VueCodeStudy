/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // parse 作用是将字符串模板编译为AST(Abstract syntax Tree)
  // AST 就是JS对象,类似VNode
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化: 静态化标记 (之后可以直接复用)，不需要diff的做个标记
    optimize(ast, options)
  }
  // 生成: AST转换为代码字符串.'function(){}'
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
