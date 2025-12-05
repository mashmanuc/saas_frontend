import { defineStore } from 'pinia'

export const useLoaderStore = defineStore('loader', {
  state: () => ({
    active: 0,
  }),

  getters: {
    isLoading: (state) => state.active > 0,
  },

  actions: {
    start() {
      this.active += 1
    },
    stop() {
      if (this.active > 0) {
        this.active -= 1
      }
    },
    reset() {
      this.active = 0
    },
  },
})
