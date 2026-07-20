import { supabase } from '../lib/supabase';

export interface RegisterRiderPayload {
  rider_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number?: string;
  is_specially_abled?: boolean;
  password?: string;
}

export async function signInRider(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) throw error;

  return data;
}

export async function getCurrentRider() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error) throw error;

  return data;
}

export async function registerRider(payload: RegisterRiderPayload) {
  if (!payload.password) {
    throw new Error('Password is required for registration.');
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('User creation failed.');

  const { data, error } = await supabase
    .from('riders')
    .insert([
      {
        auth_user_id: authData.user.id,
        rider_name: payload.rider_name,
        email: payload.email,
        phone: payload.phone,
        vehicle_type: payload.vehicle_type,
        vehicle_number: payload.vehicle_number || 'N/A',
        is_specially_abled: payload.is_specially_abled ?? false,
        status: 'inactive',
        availability_status: 'offline',
        orders_completed: 0,
        rating: 5,
        earnings_today: 0,
        total_earnings: 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}