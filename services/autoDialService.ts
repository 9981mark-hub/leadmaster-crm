import { supabase } from './supabase';

export interface AutoDialBatch {
  id: string;
  name: string;
  source: 'missed_calls' | 'excel_upload' | 'image_ocr' | 'sheet_input' | 'manual';
  status: 'ready' | 'running' | 'paused' | 'completed' | 'cancelled';
  ringTimeoutSeconds: number;
  gapSeconds: number;
  maxRetry: number;
  totalCount: number;
  completedCount: number;
  connectedCount: number;
  noAnswerCount: number;
  busyCount: number;
  skippedCount: number;
  errorCount: number;
  currentItemIndex: number;
  createdBy?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AutoDialItem {
  id: string;
  batchId: string;
  caseId: string;
  customerName: string;
  phone: string;
  memo?: string;
  sortOrder: number;
  status: 'pending' | 'dialing' | 'ringing' | 'connected' | 'completed' | 'skipped';
  result?: 'no_answer' | 'busy' | 'rejected' | 'connected' | 'invalid' | 'error' | null;
  attemptCount: number;
  lastAttemptAt?: string;
  ringDurationSeconds?: number;
  callDurationSeconds?: number;
  resultMemo?: string;
  createdAt: string;
}

export interface CreateBatchParams {
  name: string;
  source: AutoDialBatch['source'];
  ringTimeoutSeconds?: number;
  gapSeconds?: number;
  items: { caseId: string; customerName: string; phone: string; memo?: string }[];
}

export const dbToBatch = (row: any): AutoDialBatch => ({
  id: row.id,
  name: row.name,
  source: row.source,
  status: row.status,
  ringTimeoutSeconds: row.ring_timeout_seconds,
  gapSeconds: row.gap_seconds,
  maxRetry: row.max_retry,
  totalCount: row.total_count,
  completedCount: row.completed_count,
  connectedCount: row.connected_count,
  noAnswerCount: row.no_answer_count,
  busyCount: row.busy_count,
  skippedCount: row.skipped_count,
  errorCount: row.error_count,
  currentItemIndex: row.current_item_index,
  createdBy: row.created_by,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
});

export const dbToItem = (row: any): AutoDialItem => ({
  id: row.id,
  batchId: row.batch_id,
  caseId: row.case_id,
  customerName: row.customer_name,
  phone: row.phone,
  memo: row.memo,
  sortOrder: row.sort_order,
  status: row.status,
  result: row.result,
  attemptCount: row.attempt_count,
  lastAttemptAt: row.last_attempt_at,
  ringDurationSeconds: row.ring_duration_seconds,
  callDurationSeconds: row.call_duration_seconds,
  resultMemo: row.result_memo,
  createdAt: row.created_at,
});

export const fetchBatches = async (): Promise<AutoDialBatch[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('auto_dial_batches')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(dbToBatch);
  } catch (error) {
    console.error('[AutoDial] fetchBatches error:', error);
    return [];
  }
};

export const fetchBatch = async (batchId: string): Promise<AutoDialBatch | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('auto_dial_batches')
      .select('*')
      .eq('id', batchId)
      .single();
      
    if (error) throw error;
    return data ? dbToBatch(data) : null;
  } catch (error) {
    console.error('[AutoDial] fetchBatch error:', error);
    return null;
  }
};

export const fetchBatchItems = async (batchId: string): Promise<AutoDialItem[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('auto_dial_items')
      .select('*')
      .eq('batch_id', batchId)
      .order('sort_order', { ascending: true });
      
    if (error) throw error;
    return (data || []).map(dbToItem);
  } catch (error) {
    console.error('[AutoDial] fetchBatchItems error:', error);
    return [];
  }
};

export const createBatch = async (params: CreateBatchParams): Promise<AutoDialBatch | null> => {
  if (!supabase) return null;
  try {
    const batchInsert = {
      name: params.name,
      source: params.source,
      status: 'ready',
      ring_timeout_seconds: params.ringTimeoutSeconds || 30,
      gap_seconds: params.gapSeconds || 5,
      max_retry: 3,
      total_count: params.items.length,
      completed_count: 0,
      connected_count: 0,
      no_answer_count: 0,
      busy_count: 0,
      skipped_count: 0,
      error_count: 0,
      current_item_index: 0,
    };

    const { data: batchData, error: batchError } = await supabase
      .from('auto_dial_batches')
      .insert(batchInsert)
      .select()
      .single();

    if (batchError) throw batchError;
    if (!batchData) throw new Error('No batch data returned');

    const itemsInsert = params.items.map((item, index) => ({
      batch_id: batchData.id,
      case_id: item.caseId,
      customer_name: item.customerName,
      phone: item.phone,
      memo: item.memo,
      sort_order: index,
      status: 'pending',
      attempt_count: 0,
    }));

    if (itemsInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('auto_dial_items')
        .insert(itemsInsert);

      if (itemsError) {
        console.error('[AutoDial] Error inserting batch items:', itemsError);
        throw itemsError;
      }
    }

    return dbToBatch(batchData);
  } catch (error) {
    console.error('[AutoDial] createBatch error:', error);
    return null;
  }
};

