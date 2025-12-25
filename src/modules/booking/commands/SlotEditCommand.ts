import { bookingApi } from '../api/booking'
import type { Command } from '@/composables/useUndoRedo'
import type { SlotEditStrategy } from '../types/slot'

export interface SlotData {
  start_time: string
  end_time: string
  strategy: SlotEditStrategy
  override_reason?: string
}

export class EditSlotCommand implements Command {
  private slotId: string
  private oldData: SlotData
  private newData: SlotData
  public description: string

  constructor(
    slotId: string,
    oldData: SlotData,
    newData: SlotData
  ) {
    this.slotId = slotId
    this.oldData = oldData
    this.newData = newData
    this.description = `Edit slot ${slotId} from ${oldData.start_time}-${oldData.end_time} to ${newData.start_time}-${newData.end_time}`
  }

  async execute() {
    const response = await bookingApi.editSlot(this.slotId, this.newData)
    return response.slot || response
  }

  async undo() {
    const response = await bookingApi.editSlot(this.slotId, this.oldData)
    return response.slot || response
  }

  async redo() {
    return this.execute()
  }
}

export class DeleteSlotCommand implements Command {
  private slotId: number
  private slotData: any
  public description: string

  constructor(slotId: number, slotData: any) {
    this.slotId = slotId
    this.slotData = slotData
    this.description = `Delete slot ${slotId}`
  }

  async execute() {
    await bookingApi.deleteSlot(this.slotId)
    return { success: true }
  }

  async undo() {
    // Recreate slot - would need a create slot API endpoint
    // For now, throw error as this operation is not reversible
    throw new Error('Delete operation cannot be undone without create slot API')
  }
}

export class BatchEditSlotsCommand implements Command {
  private slotIds: number[]
  private oldDataMap: Map<number, SlotData>
  private newData: Partial<SlotData> & { strategy: SlotEditStrategy }
  public description: string

  constructor(
    slotIds: number[],
    oldDataMap: Map<number, SlotData>,
    newData: Partial<SlotData> & { strategy: SlotEditStrategy }
  ) {
    this.slotIds = slotIds
    this.oldDataMap = oldDataMap
    this.newData = newData
    this.description = `Batch edit ${slotIds.length} slots`
  }

  async execute() {
    const response = await bookingApi.batchEditSlots({
      slots: this.slotIds,
      start_time: this.newData.start_time,
      end_time: this.newData.end_time,
      strategy: this.newData.strategy,
      override_reason: this.newData.override_reason
    })
    return response
  }

  async undo() {
    // Restore each slot to its original state
    const restorePromises = Array.from(this.oldDataMap.entries()).map(
      ([slotId, oldData]) => bookingApi.editSlot(slotId.toString(), oldData)
    )
    
    const results = await Promise.all(restorePromises)
    
    return {
      updated_count: results.length,
      updated_slots: results.map(r => r.slot || r),
      warnings: [],
      conflicts: []
    }
  }

  async redo() {
    return this.execute()
  }
}
