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
