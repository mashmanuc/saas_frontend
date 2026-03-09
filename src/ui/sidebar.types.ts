export interface SidebarItem {
  label: string
  icon: string
  to: string
  badge?: number
  badgeType?: 'danger' | 'warning' | 'info'
}

export interface SidebarSection {
  key: string
  label?: string
  items: SidebarItem[]
}
