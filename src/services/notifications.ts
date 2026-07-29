import { supabase } from "../lib/supabase";

export interface RiderNotification {
  id: string;
  recipient_id: string;
  recipient_type: string | null;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean;
  created_at: string;
  reference_id: string | null;
  metadata: Record<string, any> | null;
  deleted_at: string | null;
  action_url: string | null;
  priority: string | null;
}

export async function getNotifications(riderId: string): Promise<RiderNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", riderId)
      .eq("recipient_type", "rider")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rider notifications:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Exception fetching rider notifications:", err);
    return [];
  }
}

export async function getUnreadNotificationCount(riderId: string, p0?: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", riderId)
      .eq("recipient_type", "rider")
      .eq("is_read", false)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching rider unread count:", error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error("Exception fetching rider unread count:", err);
    return 0;
  }
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("recipient_type", "rider");

    if (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Exception marking notification as read:", err);
    return false;
  }
}

export async function markAllNotificationsAsRead(riderId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", riderId)
      .eq("recipient_type", "rider")
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Exception marking all notifications as read:", err);
    return false;
  }
}

export async function softDeleteNotification(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_type", "rider");

    if (error) {
      console.error("Error deleting notification:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Exception deleting notification:", err);
    return false;
  }
}

export function subscribeToNotifications(
  riderId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`rider-notifications-${riderId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${riderId}`,
      },
      (payload) => {
        if (!payload.new || (payload.new as any).recipient_type === "rider") {
          callback(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}