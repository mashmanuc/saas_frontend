import { defineStore } from 'pinia'
import { notifications, notifySuccess, notifyError, notifyWarning, notifyInfo } from '../utils/notify'

const DEFAULT_AUTO_HIDE_MS = 4000
let unsubscribe = null

export const useNotifyStore = defineStore('notify', {
  state: () => ({
    items: [],
  }),

  actions: {
    init() {
      if (unsubscribe) return
      unsubscribe = notifications.subscribe((payload) => {
        this.enqueue(payload)
      })
    },

    enqueue(payload) {
      const entry = {
        ...payload,
        timer: setTimeout(() => this.dismiss(payload.id), payload.meta?.timeout ?? DEFAULT_AUTO_HIDE_MS),
      }
      this.items.push(entry)
    },

    dismiss(id) {
      const index = this.items.findIndex((item) => item.id === id)
      if (index === -1) return
      const [item] = this.items.splice(index, 1)
      if (item?.timer) {
        clearTimeout(item.timer)
      }
    },

    clear() {
      this.items.forEach((item) => {
        if (item?.timer) clearTimeout(item.timer)
      })
      this.items = []
    },

    success(message, meta) {
      notifySuccess(message, meta)
    },
    error(message, meta) {
      notifyError(message, meta)
    },
    warning(message, meta) {
      notifyWarning(message, meta)
    },
    info(message, meta) {
      notifyInfo(message, meta)
    },
  },
})
