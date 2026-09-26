/**
 * Діалог «незбережена робота перед виходом» (ТЗ спільного екрана, R7).
 *
 * `authStore.logout()` не виходить, якщо в браузері лежать неприйняті дії цього
 * користувача, — кладе їх сюди, і глобальний `LogoutUnsentDialog` показує вибір:
 * відкрити дошку (штатне відправлення) або явно відкинути з числом дій.
 */
import { defineStore } from 'pinia'
import type { UnsentBoardWork } from '../logout/unsentWork'

export const useLogoutGuardStore = defineStore('logoutGuard', {
  state: () => ({
    open: false,
    work: [] as UnsentBoardWork[],
  }),
  actions: {
    show(work: UnsentBoardWork[]) {
      this.work = work
      this.open = true
    },
    close() {
      this.open = false
      this.work = []
    },
  },
})