export const updateBatchStatus = async (
  batchId: string,
  status: AutoDialBatch['status'],
  extraFields?: Record<string, any>
): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const updatePayload: Record<string, any> = { status, ...extraFields };
    if (status === 'running') {
      updatePayload.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'cancelled') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('auto_dial_batches')
      .update(updatePayload)
      .eq('id', batchId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[AutoDial] updateBatchStatus error:', error);
    return false;
  }
};

export const updateBatchCounts = async (
  batchId: string,
  counts: Partial<Pick<AutoDialBatch, 'completedCount' | 'connectedCount' | 'noAnswerCount' | 'busyCount' | 'skippedCount' | 'errorCount' | 'currentItemIndex'>>
): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const updatePayload: Record<string, any> = {};
    if (counts.completedCount !== undefined) updatePayload.completed_count = counts.completedCount;
    if (counts.connectedCount !== undefined) updatePayload.connected_count = counts.connectedCount;
    if (counts.noAnswerCount !== undefined) updatePayload.no_answer_count = counts.noAnswerCount;
    if (counts.busyCount !== undefined) updatePayload.busy_count = counts.busyCount;
    if (counts.skippedCount !== undefined) updatePayload.skipped_count = counts.skippedCount;
    if (counts.errorCount !== undefined) updatePayload.error_count = counts.errorCount;
    if (counts.currentItemIndex !== undefined) updatePayload.current_item_index = counts.currentItemIndex;

    const { error } = await supabase
      .from('auto_dial_batches')
      .update(updatePayload)
      .eq('id', batchId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[AutoDial] updateBatchCounts error:', error);
    return false;
  }
};

export const updateItemStatus = async (
  itemId: string,
  status: AutoDialItem['status'],
  result?: AutoDialItem['result'],
  extras?: { resultMemo?: string; ringDurationSeconds?: number; callDurationSeconds?: number }
): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const updatePayload: Record<string, any> = { status };
    if (result !== undefined) updatePayload.result = result;
    if (extras?.resultMemo !== undefined) updatePayload.result_memo = extras.resultMemo;
    if (extras?.ringDurationSeconds !== undefined) updatePayload.ring_duration_seconds = extras.ringDurationSeconds;
    if (extras?.callDurationSeconds !== undefined) updatePayload.call_duration_seconds = extras.callDurationSeconds;
    
    if (status === 'dialing' || status === 'ringing' || status === 'connected') {
       updatePayload.last_attempt_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('auto_dial_items')
      .update(updatePayload)
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[AutoDial] updateItemStatus error:', error);
    return false;
  }
};

export const skipItem = async (itemId: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('auto_dial_items')
      .update({ status: 'skipped' })
      .eq('id', itemId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[AutoDial] skipItem error:', error);
    return false;
  }
};

export const getNextPendingItem = async (batchId: string): Promise<AutoDialItem | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('auto_dial_items')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', 'pending')
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return dbToItem(data);
  } catch (error) {
    console.error('[AutoDial] getNextPendingItem error:', error);
    return null;
  }
};

export const enqueuePendingCall = async (
  phoneNumber: string, 
  customerName: string, 
  autoDialItemId: string
): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('pending_calls')
      .insert({
        phone: phoneNumber,
        customer_name: customerName,
        auto_dial_item_id: autoDialItemId
      });
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[AutoDial] enqueuePendingCall error:', error);
    return false;
  }
};

export const deleteBatch = async (batchId: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('auto_dial_batches')
      .delete()
      .eq('id', batchId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[AutoDial] deleteBatch error:', error);
    return false;
  }
};

export const subscribeToAutoDialBatch = (
  batchId: string, 
  onUpdate: (batch: AutoDialBatch) => void
): () => void => {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`auto_dial_batches_${batchId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'auto_dial_batches',
        filter: `id=eq.${batchId}`
      },
      (payload) => {
        onUpdate(dbToBatch(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};

export const subscribeToAutoDialItems = (
  batchId: string, 
  onInsert: (item: AutoDialItem) => void,
  onUpdate: (item: AutoDialItem) => void
): () => void => {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`auto_dial_items_${batchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'auto_dial_items',
        filter: `batch_id=eq.${batchId}`
      },
      (payload) => {
        onInsert(dbToItem(payload.new));
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'auto_dial_items',
        filter: `batch_id=eq.${batchId}`
      },
      (payload) => {
        onUpdate(dbToItem(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};
