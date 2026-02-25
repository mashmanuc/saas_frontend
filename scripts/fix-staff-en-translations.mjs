/**
 * Fix staff.* EN translations
 * Adds proper English translations for all missing staff.* keys in en.json
 * Run: node scripts/fix-staff-en-translations.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const enPath = path.join(root, 'src', 'i18n', 'locales', 'en.json')

const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'))

// ── staff.* proper English translations ─────────────────────────────────────

en.staff.consoleName = 'Admin Panel'

// breadcrumbs
en.staff.breadcrumbs = {
  ...en.staff.breadcrumbs,
  payouts: 'Payouts',
  profileModeration: 'Profile Moderation',
  verification: 'Verification',
}

// dashboard
en.staff.dashboard = {
  ...en.staff.dashboard,
  helpText: 'General platform status overview. View key metrics, recent activity, and quickly navigate to any section.',
}

// users
en.staff.users = {
  ...en.staff.users,
  helpText: 'Search and view all registered users. Click a row to see detailed information.',
}

// billing
en.staff.billing = {
  ...en.staff.billing,
  helpText: 'Platform financial overview: subscriptions, pending payments, and recent transactions.',
  pendingCheckoutsTable: 'Pending Checkout Sessions',
  order: 'Order',
  provider: 'Provider',
  showing: '{from}–{to} of {total}',
  statusSuccess: 'Success',
  statusFailed: 'Failed',
  statusPending: 'Pending',
  paymentDetail: 'Payment Detail',
  allStatuses: 'All Statuses',
}

// health
en.staff.health = {
  ...en.staff.health,
  helpText: 'Technical platform health indicators. Red means immediate action needed, yellow means monitoring required.',
  activeTutors: 'Active Tutors',
  inactive: 'inactive',
  last7d: 'last 7 days',
  reportsHint: 'Need review',
  pendingHint: 'Check in Finance section',
  statusHealthy: 'System is operating normally',
  statusWarning: 'Warnings detected — check details',
  statusCritical: 'Critical state — action required!',
  asOf: 'as of',
  alertReportsCritical: 'CRITICAL: {count} open reports — immediate action required',
  alertReportsWarning: 'Warning: {count} open reports',
  alertBansCritical: 'CRITICAL: {count} active bans',
  alertPendingWarning: 'Warning: {count} pending payment sessions',
  errorLoad: 'Failed to load monitoring data',
  pendingSessions: 'Pending Sessions',
  suspicious: 'Suspicious Users',
}

// activityFeed.actions
en.staff.activityFeed = {
  ...en.staff.activityFeed,
  actions: {
    login: 'Login',
    logout: 'Logout',
    register: 'Registration',
    ban_create: 'Ban Created',
    ban_lift: 'Ban Lifted',
    report_create: 'Report Submitted',
    report_resolve: 'Report Resolved',
    subscription_create: 'Subscription Created',
    subscription_cancel: 'Subscription Cancelled',
    profile_update: 'Profile Updated',
    email_verify: 'Email Verified',
    mfa_enable: 'MFA Enabled',
  },
}

// tutorActivity
en.staff.tutorActivity = {
  ...en.staff.tutorActivity,
  helpText: 'View tutor activity on the platform. Grant activity exemptions for individual tutors.',
}

// reports
en.staff.reports = {
  ...en.staff.reports,
  helpText: 'User reports that require review. Filter by status for convenience. Click "View" for details.',
}

// userOverview
en.staff.userOverview = {
  ...en.staff.userOverview,
  backToUsers: 'Back to Users',
  lastLogin: 'Last Login',
  never: 'Never logged in',
  emailVerification: 'Email Verification',
  emailVerified: 'Verified',
  emailNotVerified: 'Not Verified',
  verifyEmailButton: 'Verify Manually',
  verifyEmailSuccess: 'Email successfully verified',
  verifyEmailAlready: 'Email already verified',
  verifyEmailError: 'Failed to verify email',
  accountStatus: 'Account Status',
  active: 'Active',
  inactive: 'Inactive',
  activate: 'Activate',
  deactivate: 'Deactivate',
  confirmToggleActive: 'Perform action "{action}" for {email}?',
  confirmVerifyEmail: 'Verify email {email}?\nThis will activate the account.',
  publicProfile: 'Public Profile',
  openProfile: 'Open Profile',
  auditLog: 'Action History',
  auditTotal: 'Total: {count}',
  auditEmpty: 'No actions yet',
  confirmCancelImmediate: 'Are you sure you want to cancel the subscription IMMEDIATELY? This action is irreversible.',
  confirmCancelPeriodEnd: 'Cancel subscription at the end of the current period?',
}

// billingOps
en.staff.billingOps = {
  ...en.staff.billingOps,
  title: 'Billing Operations',
  refresh: 'Refresh',
  loading: 'Loading billing data...',
  retry: 'Retry',
  snapshotMissing: 'User data not available',
  userSection: 'User',
  email: 'Email',
  role: 'Role',
  entitlementSection: 'Entitlements',
  plan: 'Plan',
  expires: 'Expires',
  features: 'features',
  subscriptionSection: 'Subscription',
  status: 'Status',
  provider: 'Provider',
  periodStart: 'Period Start',
  periodEnd: 'Period End',
  cancelAtPeriodEnd: 'Cancel at Period End',
  yes: 'Yes',
  none: 'none',
  sessionsSection: 'Checkout Sessions (last 10)',
  noSessions: 'No checkout sessions',
  orderId: 'Order ID',
  pendingSince: 'Pending Since',
  pendingAge: 'Pending Age',
  created: 'Created',
  actions: 'Actions',
  previewFinalize: 'Preview & Finalize',
  copyOrderId: 'Copy Order ID',
  never: 'Never',
}

// profileModeration
en.staff.profileModeration = {
  ...en.staff.profileModeration,
  title: 'Profile Moderation',
  helpText: 'Review and approve tutor profiles. New profiles require verification before being published to the marketplace.',
  loading: 'Loading profiles...',
  empty: 'No profiles to moderate. All profiles have been reviewed.',
  allStatuses: 'All Statuses',
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusRejected: 'Rejected',
  statusSuspended: 'Suspended',
  statusDraft: 'Draft',
  table: {
    tutor: 'Tutor',
    email: 'Email',
    subjects: 'Subjects',
    status: 'Status',
    createdAt: 'Created',
    actions: 'Actions',
  },
  approve: 'Approve',
  reject: 'Reject',
  viewProfile: 'View Profile',
  rejectModal: {
    title: 'Reject Profile',
    reasonLabel: 'Rejection Reason',
    reasonPlaceholder: 'Provide a reason for rejecting this profile...',
    cancel: 'Cancel',
    confirm: 'Reject Profile',
  },
  approveConfirm: 'Approve profile for {name}? It will become visible on the marketplace.',
  approveSuccess: 'Profile successfully approved',
  rejectSuccess: 'Profile rejected',
  error: 'Failed to perform action. Please try again.',
}

// verification
en.staff.verification = {
  ...en.staff.verification,
  title: 'Tutor Verification',
  helpText: 'Review tutor documents to verify their qualifications. View uploaded documents and make a decision.',
  loading: 'Loading applications...',
  empty: 'No verification requests. All documents have been reviewed.',
  allStatuses: 'All Statuses',
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusRejected: 'Rejected',
  table: {
    tutor: 'Tutor',
    email: 'Email',
    type: 'Document Type',
    submittedAt: 'Submitted',
    status: 'Status',
    actions: 'Actions',
  },
  approve: 'Approve',
  reject: 'Reject',
  viewDocuments: 'View Documents',
  rejectModal: {
    title: 'Reject Verification',
    reasonLabel: 'Rejection Reason',
    reasonPlaceholder: 'Provide a reason for rejecting this verification...',
    cancel: 'Cancel',
    confirm: 'Reject Verification',
  },
  approveConfirm: 'Approve verification for {name}?',
  approveSuccess: 'Verification successfully approved',
  rejectSuccess: 'Verification rejected',
  error: 'Failed to perform action. Please try again.',
}

// payouts
en.staff.payouts = {
  ...en.staff.payouts,
  title: 'Tutor Payouts',
  helpText: 'Manage payout requests from tutors. Review and process requests sequentially: Pending → Approved → Processing → Completed.',
  allStatuses: 'All Statuses',
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusProcessing: 'Processing',
  statusCompleted: 'Completed',
  statusFailed: 'Failed',
  statusCancelled: 'Cancelled',
  refresh: 'Refresh',
  loading: 'Loading payouts...',
  empty: 'No payouts. Tutor requests will appear here.',
  error: 'Failed to load payouts',
  showing: '{count} of {total} shown',
  approve: 'Approve',
  process: 'Process',
  complete: 'Complete',
  fail: 'Mark as Failed',
  confirmApprove: 'Approve payout #{id}?',
  confirmProcess: 'Start processing payout #{id}?',
  table: {
    id: 'ID',
    tutor: 'Tutor',
    amount: 'Amount',
    method: 'Method',
    status: 'Status',
    createdAt: 'Request Date',
    actions: 'Actions',
  },
  completeModal: {
    title: 'Complete Payout',
    providerIdLabel: 'Provider Transaction ID',
    providerIdPlaceholder: 'Enter transaction ID (optional)',
    confirm: 'Confirm Payout',
  },
  failModal: {
    title: 'Mark as Failed',
    reasonLabel: 'Failure Reason',
    reasonPlaceholder: 'Provide a reason...',
    confirm: 'Mark as Failed',
  },
}

// sidebar additions
en.staff.sidebar = {
  ...en.staff.sidebar,
  financeSection: 'Finance',
  payouts: 'Tutor Payouts',
  profileModeration: 'Profile Moderation',
  verification: 'Verification',
}

// toast
en.staff.toast = {
  ...en.staff.toast,
  banCreated: 'Ban successfully created',
  banLifted: 'Ban successfully lifted',
  reportResolved: 'Report resolved',
  billingCancelled: 'Subscription cancelled',
  emailVerified: 'Email successfully verified',
  exemptionGranted: 'Exemption granted',
  profileApproved: 'Profile approved',
  profileRejected: 'Profile rejected',
  verificationApproved: 'Verification approved',
  verificationRejected: 'Verification rejected',
  error: 'Error: {message}',
  genericError: 'An error occurred. Please try again.',
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n')
console.log('[fix-staff-en] Done: all staff.* EN translations applied')
