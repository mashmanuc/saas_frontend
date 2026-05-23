/**
 * EOR Flags — public API barrel.
 *
 * P1.d: pure read-only facade. Boot-time configuration.
 *
 * For production code: use module-level functions
 *   isEORuntimeEnabled / isTypeEnabled / isShadowEnabled.
 *
 * For tests: construct EORFlags class directly з custom config.
 */

export { EORFlags } from './EORFlags'
export type { EORFlagsConfig } from './EORFlags'
export {
  defaultFlags,
  isEORuntimeEnabled,
  isTypeEnabled,
  isShadowEnabled,
  parseTypeList,
} from './flags'
