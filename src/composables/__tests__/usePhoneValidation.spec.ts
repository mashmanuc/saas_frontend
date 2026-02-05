/**
 * Unit tests for usePhoneValidation composable.
 * 
 * Phase 1: Student Contact Data
 * Docs: docs/FIRST_CONTACT/TZ_STUDENT_CONTACT_DATA_FIX_2026-02-04.md
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePhoneValidation } from '../usePhoneValidation'

describe('usePhoneValidation', () => {
  describe('isValidFormat', () => {
    it('should validate correct Ukrainian phone number', () => {
      const phone = ref('+380501234567')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(true)
    })
    
    it('should validate correct US phone number', () => {
      const phone = ref('+12025551234')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(true)
    })
    
    it('should validate correct UK phone number', () => {
      const phone = ref('+442071234567')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(true)
    })
    
    it('should reject phone without plus sign', () => {
      const phone = ref('380501234567')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
    
    it('should reject phone starting with zero', () => {
      const phone = ref('+0501234567')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
    
    it('should reject phone that is too short', () => {
      const phone = ref('+1')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
    
    it('should reject phone that is too long', () => {
      const phone = ref('+1234567890123456') // 16 digits
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
    
    it('should reject phone with letters', () => {
      const phone = ref('+38050abc1234')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
    
    it('should reject phone with spaces', () => {
      const phone = ref('+380 50 123 4567')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
    
    it('should reject empty phone', () => {
      const phone = ref('')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
    })
  })
  
  describe('errorMessage', () => {
    it('should return hint for empty phone', () => {
      const phone = ref('')
      const { errorMessage } = usePhoneValidation(phone)
      
      expect(errorMessage.value).toBeTruthy()
    })
    
    it('should return hint for invalid phone', () => {
      const phone = ref('380501234567')
      const { errorMessage } = usePhoneValidation(phone)
      
      expect(errorMessage.value).toBeTruthy()
    })
    
    it('should return null for valid phone', () => {
      const phone = ref('+380501234567')
      const { errorMessage } = usePhoneValidation(phone)
      
      expect(errorMessage.value).toBeNull()
    })
  })
  
  describe('reactivity', () => {
    it('should update validation when phone changes', () => {
      const phone = ref('')
      const { isValidFormat } = usePhoneValidation(phone)
      
      expect(isValidFormat.value).toBe(false)
      
      phone.value = '+380501234567'
      expect(isValidFormat.value).toBe(true)
      
      phone.value = 'invalid'
      expect(isValidFormat.value).toBe(false)
    })
  })
})
