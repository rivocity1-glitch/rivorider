import { supabase } from "@/lib/supabase";

// --- TypeScript Interfaces ---

export type RecipientType = 'customer' | 'vendor' | 'rider' | 'admin';

export interface SendNotificationParams {
  recipientId: string;
  recipientType: RecipientType;
  title: string;
  message: string;
  type: string;
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface NotificationRecord {
  id: string;
  recipient_id: string;
  recipient_type: RecipientType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string;
  reference_id: string | null;
  metadata: Record<string, any> | null;
}

/**
 * Send a notification.
 */
export async function sendNotification(params: SendNotificationParams): Promise<ServiceResponse<NotificationRecord>> {
  try {
    if (!params.recipientId || params.recipientId.trim() === '') {
      return { success: false, error: 'Validation Error: Recipient ID must be a valid, non-empty identifier.' };
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          recipient_id: params.recipientId,
          recipient_type: params.recipientType,
          title: params.title,
          message: params.message,
          type: params.type,
          reference_id: params.referenceId || null,
          metadata: params.metadata || null,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[NotificationService][sendNotification] Supabase insert failed:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as NotificationRecord };
  } catch (err: any) {
    console.error('[NotificationService][sendNotification] Unhandled runtime exception caught:', err?.message || err);
    return { success: false, error: err?.message || 'An unexpected internal fault occurred.' };
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(id: string): Promise<ServiceResponse<null>> {
  try {
    if (!id || id.trim() === '') {
      return { success: false, error: 'Validation Error: A valid target identification UUID parameter is required.' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error(`[NotificationService][markNotificationRead] Database failed to update id ${id}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[NotificationService][markNotificationRead] Runtime error for id ${id}:`, err?.message || err);
    return { success: false, error: err?.message || 'Failed to update notification state.' };
  }
}

/**
 * Mark all notifications for a recipient as read.
 */
export async function markAllNotificationsRead(
  recipientId: string,
  recipientType: RecipientType
): Promise<ServiceResponse<null>> {
  try {
    if (!recipientId || recipientId.trim() === '') {
      return { success: false, error: 'Validation Error: Target recipient identifier must be valid.' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      console.error(`[NotificationService][markAllNotificationsRead] Batch updates failed for ${recipientId}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[NotificationService][markAllNotificationsRead] Critical internal exception caught:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to execute global read modifications.' };
  }
}

/**
 * Get the total count of unread notifications for a recipient.
 */
export async function getUnreadNotificationCount(
  recipientId: string,
  recipientType: RecipientType
): Promise<ServiceResponse<number>> {
  try {
    if (!recipientId || recipientId.trim() === '') {
      return { success: false, error: 'Validation Error: Profile parameters must be valid.' };
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      console.error(`[NotificationService][getUnreadNotificationCount] Count mapping error for ${recipientId}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: count || 0 };
  } catch (err: any) {
    console.error('[NotificationService][getUnreadNotificationCount] Internal tally tracking exception:', err?.message || err);
    return { success: false, error: err?.message || 'Unable to accurately tally unread notifications.' };
  }
}

/**
 * Fetch notifications for a recipient sorted newest first.
 */
export async function fetchNotifications(
  recipientId: string,
  recipientType: RecipientType
): Promise<ServiceResponse<NotificationRecord[]>> {
  try {
    if (!recipientId || recipientId.trim() === '') {
      return { success: false, error: 'Validation Error: Target identification reference element must be valid.' };
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[NotificationService][fetchNotifications] Failed to retrieve items for ${recipientId}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as NotificationRecord[] };
  } catch (err: any) {
    console.error('[NotificationService][fetchNotifications] Unhandled payload pull exception:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to complete historical listings population.' };
  }
}

/**
 * Helper to dispatch order lifecycle state updates.
 */
export async function sendOrderNotification(params: {
  recipientId: string;
  recipientType: RecipientType;
  orderNumber: string;
  vendorName: string;
  type: 'new_order' | 'order_ready' | 'pickup_started' | 'out_for_delivery' | 'delivery_completed' | 'order_cancelled';
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<ServiceResponse<NotificationRecord>> {
  let title = '';
  let message = '';

  switch (params.type) {
    case 'new_order':
      title = '🆕 New Delivery';
      message = `${params.vendorName} assigned Order #${params.orderNumber}.`;
      break;
    case 'order_ready':
      title = '📦 Order Ready';
      message = `${params.vendorName} has packed Order #${params.orderNumber}. Proceed for pickup.`;
      break;
    case 'pickup_started':
      title = '🚚 Pickup Started';
      message = `Pickup sequence initialized for Order #${params.orderNumber} at ${params.vendorName}.`;
      break;
    case 'out_for_delivery':
      title = '🚛 Out for Delivery';
      message = `Order #${params.orderNumber} from ${params.vendorName} is now out for delivery.`;
      break;
    case 'delivery_completed':
      title = '✅ Delivery Completed';
      message = `Order #${params.orderNumber} completed successfully.`;
      break;
    case 'order_cancelled':
      title = '❌ Order Cancelled';
      message = `Order #${params.orderNumber} from ${params.vendorName} has been cancelled.`;
      break;
  }

  return sendNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    title,
    message,
    type: params.type,
    referenceId: params.referenceId,
    metadata: params.metadata,
  });
}

/**
 * Helper to dispatch wallet and financial settlement changes.
 */
export async function sendSettlementNotification(params: {
  recipientId: string;
  recipientType: RecipientType;
  amount: string;
  status: 'requested' | 'approved' | 'rejected';
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<ServiceResponse<NotificationRecord>> {
  let title = '';
  let message = '';
  let type = '';

  switch (params.status) {
    case 'requested':
      title = '💰 Settlement Requested';
      message = `Your request for a settlement payout of ${params.amount} has been received.`;
      type = 'settlement_requested';
      break;
    case 'approved':
      title = '💸 Settlement Approved';
      message = `Your settlement payout request of ${params.amount} was approved and processed.`;
      type = 'settlement_approved';
      break;
    case 'rejected':
      title = '⚠️ Settlement Rejected';
      message = `Your settlement payout request of ${params.amount} was not approved.`;
      type = 'settlement_rejected';
      break;
  }

  return sendNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    title,
    message,
    type,
    referenceId: params.referenceId,
    metadata: params.metadata,
  });
}

/**
 * Helper to trigger emergency SOS workflows and updates.
 */
export async function sendSOSNotification(params: {
  recipientId: string;
  recipientType: RecipientType;
  status: 'sent' | 'accepted' | 'closed';
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<ServiceResponse<NotificationRecord>> {
  let title = '';
  let message = '';
  let type = '';

  switch (params.status) {
    case 'sent':
      title = '🚨 SOS Alert Sent';
      message = 'Your emergency request has been sent to the Rivo team.';
      type = 'sos_sent';
      break;
    case 'accepted':
      title = '🚑 Help is on the way';
      message = 'Our support team has acknowledged your emergency request.';
      type = 'sos_accepted';
      break;
    case 'closed':
      title = '✅ Emergency Closed';
      message = 'Your SOS request has been marked as resolved.';
      type = 'sos_closed';
      break;
  }

  return sendNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    title,
    message,
    type,
    referenceId: params.referenceId,
    metadata: params.metadata,
  });
}

/**
 * Helper to dispatch verified user KYC credential profile updates.
 */
export async function sendKYCNotification(params: {
  recipientId: string;
  recipientType: RecipientType;
  status: 'under_review' | 'verified' | 'rejected';
  reason?: string;
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<ServiceResponse<NotificationRecord>> {
  let title = '';
  let message = '';
  let type = '';

  switch (params.status) {
    case 'under_review':
      title = '🛡️ KYC Under Review';
      message = 'Your identification verification credentials are undergoing active review.';
      type = 'kyc_under_review';
      break;
    case 'verified':
      title = '✅ KYC Approved';
      message = 'Congratulations, your Rivo identification status is fully verified.';
      type = 'kyc_verified';
      break;
    case 'rejected':
      title = '📄 KYC Rejected';
      message = params.reason 
        ? `Your verification application was rejected. Reason: ${params.reason}`
        : 'Your verification application was rejected.';
      type = 'kyc_rejected';
      break;
  }

  return sendNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    title,
    message,
    type,
    referenceId: params.referenceId,
    metadata: params.metadata,
  });
}

/**
 * Helper to dispatch structured global platform announcements.
 */
export async function sendAnnouncementNotification(params: {
  recipientId: string;
  recipientType: RecipientType;
  title: string;
  message: string;
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<ServiceResponse<NotificationRecord>> {
  return sendNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    title: params.title,
    message: params.message,
    type: 'announcement',
    referenceId: params.referenceId,
    metadata: params.metadata,
  });
}