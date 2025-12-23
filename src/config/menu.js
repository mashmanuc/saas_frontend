export const MENU_BY_ROLE = {
  superadmin: [
    { label: 'menu.dashboard', icon: 'home', to: '/admin' },
    { label: 'menu.users', icon: 'users', to: '/users' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
    { label: 'dev.playground', icon: 'lab', to: '/dev/theme' },
  ],
  admin: [
    { label: 'menu.dashboard', icon: 'home', to: '/admin' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
    { label: 'menu.profile', icon: 'user', to: '/dashboard/profile' },
    { label: 'dev.playground', icon: 'lab', to: '/dev/theme' },
  ],
  tutor: [
    { label: 'menu.dashboard', icon: 'home', to: '/tutor' },
    { label: 'menu.classrooms', icon: 'class', to: '/dashboard/classrooms' },
    { label: 'menu.students', icon: 'users', to: '/tutor/students' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
    { label: 'menu.tutorCalendar', icon: 'book', to: '/booking/tutor' },
    { label: 'menu.soloWorkspace', icon: 'edit', to: '/solo' },
    { label: 'menu.profile', icon: 'user', to: '/dashboard/profile' },
    { label: 'menu.tutorProfile', icon: 'users', to: '/marketplace/my-profile' },
  ],
  student: [
    { label: 'menu.dashboard', icon: 'home', to: '/student' },
    { label: 'menu.marketplace', icon: 'users', to: '/marketplace' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
    { label: 'menu.soloWorkspace', icon: 'edit', to: '/solo' },
    { label: 'menu.profile', icon: 'user', to: '/dashboard/profile' },
  ],
}

export function getMenuByRole(role) {
  if (!role) return []
  return MENU_BY_ROLE[role] || []
}
