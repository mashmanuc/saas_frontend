// Payments Module Exports
//
// 2026-07-27 (вимога власника «прибери мертвий modules/payments хвіст»):
// git rm marketplace-зоопарку — wallet/payout/invoices/checkout/subscription
// views+stores+composables+components+api (гроші учень↔тьютор через платформу
// ЗАБОРОНЕНІ бізнес-правилом; 0 зовнішніх споживачів, роутів не існувало).
// Живі лишились рівно два: публічна сторінка тарифів і її генератор характеристик.
export { default as PlansView } from './views/PlansView.vue'
export { buildPlanFeatures, DISPLAY_FEATURE_KEYS, HIDDEN_TECHNICAL_KEYS } from './planLimitFeatures'
