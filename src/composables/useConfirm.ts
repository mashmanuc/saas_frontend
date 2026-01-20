import { inject, provide, type InjectionKey } from 'vue'

export interface ConfirmService {
  confirm(message: string): Promise<boolean>
}

const ConfirmServiceKey: InjectionKey<ConfirmService> = Symbol('ConfirmService')

const defaultConfirmService: ConfirmService = {
  confirm(message: string): Promise<boolean> {
    return Promise.resolve(window.confirm(message))
  },
}

export function provideConfirmService(service: ConfirmService = defaultConfirmService): void {
  provide(ConfirmServiceKey, service)
}

export function useConfirm(): ConfirmService {
  const service = inject(ConfirmServiceKey, defaultConfirmService)
  return service
}
