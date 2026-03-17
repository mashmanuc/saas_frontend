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
    { label: 'menu.tutorCalendar', icon: 'book', to: '/tutor/schedule' },
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard' },
    { label: 'menu.knowledge', icon: 'library', to: '/knowledge' },
    { label: 'menu.tutorProfile', icon: 'briefcase', to: '/tutor/profile' },
    { label: 'menu.account', icon: 'user', to: '/settings' },
    { label: 'menu.billing', icon: 'credit-card', to: '/tutor/billing' },    
    { label: 'menu.notifications', icon: 'bell', to: '/notifications' },
  ],
  student: [
    { label: 'menu.dashboard', icon: 'home', to: '/student' },
    { label: 'menu.marketplace', icon: 'users', to: '/marketplace' },
    { label: 'menu.calendar', icon: 'calendar', to: '/student/schedule' },
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard' },
    { label: 'menu.account', icon: 'user', to: '/settings' },
  ],
}

export function getMenuByRole(role) {
  if (!role) return []
  return MENU_BY_ROLE[role] || []
}

/**
 * Sectioned menu configuration for AppSidebar.
 * Each role has sections with items.
 * Icons = Lucide icon names (kebab-case).
 * Labels = i18n keys.
 *
 * Ref: docs/onboarding/UX_PRODUCT_VISION.md §2.2, §2.3
 */
export const SECTIONED_MENU_BY_ROLE = {
  tutor: [
    {
      key: 'main',
      label: 'sidebar.section.main',
      items: [
        { label: 'sidebar.item.dashboard', icon: 'layout-dashboard', to: '/tutor' },
        { label: 'sidebar.item.schedule', icon: 'calendar', to: '/tutor/schedule' },
      ],
    },
    {
      key: 'teaching',
      label: 'sidebar.section.teaching',
      items: [
        { label: 'sidebar.item.knowledgeHub', icon: 'book-open', to: '/knowledge' },
        { label: 'sidebar.item.lessonCatalog', icon: 'search', to: '/knowledge/catalog' },
      ],
    },
    {
      key: 'winterboard',
      label: 'sidebar.section.winterboard',
      items: [
        { label: 'sidebar.item.wbDashboard', icon: 'layout-dashboard', to: '/winterboard/dashboard' },
        { label: 'sidebar.item.wbLibrary', icon: 'folder', to: '/winterboard/library' },
        { label: 'sidebar.item.wbBoards', icon: 'layout', to: '/winterboard/boards' },
      ],
    },
    {
      key: 'students',
      label: 'sidebar.section.students',
      items: [
        { label: 'sidebar.item.myStudents', icon: 'users', to: '/tutor/students' },
        { label: 'sidebar.item.inquiries', icon: 'inbox', to: '/tutor/inquiries' },
      ],
    },
    {
      key: 'business',
      label: 'sidebar.section.business',
      items: [
        { label: 'sidebar.item.tutorProfile', icon: 'briefcase', to: '/tutor/profile' },
        { label: 'sidebar.item.billing', icon: 'wallet', to: '/tutor/billing' },
      ],
    },
    {
      key: 'system',
      label: 'sidebar.section.system',
      items: [
        { label: 'sidebar.item.settings', icon: 'settings', to: '/settings' },
        { label: 'sidebar.item.notifications', icon: 'bell', to: '/notifications' },
      ],
    },
  ],

  student: [
    {
      key: 'main',
      label: 'sidebar.section.main',
      items: [
        { label: 'sidebar.item.dashboard', icon: 'layout-dashboard', to: '/student' },
        { label: 'sidebar.item.mySchedule', icon: 'calendar', to: '/student/schedule' },
      ],
    },
    {
      key: 'winterboard',
      label: 'sidebar.section.winterboard',
      items: [
        { label: 'sidebar.item.wbDashboard', icon: 'layout-dashboard', to: '/winterboard/dashboard' },
        { label: 'sidebar.item.wbLibrary', icon: 'folder', to: '/winterboard/library' },
        { label: 'sidebar.item.wbBoards', icon: 'layout', to: '/winterboard/boards' },
      ],
    },
    {
      key: 'tutors',
      label: 'sidebar.section.tutors',
      items: [
        { label: 'sidebar.item.findTutor', icon: 'search', to: '/marketplace' },
        { label: 'sidebar.item.lessonCatalog', icon: 'book-open', to: '/knowledge/catalog' },
        { label: 'sidebar.item.myInquiries', icon: 'inbox', to: '/student/inquiries' },
      ],
    },
    {
      key: 'system',
      label: 'sidebar.section.system',
      items: [
        { label: 'sidebar.item.settings', icon: 'settings', to: '/settings' },
      ],
    },
  ],

  admin: [
    {
      key: 'main',
      label: 'sidebar.section.main',
      items: [
        { label: 'sidebar.item.staffPanel', icon: 'layout-dashboard', to: '/staff' },
        { label: 'sidebar.item.classrooms', icon: 'graduation-cap', to: '/classrooms' },
      ],
    },
    {
      key: 'system',
      label: 'sidebar.section.system',
      items: [
        { label: 'sidebar.item.profile', icon: 'settings', to: '/settings' },
        { label: 'sidebar.item.security', icon: 'settings', to: '/settings/security' },
      ],
    },
  ],

  superadmin: [
    {
      key: 'main',
      label: 'sidebar.section.main',
      items: [
        { label: 'sidebar.item.staffPanel', icon: 'layout-dashboard', to: '/staff' },
        { label: 'sidebar.item.classrooms', icon: 'graduation-cap', to: '/classrooms' },
      ],
    },
    {
      key: 'system',
      label: 'sidebar.section.system',
      items: [
        { label: 'sidebar.item.security', icon: 'settings', to: '/settings/security' },
        { label: 'sidebar.item.devPlayground', icon: 'settings', to: '/dev/theme' },
      ],
    },
  ],
}

/**
 * Get sectioned menu for AppSidebar by role.
 */
export function getSectionedMenuByRole(role) {
  if (!role) return []
  return SECTIONED_MENU_BY_ROLE[role] || []
}
