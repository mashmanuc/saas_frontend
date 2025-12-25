/**
 * Booking Flow State Machine
 * FSM для керування станом процесу бронювання
 */

export enum BookingFlowState {
  IDLE = 'idle',
  SELECTING_SLOT = 'selecting_slot',
  FILLING_DETAILS = 'filling_details',
  SUBMITTING = 'submitting',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface BookingFlowContext {
  tutorId?: number
  selectedSlot?: any
  bookingDetails?: {
    subject?: string
    lessonType?: 'trial' | 'regular' | 'package'
    notes?: string
  }
  bookingId?: number
  error?: string
}

export type BookingFlowEvent =
  | { type: 'SELECT_SLOT'; slot: any }
  | { type: 'FILL_DETAILS'; details: BookingFlowContext['bookingDetails'] }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; bookingId: number }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'BACK' }

/**
 * Booking Flow State Machine
 */
export class BookingFlowMachine {
  private state: BookingFlowState = BookingFlowState.IDLE
  private context: BookingFlowContext = {}
  private listeners: Set<(state: BookingFlowState, context: BookingFlowContext) => void> = new Set()

  constructor(initialContext?: Partial<BookingFlowContext>) {
    if (initialContext) {
      this.context = { ...this.context, ...initialContext }
    }
  }

  getState(): BookingFlowState {
    return this.state
  }

  getContext(): BookingFlowContext {
    return { ...this.context }
  }

  send(event: BookingFlowEvent): void {
    const prevState = this.state

    switch (event.type) {
      case 'SELECT_SLOT':
        if (this.state === BookingFlowState.IDLE || this.state === BookingFlowState.SELECTING_SLOT) {
          this.context.selectedSlot = event.slot
          this.state = BookingFlowState.SELECTING_SLOT
        }
        break

      case 'FILL_DETAILS':
        if (this.state === BookingFlowState.SELECTING_SLOT) {
          this.context.bookingDetails = event.details
          this.state = BookingFlowState.FILLING_DETAILS
        }
        break

      case 'SUBMIT':
        if (this.state === BookingFlowState.FILLING_DETAILS) {
          this.state = BookingFlowState.SUBMITTING
        }
        break

      case 'SUCCESS':
        if (this.state === BookingFlowState.SUBMITTING) {
          this.context.bookingId = event.bookingId
          this.state = BookingFlowState.SUCCESS
        }
        break

      case 'ERROR':
        this.context.error = event.error
        this.state = BookingFlowState.ERROR
        break

      case 'BACK':
        if (this.state === BookingFlowState.FILLING_DETAILS) {
          this.state = BookingFlowState.SELECTING_SLOT
        } else if (this.state === BookingFlowState.ERROR) {
          this.state = BookingFlowState.FILLING_DETAILS
        }
        break

      case 'RESET':
        this.state = BookingFlowState.IDLE
        this.context = { tutorId: this.context.tutorId }
        break
    }

    if (prevState !== this.state) {
      this.notifyListeners()
    }
  }

  subscribe(listener: (state: BookingFlowState, context: BookingFlowContext) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state, this.context))
  }

  // Helper methods
  canSubmit(): boolean {
    return (
      this.state === BookingFlowState.FILLING_DETAILS &&
      !!this.context.selectedSlot &&
      !!this.context.bookingDetails?.subject
    )
  }

  isLoading(): boolean {
    return this.state === BookingFlowState.SUBMITTING
  }

  hasError(): boolean {
    return this.state === BookingFlowState.ERROR
  }

  isSuccess(): boolean {
    return this.state === BookingFlowState.SUCCESS
  }
}

/**
 * Vue Composable для використання FSM
 */
import { ref, computed, onUnmounted } from 'vue'

export function useBookingFlow(tutorId?: number) {
  const machine = new BookingFlowMachine({ tutorId })
  const state = ref(machine.getState())
  const context = ref(machine.getContext())

  const unsubscribe = machine.subscribe((newState, newContext) => {
    state.value = newState
    context.value = newContext
  })

  onUnmounted(() => {
    unsubscribe()
  })

  return {
    state,
    context,
    send: (event: BookingFlowEvent) => machine.send(event),
    canSubmit: computed(() => machine.canSubmit()),
    isLoading: computed(() => machine.isLoading()),
    hasError: computed(() => machine.hasError()),
    isSuccess: computed(() => machine.isSuccess()),
  }
}
