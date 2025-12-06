export const MENU_BY_ROLE = {
  superadmin: [
    { label: 'menu.dashboard', icon: 'home', to: '/admin' },
    { label: 'menu.users', icon: 'users', to: '/users' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
  ],
  admin: [
    { label: 'menu.dashboard', icon: 'home', to: '/admin' },
    { label: 'menu.classrooms', icon: 'class', to: '/classrooms' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
  ],
  tutor: [
    { label: 'menu.dashboard', icon: 'home', to: '/tutor' },
    { label: 'menu.classrooms', icon: 'class', to: '/tutor/classrooms' },
    { label: 'menu.students', icon: 'users', to: '/tutor/students' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
  ],
  student: [
    { label: 'menu.dashboard', icon: 'home', to: '/student' },
    { label: 'menu.lessons', icon: 'book', to: '/lessons' },
  ],
}

export function getMenuByRole(role) {
  if (!role) return []
  return MENU_BY_ROLE[role] || []
}
