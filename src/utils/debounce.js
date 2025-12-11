/**
 * Debounce — delays execution until after delay ms have elapsed since last call
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timeout
  function debounced(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
  debounced.cancel = () => {
    clearTimeout(timeout)
  }
  return debounced
}

/**
 * Throttle — executes at most once per delay ms
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function throttle(fn, delay = 100) {
  let lastCall = 0
  let timeout = null
  
  function throttled(...args) {
    const now = Date.now()
    const remaining = delay - (now - lastCall)
    
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      lastCall = now
      fn.apply(this, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now()
        timeout = null
        fn.apply(this, args)
      }, remaining)
    }
  }
  
  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }
  
  return throttled
}

/**
 * Leading throttle — executes immediately, then throttles
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function throttleLeading(fn, delay = 100) {
  let lastCall = 0
  
  return function throttled(...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}
