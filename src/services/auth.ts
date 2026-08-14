import { supabase } from '../lib/supabase';

export interface RegisterRiderPayload {
  rider_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_number?: string;
  is_specially_abled?: boolean;
  password?: string;

  // Personal / registration information
  gender?: string | null;
  blood_group?: string | null;

  // Address
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;

  // Emergency contact
  emergency_contact?: string | null;
  alternate_contact?: string | null;

  // Registration screen compatibility
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;

  // Bank details
  account_holder_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  upi_id?: string | null;

  // KYC numbers
  aadhaar_number?: string | null;
  pan_number?: string | null;
  driving_license_number?: string | null;

  /*
   * KYC document URIs are accepted only for compatibility
   * with the registration screen.
   *
   * IMPORTANT:
   * These files are NOT uploaded during registration.
   *
   * KYC is optional and must be completed later from
   * the authenticated Complete KYC flow.
   */
  aadhaar_front_uri?: string | null;
  aadhaar_back_uri?: string | null;
  pan_card_uri?: string | null;
  driving_license_uri?: string | null;
  vehicle_rc_uri?: string | null;
  selfie_uri?: string | null;
}

export async function signInRider(
  email: string,
  password: string
) {
  const cleanEmail = email.trim().toLowerCase();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function getCurrentRider() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Register a rider.
 *
 * Registration creates:
 * 1. Supabase Auth user
 * 2. riders record
 * 3. rider_profiles record
 *
 * KYC documents are NOT uploaded during registration.
 *
 * KYC is optional and can be completed later from the
 * authenticated Complete KYC screen.
 */
export async function registerRider(
  payload: RegisterRiderPayload
) {
  if (!payload.password) {
    throw new Error(
      'Password is required for registration.'
    );
  }

  const cleanEmail = payload.email
    .trim()
    .toLowerCase();

  const cleanPhone = payload.phone
    .trim()
    .replace(/[^0-9]/g, '');

  if (!cleanEmail) {
    throw new Error(
      'Email address is required.'
    );
  }

  if (!cleanPhone) {
    throw new Error(
      'Phone number is required.'
    );
  }

  if (!payload.rider_name?.trim()) {
    throw new Error(
      'Rider name is required.'
    );
  }

  // ---------------------------------------------------------
  // EMERGENCY CONTACT NORMALIZATION
  // ---------------------------------------------------------

  const emergencyContact =
    payload.emergency_contact?.trim() ||
    payload.emergency_contact_phone?.trim() ||
    null;

  const alternateContact =
    payload.alternate_contact?.trim() ||
    null;

  // ---------------------------------------------------------
  // 1. CREATE SUPABASE AUTH USER
  // ---------------------------------------------------------

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.signUp({
    email: cleanEmail,
    password: payload.password,
  });

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    throw new Error(
      'User creation failed.'
    );
  }

  const authUserId = authData.user.id;

  // ---------------------------------------------------------
  // 2. CREATE RIDER RECORD
  // ---------------------------------------------------------

  const {
    data: rider,
    error: riderError,
  } = await supabase
    .from('riders')
    .insert({
      auth_user_id: authUserId,

      rider_name:
        payload.rider_name.trim(),

      email:
        cleanEmail,

      phone:
        cleanPhone,

      vehicle_type:
        payload.vehicle_type?.trim() || null,

      vehicle_number:
        payload.vehicle_number?.trim() || 'N/A',

      is_specially_abled:
        payload.is_specially_abled ?? false,

      gender:
        payload.gender?.trim() || null,

      blood_group:
        payload.blood_group?.trim() || null,

      address:
        payload.address?.trim() || null,

      city:
        payload.city?.trim() || null,

      state:
        payload.state?.trim() || null,

      pin_code:
        payload.pin_code?.trim() || null,

      emergency_contact:
        emergencyContact,

      alternate_contact:
        alternateContact,

      account_holder_name:
        payload.account_holder_name?.trim() || null,

      bank_name:
        payload.bank_name?.trim() || null,

      account_number:
        payload.account_number?.trim() || null,

      ifsc_code:
        payload.ifsc_code
          ?.trim()
          .toUpperCase() || null,

      upi_id:
        payload.upi_id?.trim() || null,

      /*
       * KYC numbers are optional.
       * Save them only if the rider actually provided them.
       */
      aadhaar_number:
        payload.aadhaar_number?.trim() || null,

      pan_number:
        payload.pan_number
          ?.trim()
          .toUpperCase() || null,

      driving_license_number:
        payload.driving_license_number?.trim() || null,

      /*
       * KYC is optional at registration.
       */
      kyc_status: 'pending',

      /*
       * Existing rider registration behavior.
       */
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
    console.error(
      'Rider creation error:',
      riderError
    );

    /*
     * The database rider row was not created.
     * Sign out so the failed registration does not
     * leave the application in an authenticated state.
     *
     * Supabase Auth users cannot safely be deleted from
     * the client with the normal client SDK, so we do not
     * attempt a privileged Auth deletion here.
     */
    await supabase.auth.signOut();

    throw riderError;
  }

  if (!rider) {
    await supabase.auth.signOut();

    throw new Error(
      'Rider profile could not be created.'
    );
  }

  // ---------------------------------------------------------
  // 3. CREATE RIDER PROFILE
  // ---------------------------------------------------------
  //
  // This row MUST exist even when the rider skips KYC.
  //
  // All document URL fields remain NULL.
  // ---------------------------------------------------------

  const {
    data: riderProfile,
    error: profileError,
  } = await supabase
    .from('rider_profiles')
    .insert({
      rider_id: rider.id,

      address:
        payload.address?.trim() || null,

      city:
        payload.city?.trim() || null,

      state:
        payload.state?.trim() || null,

      pin_code:
        payload.pin_code?.trim() || null,

      emergency_contact:
        emergencyContact,

      /*
       * Existing rider_profiles schema uses
       * driving_license for the license value.
       */
      driving_license:
        payload.driving_license_number?.trim() || null,

      aadhaar_number:
        payload.aadhaar_number?.trim() || null,

      pan_number:
        payload.pan_number
          ?.trim()
          .toUpperCase() || null,

      account_holder_name:
        payload.account_holder_name?.trim() || null,

      bank_name:
        payload.bank_name?.trim() || null,

      account_number:
        payload.account_number?.trim() || null,

      ifsc_code:
        payload.ifsc_code
          ?.trim()
          .toUpperCase() || null,

      upi_id:
        payload.upi_id?.trim() || null,

      kyc_status: 'pending',
    })
    .select()
    .single();

  if (profileError) {
    console.error(
      'Rider profile creation error:',
      profileError
    );

    /*
     * Remove the rider row created in this registration
     * attempt so we do not leave an incomplete rider record.
     */
    const {
      error: rollbackError,
    } = await supabase
      .from('riders')
      .delete()
      .eq('id', rider.id);

    if (rollbackError) {
      console.error(
        'Rider rollback error:',
        rollbackError
      );
    }

    await supabase.auth.signOut();

    throw profileError;
  }

  if (!riderProfile) {
    const {
      error: rollbackError,
    } = await supabase
      .from('riders')
      .delete()
      .eq('id', rider.id);

    if (rollbackError) {
      console.error(
        'Rider rollback error:',
        rollbackError
      );
    }

    await supabase.auth.signOut();

    throw new Error(
      'Rider KYC profile could not be created.'
    );
  }

  // ---------------------------------------------------------
  // 4. NO STORAGE / KYC DOCUMENT UPLOAD
  // ---------------------------------------------------------
  //
  // The following are intentionally NOT uploaded:
  //
  // - Aadhaar front
  // - Aadhaar back
  // - PAN
  // - Driving licence
  // - Vehicle RC
  // - Selfie
  //
  // The URI fields remain compatibility fields only.
  //
  // This means registration cannot fail because of:
  //
  // - Storage RLS
  // - rider-documents bucket permissions
  // - document upload failure
  // - invalid local file URI
  //
  // KYC is completed later while the rider is authenticated.
  // ---------------------------------------------------------

  return {
    ...rider,
    rider_profile: riderProfile,
  };
}