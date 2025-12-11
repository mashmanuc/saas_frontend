let mathJaxPromise = null

function loadMathJax() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.MathJax) {
    return Promise.resolve(window.MathJax)
  }
  if (mathJaxPromise) return mathJaxPromise

  mathJaxPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
    script.async = true
    script.onload = () => {
      if (window.MathJax) {
        window.MathJax = window.MathJax
        resolve(window.MathJax)
      } else {
        reject(new Error('MathJax failed to load'))
      }
    }
    script.onerror = (error) => reject(error)
    document.head.appendChild(script)
  })

  return mathJaxPromise
}

export async function renderMath(element) {
  if (typeof window === 'undefined' || !element) return
  await loadMathJax().catch(() => {})
  if (window.MathJax?.typesetPromise) {
    await window.MathJax.typesetPromise([element]).catch(() => {})
  }
}
