export const MENU_BY_ROLE = {
  superadmin: [
    { label: 'menu.dashboard', icon: 'home', to: '/staff' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'dev.playground', icon: 'lab', to: '/dev/theme' },
  ],
  admin: [
    { label: 'menu.dashboard', icon: 'home', to: '/staff' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.profile', icon: 'user', to: '/settings' },
    { label: 'dev.playground', icon: 'lab', to: '/dev/theme' },
  ],
  tutor: [
    { label: 'menu.dashboard', icon: 'home', to: '/tutor' },
    { label: 'menu.classrooms', icon: 'class', to: '/dashboard/classrooms' },
    { label: 'menu.tutorCalendar', icon: 'book', to: '/booking/tutor' },
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard' },
    { label: 'menu.tutorProfile', icon: 'briefcase', to: '/marketplace/my-profile' },
    { label: 'menu.account', icon: 'user', to: '/settings' },
    { label: 'menu.billing', icon: 'credit-card', to: '/billing' },    
    { label: 'menu.notifications', icon: 'bell', to: '/notifications' },
   
   
  ],
  student: [
    { label: 'menu.dashboard', icon: 'home', to: '/student' },
    { label: 'menu.marketplace', icon: 'users', to: '/marketplace' },
    { label: 'menu.calendar', icon: 'calendar', to: '/calendar' },
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard' },
    { label: 'menu.account', icon: 'user', to: '/settings' },
  ],
}

export function getMenuByRole(role) {
  if (!role) return []
  return MENU_BY_ROLE[role] || []
}
