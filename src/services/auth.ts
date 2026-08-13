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
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;

  // Emergency contact
  emergency_contact?: string;
  alternate_contact?: string;

  // Bank details
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;

  // KYC numbers
  aadhaar_number?: string;
  pan_number?: string;
  driving_license_number?: string;

  // Optional document local URIs
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

/**
 * Upload a local React Native image URI to Supabase Storage.
 *
 * The rider-documents bucket is already public for reading and already
 * allows authenticated users to upload files.
 */
async function uploadRiderDocument(
  uri: string,
  riderId: string,
  documentType: string
): Promise<string> {
  if (!uri) {
    throw new Error(
      `Missing file for ${documentType}.`
    );
  }

  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      `Unable to read the selected ${documentType} file.`
    );
  }

  const blob = await response.blob();

  const extensionFromUri =
    uri
      .split('?')[0]
      .split('.')
      .pop()
      ?.toLowerCase() || 'jpg';

  const extension =
    extensionFromUri === 'jpeg' ||
    extensionFromUri === 'jpg' ||
    extensionFromUri === 'png' ||
    extensionFromUri === 'webp'
      ? extensionFromUri
      : 'jpg';

  const timestamp = Date.now();

  const filePath =
    `${riderId}/${documentType}-${timestamp}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('rider-documents')
    .upload(filePath, blob, {
      contentType:
        blob.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      upsert: false,
    });

  if (uploadError) {
    console.error(
      `Rider document upload failed (${documentType}):`,
      uploadError
    );

    throw new Error(
      `Unable to upload ${documentType}. ${uploadError.message}`
    );
  }

  const { data } = supabase.storage
    .from('rider-documents')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error(
      `Unable to generate the ${documentType} document URL.`
    );
  }

  return data.publicUrl;
}

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

  const { data: rider, error: riderError } =
    await supabase
      .from('riders')
      .insert([
        {
          auth_user_id: authUserId,
          rider_name: payload.rider_name.trim(),
          email: cleanEmail,
          phone: cleanPhone,

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
            payload.emergency_contact?.trim() || null,

          alternate_contact:
            payload.alternate_contact?.trim() || null,

          account_holder_name:
            payload.account_holder_name?.trim() || null,

          bank_name:
            payload.bank_name?.trim() || null,

          account_number:
            payload.account_number?.trim() || null,

          ifsc_code:
            payload.ifsc_code?.trim().toUpperCase() || null,

          upi_id:
            payload.upi_id?.trim() || null,

          aadhaar_number:
            payload.aadhaar_number?.trim() || null,

          pan_number:
            payload.pan_number?.trim().toUpperCase() || null,

          driving_license_number:
            payload.driving_license_number?.trim() || null,

          // Registration starts with KYC pending.
          // It is NOT mandatory to have documents yet.
          kyc_status: 'pending',

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

  if (riderError) {
    console.error(
      'Rider creation error:',
      riderError
    );

    throw riderError;
  }

  if (!rider) {
    throw new Error(
      'Rider profile could not be created.'
    );
  }

  // ---------------------------------------------------------
  // 3. ALWAYS CREATE rider_profiles
  // ---------------------------------------------------------
  //
  // This is important.
  //
  // The profile screen reads KYC documents from rider_profiles.
  // Previously this row was never created during registration.
  //
  // KYC is optional, therefore all document fields start as null.
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
        payload.emergency_contact?.trim() || null,

      driving_license:
        payload.driving_license_number?.trim() || null,

      aadhaar_number:
        payload.aadhaar_number?.trim() || null,

      pan_number:
        payload.pan_number?.trim().toUpperCase() || null,

      account_holder_name:
        payload.account_holder_name?.trim() || null,

      bank_name:
        payload.bank_name?.trim() || null,

      account_number:
        payload.account_number?.trim() || null,

      ifsc_code:
        payload.ifsc_code?.trim().toUpperCase() || null,

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

    throw profileError;
  }

  if (!riderProfile) {
    throw new Error(
      'Rider KYC profile could not be created.'
    );
  }

  // ---------------------------------------------------------
  // 4. OPTIONAL DOCUMENT UPLOADS
  // ---------------------------------------------------------
  //
  // None of these are mandatory.
  //
  // If the rider uploaded a document during registration,
  // upload it and save its URL.
  // If they skipped it, simply leave it null.
  // ---------------------------------------------------------

  const profileDocumentUpdates: Record<
    string,
    string
  > = {};

  const riderDocumentUpdates: Record<
    string,
    string
  > = {};

  if (payload.aadhaar_front_uri) {
    const url = await uploadRiderDocument(
      payload.aadhaar_front_uri,
      rider.id,
      'aadhaar-front'
    );

    profileDocumentUpdates.aadhaar_front_url = url;
  }

  if (payload.aadhaar_back_uri) {
    const url = await uploadRiderDocument(
      payload.aadhaar_back_uri,
      rider.id,
      'aadhaar-back'
    );

    profileDocumentUpdates.aadhaar_back_url = url;
  }

  if (payload.pan_card_uri) {
    const url = await uploadRiderDocument(
      payload.pan_card_uri,
      rider.id,
      'pan-card'
    );

    profileDocumentUpdates.pan_card_url = url;
  }

  if (payload.driving_license_uri) {
    const url = await uploadRiderDocument(
      payload.driving_license_uri,
      rider.id,
      'driving-license'
    );

    profileDocumentUpdates.driving_license_url = url;

    // Keep the riders table document URL synchronized too.
    riderDocumentUpdates.driving_license_document_url =
      url;
  }

  if (payload.vehicle_rc_uri) {
    const url = await uploadRiderDocument(
      payload.vehicle_rc_uri,
      rider.id,
      'vehicle-rc'
    );

    riderDocumentUpdates.vehicle_rc_document_url =
      url;
  }

  if (payload.selfie_uri) {
    const url = await uploadRiderDocument(
      payload.selfie_uri,
      rider.id,
      'selfie'
    );

    riderDocumentUpdates.selfie_photo_url = url;
    riderDocumentUpdates.profile_photo_url = url;

    profileDocumentUpdates.selfie_photo_url = url;
  }

  // ---------------------------------------------------------
  // 5. UPDATE rider_profiles WITH UPLOADED DOCUMENT URLs
  // ---------------------------------------------------------

  if (
    Object.keys(profileDocumentUpdates).length > 0
  ) {
    const {
      error: documentProfileError,
    } = await supabase
      .from('rider_profiles')
      .update({
        ...profileDocumentUpdates,
        documents_updated_at:
          new Date().toISOString(),
      })
      .eq('id', riderProfile.id);

    if (documentProfileError) {
      console.error(
        'Rider profile document URL update error:',
        documentProfileError
      );

      throw documentProfileError;
    }
  }

  // ---------------------------------------------------------
  // 6. UPDATE riders WITH RIDER-LEVEL DOCUMENT URLs
  // ---------------------------------------------------------

  if (
    Object.keys(riderDocumentUpdates).length > 0
  ) {
    const {
      error: riderDocumentError,
    } = await supabase
      .from('riders')
      .update({
        ...riderDocumentUpdates,
        documents_updated_at:
          new Date().toISOString(),
      })
      .eq('id', rider.id);

    if (riderDocumentError) {
      console.error(
        'Rider document URL update error:',
        riderDocumentError
      );

      throw riderDocumentError;
    }
  }

  // ---------------------------------------------------------
  // 7. RETURN COMPLETE RIDER RECORD
  // ---------------------------------------------------------

  return {
    ...rider,
    rider_profile: {
      ...riderProfile,
      ...profileDocumentUpdates,
    },
  };
}