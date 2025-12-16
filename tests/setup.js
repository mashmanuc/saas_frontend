import { config } from '@vue/test-utils'
import { i18n } from '../src/i18n'

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
