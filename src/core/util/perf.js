import { inBrowser } from './env'

export let mark
export let measure

if (process.env.NODE_ENV !== 'production') {
  // 如果是在浏览器 并且 windows 下有performance属性
  const perf = inBrowser && window.performance
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    // mark(),measure()都是为了测量程序运行时间
  
    mark = tag => perf.mark(tag)
    measure = (name, startTag, endTag) => {
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      // perf.clearMeasures(name)
    }
  }
}
