import fs from 'node:fs'
import path from 'node:path'

const translations = [
  ['calendar.sort.default', 'Default'],
  ['calendar.sort.experience_desc', 'Most experienced'],
  ['calendar.sort.label', 'Sort'],
  ['calendar.sort.price_asc', 'Price: low to high'],
  ['calendar.sort.price_desc', 'Price: high to low'],
  ['calendar.sort.rating', 'Highest rating'],
  ['calendar.subjects.biology', 'Biology'],
  ['calendar.subjects.business-english', 'Business English'],
  ['calendar.subjects.chemistry', 'Chemistry'],
  ['calendar.subjects.chinese', 'Chinese'],
  ['calendar.subjects.computer-science', 'Computer science'],
  ['calendar.subjects.drawing', 'Drawing'],
  ['calendar.subjects.finance', 'Finance'],
  ['calendar.subjects.french', 'French'],
  ['calendar.subjects.german', 'German'],
  ['calendar.subjects.gre', 'GRE prep'],
  ['calendar.subjects.guitar', 'Guitar'],
  ['calendar.subjects.ielts', 'IELTS prep'],
  ['calendar.subjects.japanese', 'Japanese'],
  ['calendar.subjects.management', 'Management'],
  ['calendar.subjects.marketing', 'Marketing'],
  ['calendar.subjects.mathematics', 'Mathematics'],
  ['calendar.subjects.photography', 'Photography'],
  ['calendar.subjects.physics', 'Physics'],
  ['calendar.subjects.piano', 'Piano'],
  ['calendar.subjects.polish', 'Polish'],
  ['calendar.subjects.sat', 'SAT prep'],
  ['calendar.subjects.spanish', 'Spanish'],
  ['calendar.subjects.toefl', 'TOEFL prep'],
  ['calendar.subjects.ukrainian', 'Ukrainian'],
  ['calendar.tooltips.clickToBook', 'Click to book'],
  ['calendar.tooltips.clickToCreate', 'Click to create a lesson'],
  ['calendar.trialRequest.durationLabel', 'Duration'],
  ['calendar.trialRequest.error', 'Could not submit request.'],
  ['calendar.trialRequest.minutesShort', 'min'],
  ['calendar.trialRequest.submit', 'Book a free lesson'],
  ['calendar.trialRequest.submitting', 'Sending…'],
  ['calendar.trialRequest.success', 'Trial lesson request sent (pending).'],
  ['calendar.trialRequest.timeLabel', 'Time'],
  ['calendar.trialRequest.title', 'Confirm trial lesson'],
  ['calendar.tutorCard.experience', 'Experience'],
  ['calendar.tutorCard.experienceYears', '{years} years'],
  ['calendar.tutorCard.language', 'Language'],
  ['calendar.tutorCard.rate', 'Rate'],
  ['calendar.warnings.offline', 'Connection lost. Please try again.'],
  ['calendar.weekNavigation.createSlot', 'Add slot'],
  ['calendar.weekNavigation.showGuide', 'Show guide'],
  ['common.delete', 'Delete'],
  ['common.edit', 'Edit'],
  ['common.save', 'Save'],
  ['common.understood', 'Got it'],
  ['common.weekdays.full.fri', 'Friday'],
  ['common.weekdays.full.mon', 'Monday'],
  ['common.weekdays.full.sat', 'Saturday'],
  ['common.weekdays.full.sun', 'Sunday'],
  ['common.weekdays.full.thu', 'Thursday'],
  ['common.weekdays.full.tue', 'Tuesday'],
  ['common.weekdays.full.wed', 'Wednesday'],
  ['common.weekdays.short.fri', 'Fri'],
  ['common.weekdays.short.mon', 'Mon'],
  ['common.weekdays.short.sat', 'Sat'],
  ['common.weekdays.short.sun', 'Sun'],
  ['common.weekdays.short.thu', 'Thu'],
  ['common.weekdays.short.tue', 'Tue'],
  ['common.weekdays.short.wed', 'Wed'],
  ['errors.networkError', 'Network error'],
  ['errors.somethingWentWrong', 'Something went wrong'],
  ['lessons.calendar.createTitle', 'Create lesson'],
  ['marketplace.availableSlots', 'Available slots'],
  ['marketplace.noAvailableSlots', 'No slots available'],
  ['matches.messaging.banner', 'Use this chat before the first lesson. Please stay polite and professional.'],
  ['matches.messaging.placeholder', 'Type a message...'],
  ['oldBooking.inviteStudent', 'Invite a new student'],
  ['oldBooking.modal.confirm', 'Confirm booking'],
  ['oldBooking.modal.confirming', 'Confirming...'],
  ['oldBooking.modal.noteLabel', 'Note'],
  ['oldBooking.modal.notePlaceholder', 'Add a note to the request...'],
  ['oldBooking.modal.selectedSlot', 'Selected slot'],
  ['oldBooking.modal.successMessage', 'The tutor received your booking request'],
  ['oldBooking.modal.successTitle', 'Request sent!'],
  ['oldBooking.modal.title', 'Book a lesson'],
  ['oldBooking.modal.tutorResponseTime', 'Tutor usually replies within 24 hours'],
  ['oldBooking.noStudentsFound', 'No students found'],
  ['oldBooking.selectStudent', 'Select student'],
  ['oldBooking.timeline.by', 'By {actor}'],
  ['oldBooking.timeline.empty', 'Timeline is empty'],
  ['oldBooking.timeline.events.canceled', 'Canceled'],
  ['oldBooking.timeline.events.confirmed', 'Confirmed'],
  ['oldBooking.timeline.events.created', 'Created'],
  ['oldBooking.timeline.requestId', 'Request ID'],
  ['oldBooking.timeline.title', 'Booking history'],
  ['oldBooking.typeToSearch', 'Type at least 2 characters to search'],
  ['profile.security.mfa.codesCopied', 'Codes copied to clipboard'],
  ['profile.security.mfa.copyCodes', 'Copy codes'],
  ['profile.security.mfa.downloadCodes', 'Download codes'],
  ['profile.security.mfa.regenerateCodes', 'Generate new codes'],
  ['profile.security.mfa.regenerateConfirm', 'This will invalidate previous codes. Continue?'],
  ['profile.security.mfa.viewBackupCodes', 'View backup codes']
]

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales')
const enPath = path.join(localesDir, 'en.json')
const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'))

function setValue(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cursor = obj
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (i === parts.length - 1) {
      cursor[part] = value
      return
    }
    if (!cursor[part] || typeof cursor[part] !== 'object') {
      cursor[part] = {}
    }
    cursor = cursor[part]
  }
}

for (const [key, value] of translations) {
  setValue(enData, key, value)
}

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n')
console.log(`[apply-en-missing] Updated ${translations.length} keys in en.json`)
