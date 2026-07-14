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
    .maybeSingle(); // Fixes PGRST116: Returns null safely instead of throwing an error if no row exists

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
    .maybeSingle(); // Fixes PGRST116: Returns null safely instead of throwing an error if no row exists

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
    .maybeSingle(); // Swapped for consistency and runtime safety

  if (error) throw error;

  return data;
}