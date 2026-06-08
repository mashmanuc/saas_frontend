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
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard/boards' },
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
    { label: 'menu.winterboard', icon: 'edit', to: '/winterboard/boards' },
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
 * Phase 3 (Sidebar Final): затверджена структура після доменного аудиту —
 * 5 секцій tutor / 3 секції student. Сутності розділені чітко:
 *   - KnowledgeLesson ("Мої уроки") ≠ WBSession Solo ("Мої дошки") ≠ LibraryAsset ("Матеріали")
 *
 * Ref:
 *   - saas_docs/plans/DASHBOARD_ACTIVATION_PLAN.md §10
 *   - memory/project_nav_decisions.md (затверджена структура)
 *   - memory/project_domain_entities_navigation.md (розрізнення сутностей)
 */
export const SECTIONED_MENU_BY_ROLE = {
  // ====================================================
  // TUTOR — 5 секцій, 10 пунктів
  // ====================================================
  tutor: [
    {
      key: 'main',
      label: 'sidebar.section.main',
      items: [
        { label: 'sidebar.item.dashboard', icon: 'layout-dashboard', to: '/tutor', hint: 'sidebar.hint.dashboard' },
        { label: 'sidebar.item.schedule', icon: 'calendar', to: '/tutor/schedule', hint: 'sidebar.hint.schedule' },
        // Marketplace — перегляд публічного каталогу тьюторів (як його бачать студенти).
        { label: 'sidebar.item.marketplace', icon: 'search', to: '/marketplace', hint: 'sidebar.hint.marketplace' },
      ],
    },
    {
      // НАВЧАННЯ — чотири окремі сутності: уроки, дошки, записи, матеріали
      // Phase 1.6: «Мої записи» додано для UX-gap (replays існують на backend,
      // але тьютор не мав UI для перегляду)
      key: 'teaching',
      label: 'sidebar.section.teaching',
      items: [
        // Classroom Hub RETIRED (CLASSROOM_HUB_RETIREMENT_PLAN_2026-06-07) — пункт прибрано.
        // join → Dashboard «Майбутні» + LESSON_STARTED notif; re-entry → G4 CTA; conduct → «Мої уроки».
        { label: 'sidebar.item.myLessons', icon: 'book-open', to: '/knowledge/my-lessons', hint: 'sidebar.hint.myLessons' },
        // Lesson Constructor живе у /winterboard/boards (вкладка "Конструктор"), не у sidebar.
        // Гейтується через isLessonConstructorEnabled() у WBBoardList.vue.
        { label: 'sidebar.item.myBoards', icon: 'layout', to: '/winterboard/boards', hint: 'sidebar.hint.wbBoards' },
        { label: 'sidebar.item.myReplays', icon: 'film', to: '/winterboard/replays', hint: 'sidebar.hint.myReplays' },
        { label: 'sidebar.item.materials', icon: 'folder', to: '/winterboard/library', hint: 'sidebar.hint.wbLibrary' },
      ],
    },
    {
      key: 'students',
      label: 'sidebar.section.students',
      items: [
        { label: 'sidebar.item.myStudents', icon: 'users', to: '/tutor/students', hint: 'sidebar.hint.myStudents' },
        { label: 'sidebar.item.inquiries', icon: 'inbox', to: '/tutor/inquiries', hint: 'sidebar.hint.inquiries' },
      ],
    },
    {
      // ПІДПИСКА — окрема секція для SaaS-плану (готується до prod)
      key: 'subscription',
      label: 'sidebar.section.subscription',
      items: [
        { label: 'sidebar.item.myPlan', icon: 'wallet', to: '/tutor/billing', hint: 'sidebar.hint.billing' },
      ],
    },
    {
      // ПРОФІЛЬ — публічний профіль тьютора + особисті налаштування
      key: 'profile',
      label: 'sidebar.section.profile',
      items: [
        { label: 'sidebar.item.tutorProfile', icon: 'briefcase', to: '/tutor/profile', hint: 'sidebar.hint.tutorProfile' },
        { label: 'sidebar.item.feedback', icon: 'lightbulb', to: '/feedback', hint: 'sidebar.hint.feedback' },
        { label: 'sidebar.item.settings', icon: 'settings', to: '/settings', hint: 'sidebar.hint.settings' },
      ],
    },
  ],

  // ====================================================
  // STUDENT — 3 секції, 5 пунктів
  // Student solo-дошка прибрана повністю (memory/feedback_student_no_solo_board).
  // ====================================================
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
      key: 'tutors',
      label: 'sidebar.section.tutors',
      items: [
        { label: 'sidebar.item.findTutor', icon: 'search', to: '/marketplace' },
        { label: 'sidebar.item.myInquiries', icon: 'inbox', to: '/student/inquiries' },
      ],
    },
    {
      key: 'profile',
      label: 'sidebar.section.profile',
      items: [
        { label: 'sidebar.item.feedback', icon: 'lightbulb', to: '/feedback' },
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
