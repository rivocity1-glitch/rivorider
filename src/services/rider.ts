import { supabase } from '../lib/supabase';

export async function getCurrentRiderProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle(); // Returns null safely instead of throwing an error if no row exists[cite: 3]

  if (error) throw error;

  return data;
}

export async function getAssignedVendors() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: rider, error: riderError } = await supabase
    .from('riders')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle(); // Returns null safely instead of throwing an error if no row exists[cite: 3]

  if (riderError || !rider) return [];

  const { data, error } = await supabase
    .from('rider_vendor_assignments')
    .select(`
      vendors (
        id,
        shop_name
      )
    `)
    .eq('rider_id', rider.id);

  if (error) throw error;

  return (data?.map((assignment: any) => assignment.vendors).filter(Boolean) || []) as {
    id: string;
    shop_name: string;
  }[];
}

export async function updateAvailabilityStatus(status: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('riders')
    .update({ availability_status: status })
    .eq('auth_user_id', user.id)
    .select()
    .maybeSingle(); // Swapped for consistency and runtime safety[cite: 3]

  if (error) throw error;

  return data;
}

/**
 * Calculates live daily & total metrics directly from orders
 */
export async function getRiderOrderStats(riderId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 1. Fetch completed orders today
  const { data: todayOrders, error: todayErr } = await supabase
    .from('orders')
    .select('rider_earning')
    .eq('rider_id', riderId)
    .ilike('order_status', 'delivered')
    .gte('delivered_at', startOfDay.toISOString());

  if (todayErr) console.error('Error fetching today stats:', todayErr);

  const earningsToday = (todayOrders || []).reduce(
    (sum, order) => sum + (Number(order.rider_earning) || 0),
    0
  );
  const ordersCompletedToday = todayOrders?.length || 0;

  // 2. Fetch total lifetime delivered earnings
  const { data: totalOrders, error: totalErr } = await supabase
    .from('orders')
    .select('rider_earning')
    .eq('rider_id', riderId)
    .ilike('order_status', 'delivered');

  if (totalErr) console.error('Error fetching lifetime stats:', totalErr);

  const totalEarnings = (totalOrders || []).reduce(
    (sum, order) => sum + (Number(order.rider_earning) || 0),
    0
  );

  return {
    earningsToday,
    ordersCompletedToday,
    totalEarnings,
  };
}