import { supabase } from '../lib/supabase';

export interface RegisterRiderPayload {
  rider_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number?: string;
  is_specially_abled?: boolean;
  password?: string;
  gender?: string | null;
  blood_group?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  emergency_contact?: string | null;
  alternate_contact?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  account_holder_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  upi_id?: string | null;
  aadhaar_number?: string | null;
  pan_number?: string | null;
  driving_license_number?: string | null;
  aadhaar_front_uri?: string | null;
  aadhaar_back_uri?: string | null;
  pan_card_uri?: string | null;
  driving_license_uri?: string | null;
  vehicle_rc_uri?: string | null;
  selfie_uri?: string | null;
}

export async function signInRider(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error) throw error;
  return data;
}

export async function requestRiderPasswordReset(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email address is required.');

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: 'rivorider://reset-password',
  });

  if (error) throw error;
}

export async function updateRiderPassword(password: string) {
  if (!password) throw new Error('Password is required.');
  if (password.length !== 6) {
    throw new Error('Password must be exactly 6 characters.');
  }

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function getCurrentRider() {
  const { data: { user } } = await supabase.auth.getUser();
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

  if (payload.password.length !== 6) {
    throw new Error('Password must be exactly 6 characters.');
  }

  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanPhone = payload.phone.trim().replace(/[^0-9]/g, '');

  if (!cleanEmail) throw new Error('Email address is required.');
  if (!cleanPhone) throw new Error('Phone number is required.');
  if (!payload.rider_name?.trim()) throw new Error('Rider name is required.');

  const emergencyContact = payload.emergency_contact?.trim() || payload.emergency_contact_phone?.trim() || null;
  const alternateContact = payload.alternate_contact?.trim() || null;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password: payload.password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('User creation failed.');

  const authUserId = authData.user.id;

  const { data: rider, error: riderError } = await supabase
    .from('riders')
    .insert({
      auth_user_id: authUserId,
      rider_name: payload.rider_name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      vehicle_type: payload.vehicle_type?.trim() || null,
      vehicle_number: payload.vehicle_number?.trim() || 'N/A',
      is_specially_abled: payload.is_specially_abled ?? false,
      gender: payload.gender?.trim() || null,
      blood_group: payload.blood_group?.trim() || null,
      address: payload.address?.trim() || null,
      city: payload.city?.trim() || null,
      state: payload.state?.trim() || null,
      pin_code: payload.pin_code?.trim() || null,
      emergency_contact: emergencyContact,
      alternate_contact: alternateContact,
      account_holder_name: payload.account_holder_name?.trim() || null,
      bank_name: payload.bank_name?.trim() || null,
      account_number: payload.account_number?.trim() || null,
      ifsc_code: payload.ifsc_code?.trim().toUpperCase() || null,
      upi_id: payload.upi_id?.trim() || null,
      aadhaar_number: payload.aadhaar_number?.trim() || null,
      pan_number: payload.pan_number?.trim().toUpperCase() || null,
      driving_license_number: payload.driving_license_number?.trim() || null,
      kyc_status: 'pending',
      status: 'inactive',
      availability_status: 'offline',
      orders_completed: 0,
      rating: 5,
      earnings_today: 0,
      total_earnings: 0,
    })
    .select()
    .single();

  if (riderError) {
    console.error('Rider creation error:', riderError);
    await supabase.auth.signOut();
    throw riderError;
  }

  if (!rider) {
    await supabase.auth.signOut();
    throw new Error('Rider profile could not be created.');
  }

  const { data: riderProfile, error: profileError } = await supabase
    .from('rider_profiles')
    .insert({
      rider_id: rider.id,
      address: payload.address?.trim() || null,
      city: payload.city?.trim() || null,
      state: payload.state?.trim() || null,
      pin_code: payload.pin_code?.trim() || null,
      emergency_contact: emergencyContact,
      driving_license: payload.driving_license_number?.trim() || null,
      aadhaar_number: payload.aadhaar_number?.trim() || null,
      pan_number: payload.pan_number?.trim().toUpperCase() || null,
      account_holder_name: payload.account_holder_name?.trim() || null,
      bank_name: payload.bank_name?.trim() || null,
      account_number: payload.account_number?.trim() || null,
      ifsc_code: payload.ifsc_code?.trim().toUpperCase() || null,
      upi_id: payload.upi_id?.trim() || null,
      kyc_status: 'pending',
    })
    .select()
    .single();

  if (profileError) {
    console.error('Rider profile creation error:', profileError);
    const { error: rollbackError } = await supabase.from('riders').delete().eq('id', rider.id);
    if (rollbackError) console.error('Rider rollback error:', rollbackError);
    await supabase.auth.signOut();
    throw profileError;
  }

  if (!riderProfile) {
    const { error: rollbackError } = await supabase.from('riders').delete().eq('id', rider.id);
    if (rollbackError) console.error('Rider rollback error:', rollbackError);
    await supabase.auth.signOut();
    throw new Error('Rider KYC profile could not be created.');
  }

  return { ...rider, rider_profile: riderProfile };
}
