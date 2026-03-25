/**
 * Phase 33: Flatten recursive folder tree for dropdown/list rendering.
 *
 * MoveAssetDropdown needs a flat list with depth for indentation.
 */
import type { LibraryFolderTree } from '../types/library'

export interface FlatFolder {
  id: number
  name: string
  depth: number
}

export function flattenFolderTree(tree: LibraryFolderTree[], depth = 0): FlatFolder[] {
  const result: FlatFolder[] = []
  for (const node of tree) {
    result.push({ id: node.id, name: node.name, depth })
    if (node.children?.length) {
      result.push(...flattenFolderTree(node.children, depth + 1))
    }
  }
  return result
}
