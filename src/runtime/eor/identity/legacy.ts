/**
 * isLegacyIdentity — detect legacy (pre-identity-model) assets.
 *
 * Per colleague review P1.c — NO heuristic. Simple field check:
 *   - return !identity.template_id
 *
 * Used by shadow validator (P1.f) to log mismatches between legacy
 * (no identity) и modern (full identity) assets during P2+ migration.
 *
 * Heuristic logic was rejected because:
 *   "heuristic logic потім перетворюється у migration folklore"
 *
 * Just check the field. If template_id absent → legacy.
 */

import type { EOIdentity } from '../types/identity'

/**
 * Returns true if identity lacks `template_id` (i.e., asset was created
 * before identity model was introduced).
 */
export function isLegacyIdentity(identity: EOIdentity): boolean {
  return !identity.template_id
}
