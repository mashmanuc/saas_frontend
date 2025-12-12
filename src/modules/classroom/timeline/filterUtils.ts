import { Users, Pencil, Video, Settings, AlertCircle } from 'lucide-vue-next'

export interface TimelineFilter {
  type: string
  label: string
  icon: any
  types: string[]
}

export const TIMELINE_FILTERS: TimelineFilter[] = [
  {
    type: 'participants',
    label: 'Учасники',
    icon: Users,
    types: ['participant_join', 'participant_leave', 'participant_reconnect'],
  },
  {
    type: 'board',
    label: 'Дошка',
    icon: Pencil,
    types: ['board_stroke', 'board_object_create', 'board_object_delete', 'board_clear'],
  },
  {
    type: 'media',
    label: 'Медіа',
    icon: Video,
    types: ['media_toggle', 'screen_share_start', 'screen_share_stop'],
  },
  {
    type: 'system',
    label: 'Система',
    icon: Settings,
    types: ['session_start', 'session_end', 'session_pause', 'session_resume'],
  },
  {
    type: 'errors',
    label: 'Помилки',
    icon: AlertCircle,
    types: ['error'],
  },
]

export function getEventTypesForFilters(selectedFilters: string[]): string[] {
  if (selectedFilters.length === 0) return []

  const types: string[] = []
  for (const filter of TIMELINE_FILTERS) {
    if (selectedFilters.includes(filter.type)) {
      types.push(...filter.types)
    }
  }
  return types
}
