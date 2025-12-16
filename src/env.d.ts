/// <reference types="vite/client" />

// Vue SFC shims
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Asset imports
declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}
