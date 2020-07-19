/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree //遍历生成的AST树
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change. // 找到静态节点
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render; //每一次重新render都不需要再更新节点
 * 2. Completely skip them in the patching process. //在patch的过程中跳过这些节点
 */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  // 判断ASTNode的某个属性是否为静态属性
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  // 先标记全部的静态节点。
  // 判断是否为静态，有则增加static:true,没有则为static:false。
  markStatic(root)
  // second pass: mark static roots.
  // 再标记静态根节点属性 staticRoot 
  // (内部全部都是静态的且有子节点个数不为1且子节点不是普通的文本节点的父节点就是静态根节点)
  markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

function markStatic (node: ASTNode) {
  // 判断节点状态并记录
  node.static = isStatic(node)
  // 对元素节点进行处理
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) && // 非平台保留标签
      node.tag !== 'slot' &&              // 不是slot标签
      node.attrsMap['inline-template'] == null //不是一个内联模板容器
    ) {
      return
    }
    // 对子节点进行递归判断
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      // 子节点非静态，则该节点也记录为非静态
      if (!child.static) {
        node.static = false
      }
    }
    // 对ifConditions递归判断
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}
// 静态根节点的处理

function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    // 用来标注 在v-for内的静态节点
    // staticInFor属性高随renderStatic(_m)对这个节点生成新的key,避免patch error
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 这样做的原因是为了性能考虑，如果把一个只包含静态文本的节点标记为根节点，那么它的成本会超过收益。
    // 判断为静态根节点的条件
    // 自身为静态节点，并且有子节点。子节点不能仅为一个文本节点。
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    // 对节点的子节点进行 递归判断
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}
// 判断节点状态
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression 表达式 非静态
    return false
  }
  if (node.type === 3) { // text // 文本，静态
    return true
  }
  return !!(node.pre || ( //v-pre指令
    !node.hasBindings && // no dynamic bindings 无动态绑定
    !node.if && !node.for && // not v-if or v-for or v-else  无v-if v-for v-else
    !isBuiltInTag(node.tag) && // not a built-in 不是内置标签，内置标签有slot和component
    isPlatformReservedTag(node.tag) && // not a component  不是平台保留标签html,svg
    !isDirectChildOfTemplateFor(node) && // 不是template标签的直接子元素并且没有包含在for循环中。
    Object.keys(node).every(isStaticKey) //节点包含的属性只能由isStaticKey中的指定的几个
  ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
