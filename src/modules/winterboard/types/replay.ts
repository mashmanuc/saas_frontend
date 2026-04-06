// A11: Replay TypeScript types
// Ref: DAY16_AGENT-A.md — точно відповідають BE serializers
// Zone: AGENT-A (types/)

// ─── Board Operation (operation log entry) ─────────────────────────────────

export interface BoardOperation {
  id: number           // int PK
  op_type: string      // 'stroke_add','stroke_delete','asset_add','asset_move',
                       // 'text_add','text_update','page_add','page_delete','clear_page'
  page_id: string      // може бути '' якщо не вказано
  payload: Record<string, unknown>
  user: number | null  // FK int, НЕ user_id
  created_at: string   // ISO datetime, sorted ASC
}

// ─── Replay timeline response (GET /sessions/{uuid}/replay/) ───────────────

export interface ReplayTimeline {
  session_id: string   // UUID (НЕ int!)
  total_operations: number
  operations: BoardOperation[]
}

// ─── Record operation request (POST .../replay/operation/) ─────────────────

export interface RecordOperationRequest {
  op_id?: string       // REPLAY-INV-8: UUID, генерується на FE при enqueue(), незмінний при retry
  op_type: string
  page_id?: string     // optional, default ''
  payload?: Record<string, unknown>  // max 64KB
  timestamp?: number   // Phase 20: client-side Date.now(), optional
}

// ─── Batch record request (POST .../replay/batch/) ─────────────────────────

export interface BatchRecordRequest {
  operations: RecordOperationRequest[]  // max 100
}

// ─── Replay query params ────────────────────────────────────────────────────

export interface ReplayQuery {
  page_id?: string
  op_type?: string
  limit?: number    // default 500, max 2000
  offset?: number
}

// ─── Replay snapshot (Phase 10 P4: fast seek support) ───────────────────────

export interface ReplaySnapshot {
  id: string
  operation_index: number
  board_state: Record<string, unknown>
  created_at: string   // ISO datetime
}
