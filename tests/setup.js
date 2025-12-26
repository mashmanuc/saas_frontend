import { config } from '@vue/test-utils'
import { i18n } from '../src/i18n'

// Mock window object for i18n
global.window = global.window || {}

config.global.plugins = [i18n]

// F29-STEALTH: Global stubs for router-link and other components
config.global.stubs = {
  'router-link': {
    template: '<a><slot /></a>',
  },
  'router-view': {
    template: '<div><slot /></div>',
  },
}

// Mock IndexedDB for test environment
class MockIDBDatabase {
  constructor() {
    this.objectStoreNames = {
      contains: () => false,
    }
  }
  createObjectStore() {
    return {}
  }
  transaction() {
    return {
      objectStore: () => ({
        add: () => {},
        getAll: () => ({ result: [], onerror: null, onsuccess: null }),
        clear: () => {},
      }),
    }
  }
}

class MockIDBOpenDBRequest {
  constructor() {
    this.result = new MockIDBDatabase()
    this.error = null
    this.onerror = null
    this.onsuccess = null
    this.onupgradeneeded = null
  }
}

global.indexedDB = {
  open: (name, version) => {
    const request = new MockIDBOpenDBRequest()
    setTimeout(() => {
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: request })
      }
      if (request.onsuccess) {
        request.onsuccess()
      }
    }, 0)
    return request
  },
}
