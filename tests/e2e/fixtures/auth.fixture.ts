import { test as base, expect, Page } from '@playwright/test'
import { loginAsTutor } from '../helpers/auth'

type AuthFixtures = {
  auth: {
    loginAsTutor: () => Promise<void>
  }
}

export const test = base.extend<AuthFixtures>({
  auth: async ({ page }, use) => {
    const authHelpers = {
      loginAsTutor: () => loginAsTutor(page)
    }
    await use(authHelpers)
  }
})

export { expect }
