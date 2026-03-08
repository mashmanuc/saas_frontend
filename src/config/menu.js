export const MENU_BY_ROLE = {
  superadmin: [
    { label: 'menu.dashboard', icon: 'home', to: '/staff' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.security', icon: 'shield', to: '/settings/security' },
    { label: 'dev.playground', icon: 'lab', to: '/dev/theme' },
  ],
  admin: [
    { label: 'menu.dashboard', icon: 'home', to: '/staff' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.profile', icon: 'user', to: '/settings' },
    { label: 'menu.security', icon: 'shield', to: '/settings/security' },
    { label: 'dev.playground', icon: 'lab', to: '/dev/theme' },
  ],
  tutor: [
    { label: 'menu.dashboard', icon: 'home', to: '/tutor' },
    // LEGACY: menu.classrooms → /dashboard/classrooms використовує старий apps/classrooms (Classroom model).
    // Новий Teacher OS використовує LearningGroup (/v1/learning-content/learning-groups/) через "База знань".
    // Не показуємо тьютору щоб не плутати два різних списки класів. Маршрут і бекенд збережено.
    // { label: 'menu.classrooms', icon: 'class', to: '/dashboard/classrooms' },
    { label: 'menu.tutorCalendar', icon: 'book', to: '/booking/tutor' },
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard' },
    { label: 'menu.knowledge', icon: 'library', to: '/dashboard/knowledge' },
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
