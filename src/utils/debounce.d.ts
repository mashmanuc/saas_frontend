export interface DebouncedFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
}

export interface ThrottledFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay?: number): DebouncedFn<T>
export function throttle<T extends (...args: any[]) => any>(fn: T, delay?: number): ThrottledFn<T>
export function throttleLeading<T extends (...args: any[]) => any>(fn: T, delay?: number): (...args: Parameters<T>) => void
