// Replay Folders API — тонкий re-export з replayLifecycleApi.ts.
//
// Мета: дзеркалити патерн Library, де folder CRUD живе у окремому модулі.
// Всередині платформи функції лишаються в replayLifecycleApi.ts (щоб не ламати
// існуючі імпорти у replayStore.ts), а цей файл — публічний вхід для нового
// UI (ReplayFolderTree, MoveReplayDropdown, WBReplayList).
//
// SSOT: saas_docs/manifest/REPLAY_DOMAIN_SSOT.md §6-§7.

export type {
  Replay,
  ReplayFolder,
  ReplayListParams,
  ReplayStatus,
  ReplayVisibility,
} from './replayLifecycleApi'

export {
  createReplayFolder,
  deleteReplayFolder,
  listReplayFolders,
  moveReplayToFolder,
  updateReplayFolder,
} from './replayLifecycleApi'

import type { ReplayFolder } from './replayLifecycleApi'

// ─── Tree helpers ────────────────────────────────────────────────────

export interface ReplayFolderTreeNode extends ReplayFolder {
  children: ReplayFolderTreeNode[]
  replays_count?: number
}

/**
 * Будує ієрархічне дерево з плоского списку папок.
 * Сортування: `position ASC, name ASC` (симетрія з Meta.ordering у backend).
 *
 * Циклічні parent-посилання (теоретично заборонені на API-level, R6) відсікаються —
 * папка без досяжного root потрапляє у "orphans" і додається до root, щоб UI
 * не губив дані при розсинхронізації.
 */
export function buildReplayFolderTree(flat: ReplayFolder[]): ReplayFolderTreeNode[] {
  const byId = new Map<string, ReplayFolderTreeNode>()
  for (const f of flat) {
    byId.set(f.id, { ...f, children: [] })
  }

  const roots: ReplayFolderTreeNode[] = []
  const orphans: ReplayFolderTreeNode[] = []

  for (const node of byId.values()) {
    if (node.parent === null) {
      roots.push(node)
      continue
    }
    const parent = byId.get(node.parent)
    if (parent) {
      parent.children.push(node)
    } else {
      // parent-FK вказує на неіснуючу (видалену?) папку — fallback у root
      orphans.push(node)
    }
  }

  const sortFn = (a: ReplayFolderTreeNode, b: ReplayFolderTreeNode) =>
    a.position - b.position || a.name.localeCompare(b.name)

  const sortRecursive = (nodes: ReplayFolderTreeNode[]) => {
    nodes.sort(sortFn)
    for (const n of nodes) sortRecursive(n.children)
  }

  const result = [...roots, ...orphans]
  sortRecursive(result)
  return result
}

/**
 * Плоский список з tree для drop-down лістингу (з depth для відступу).
 */
export interface FlatReplayFolder {
  id: string
  name: string
  depth: number
}

export function flattenReplayFolderTree(
  tree: ReplayFolderTreeNode[],
  depth = 0,
): FlatReplayFolder[] {
  const out: FlatReplayFolder[] = []
  for (const node of tree) {
    out.push({ id: node.id, name: node.name, depth })
    if (node.children.length > 0) {
      out.push(...flattenReplayFolderTree(node.children, depth + 1))
    }
  }
  return out
}
