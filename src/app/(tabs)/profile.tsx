import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

interface Rider {
  id: string;
  auth_user_id: string;
  rider_code?: string;
  rider_name: string;
  email: string;
  phone: string;
  rating: number;
  kyc_status:
    | 'not_submitted'
    | 'pending'
    | 'verified'
    | 'rejected'
    | null;
  status?: 'active' | 'inactive';
  selfie_photo_url?: string;
  vehicle_type?: string;

  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  qr_code_url?: string;

  gender?: string;
  blood_group?: string;

  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  registration_latitude?: number | null;
  registration_longitude?: number | null;
}

interface RiderProfile {
  id: string;
  rider_id: string;

  aadhaar_number?: string;
  aadhaar_front_url?: string;
  aadhaar_back_url?: string;

  pan_number?: string;
  pan_card_url?: string;

  driving_license_number?: string;
  driving_license_url?: string;

  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;

  selfie_photo_url?: string;
  kyc_status?: string;
  rejection_reason?: string;
}

type KycDocType =
  | 'aadhaar_front'
  | 'aadhaar_back'
  | 'pan'
  | 'driving_license'
  | 'qr_code';

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rider, setRider] = useState<Rider | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);

  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const themeToggleAnim = useRef(
    new Animated.Value(isDarkMode ? 1 : 0)
  ).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(20)).current;

  // ------------------------------------------------------------
  // KYC / DOCUMENT STATE
  // ------------------------------------------------------------

  const [selfieUri, setSelfieUri] = useState('');

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFrontUri, setAadhaarFrontUri] = useState('');
  const [aadhaarBackUri, setAadhaarBackUri] = useState('');

  const [panNumber, setPanNumber] = useState('');
  const [panUri, setPanUri] = useState('');

  const [drivingLicenseNumber, setDrivingLicenseNumber] =
    useState('');
  const [drivingLicenseUri, setDrivingLicenseUri] = useState('');

  // ------------------------------------------------------------
  // BANK / PAYMENT
  // ------------------------------------------------------------

  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');
  const [qrCodeUri, setQrCodeUri] = useState('');

  // ------------------------------------------------------------
  // RESIDENCE LOCATION
  // ------------------------------------------------------------

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');

  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    Animated.timing(themeToggleAnim, {
      toValue: isDarkMode ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isDarkMode, themeToggleAnim]);

  const translateX = themeToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 26],
  });

  const isEvOrNonMotorized = [
    'ev',
    'electric',
    'bicycle',
    'cycle',
    'ev gearbike',
  ].some((type) =>
    (rider?.vehicle_type || '').toLowerCase().includes(type)
  );

  const startAnimations = () => {
    fadeAnim.setValue(0);
    slideUpAnim.setValue(20);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ------------------------------------------------------------
  // POPULATE
  // ------------------------------------------------------------

  const populateFields = (
    riderData: Rider,
    profileData: RiderProfile | null
  ) => {
    setSelfieUri(
      riderData.selfie_photo_url ||
        profileData?.selfie_photo_url ||
        ''
    );

    setQrCodeUri(riderData.qr_code_url || '');

    setAddress(riderData.address || '');
    setCity(riderData.city || '');
    setState(riderData.state || '');
    setPinCode(riderData.pin_code || '');

    setLatitude(
      riderData.registration_latitude != null
        ? String(riderData.registration_latitude)
        : ''
    );

    setLongitude(
      riderData.registration_longitude != null
        ? String(riderData.registration_longitude)
        : ''
    );

    if (!profileData) {
      setAccountHolder(riderData.account_holder_name || '');
      setBankName(riderData.bank_name || '');
      setAccountNumber(riderData.account_number || '');
      setIfsc(riderData.ifsc_code || '');
      setUpi(riderData.upi_id || '');
      return;
    }

    setAadhaarNumber(profileData.aadhaar_number || '');
    setAadhaarFrontUri(profileData.aadhaar_front_url || '');
    setAadhaarBackUri(profileData.aadhaar_back_url || '');

    setPanNumber(profileData.pan_number || '');
    setPanUri(profileData.pan_card_url || '');

    setDrivingLicenseNumber(
      profileData.driving_license_number || ''
    );
    setDrivingLicenseUri(
      profileData.driving_license_url || ''
    );

    setAccountHolder(
      profileData.account_holder_name ||
        riderData.account_holder_name ||
        ''
    );

    setBankName(
      profileData.bank_name ||
        riderData.bank_name ||
        ''
    );

    setAccountNumber(
      profileData.account_number ||
        riderData.account_number ||
        ''
    );

    setIfsc(
      profileData.ifsc_code ||
        riderData.ifsc_code ||
        ''
    );

    setUpi(
      profileData.upi_id ||
        riderData.upi_id ||
        ''
    );
  };

  // ------------------------------------------------------------
  // FETCH PROFILE
  // ------------------------------------------------------------

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('User not logged in');
      }

      const { data: riderData, error: riderError } =
        await supabase
          .from('riders')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

      if (riderError) {
        throw riderError;
      }

      setRider(riderData);

      const { data: profileData, error: profileError } =
        await supabase
          .from('rider_profiles')
          .select('*')
          .eq('rider_id', riderData.id)
          .single();

      if (
        profileError &&
        profileError.code !== 'PGRST116'
      ) {
        throw profileError;
      }

      setProfile(profileData || null);

      populateFields(
        riderData,
        profileData || null
      );

      startAnimations();
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to load profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SELFIE
  // ------------------------------------------------------------

  const handleTakeSelfie = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Denied',
          'Camera access is required to take your selfie.'
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          cameraType:
            ImagePicker.CameraType.front,
          allowsEditing: true,
          quality: 0.7,
        });

      if (
        result.canceled ||
        !result.assets?.[0]?.uri
      ) {
        return;
      }

      setSelfieUri(
        result.assets[0].uri
      );

      Alert.alert(
        'Selfie Selected',
        'Your selfie is ready. Save your KYC details when you are ready.'
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message ||
          'Failed to capture selfie.'
      );
    }
  };

  // ------------------------------------------------------------
  // DOCUMENT PICKER
  // ------------------------------------------------------------

  const handlePickDocument = async (
    type: KycDocType
  ) => {
    Alert.alert(
      'Select Document',
      'Choose source',
      [
        {
          text: 'Camera',
          onPress: () =>
            selectImage(type, 'camera'),
        },
        {
          text: 'Gallery',
          onPress: () =>
            selectImage(type, 'gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const selectImage = async (
    type: KycDocType,
    source: 'camera' | 'gallery'
  ) => {
    try {
      if (source === 'camera') {
        const { granted } =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!granted) {
          Alert.alert(
            'Permission Denied',
            'Camera permission is required.'
          );
          return;
        }
      } else {
        const { granted } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!granted) {
          Alert.alert(
            'Permission Denied',
            'Gallery permission is required.'
          );
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              quality: 0.7,
              allowsEditing: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              allowsEditing: true,
            });

      if (
        result.canceled ||
        !result.assets?.[0]?.uri
      ) {
        return;
      }

      const uri =
        result.assets[0].uri;

      switch (type) {
        case 'aadhaar_front':
          setAadhaarFrontUri(uri);
          break;

        case 'aadhaar_back':
          setAadhaarBackUri(uri);
          break;

        case 'pan':
          setPanUri(uri);
          break;

        case 'driving_license':
          setDrivingLicenseUri(uri);
          break;

        case 'qr_code':
          setQrCodeUri(uri);
          break;
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message ||
          'Unable to select document image.'
      );
    }
  };

  // ------------------------------------------------------------
  // STORAGE
  // ------------------------------------------------------------

  const uploadToStorage = async (
    fileName: string,
    uri: string
  ): Promise<string> => {
    const blob: Blob =
      await new Promise(
        (resolve, reject) => {
          const xhr =
            new XMLHttpRequest();

          xhr.onload = () =>
            resolve(xhr.response);

          xhr.onerror = () =>
            reject(
              new TypeError(
                'Network request failed'
              )
            );

          xhr.responseType = 'blob';
          xhr.open(
            'GET',
            uri,
            true
          );
          xhr.send();
        }
      );

    const {
      error: uploadError,
    } = await supabase.storage
      .from('rider-documents')
      .upload(
        fileName,
        blob,
        {
          contentType:
            'image/jpeg',
          upsert: true,
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    const { data } =
      supabase.storage
        .from('rider-documents')
        .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const uploadIfNeeded = async (
    uri: string,
    prefix: string
  ) => {
    if (!uri) {
      return null;
    }

    if (uri.startsWith('http')) {
      return uri;
    }

    if (!rider) {
      throw new Error(
        'Rider profile is not available.'
      );
    }

    return uploadToStorage(
      `${prefix}-${rider.id}-${Date.now()}.jpg`,
      uri
    );
  };

  // ------------------------------------------------------------
  // BANK VALIDATION
  // ------------------------------------------------------------

  const validateBankDetails = () => {
    if (!accountHolder.trim()) {
      Alert.alert(
        'Bank Details Required',
        'Please enter the account holder name.'
      );
      return false;
    }

    if (!bankName.trim()) {
      Alert.alert(
        'Bank Details Required',
        'Please enter the bank name.'
      );
      return false;
    }

    if (!accountNumber.trim()) {
      Alert.alert(
        'Bank Details Required',
        'Please enter your bank account number.'
      );
      return false;
    }

    if (ifsc.trim().length !== 11) {
      Alert.alert(
        'Invalid IFSC',
        'Please enter a valid 11-character IFSC code.'
      );
      return false;
    }

    return true;
  };

  // ------------------------------------------------------------
  // PARTIAL KYC SAVE
  // ------------------------------------------------------------

  const handleSubmitKYC = async () => {
    if (!rider) {
      return;
    }

    // BANK DETAILS ARE ALWAYS REQUIRED.
    if (!validateBankDetails()) {
      return;
    }

    const hasAadhaar =
      !!aadhaarNumber.trim() ||
      !!aadhaarFrontUri ||
      !!aadhaarBackUri;

    const hasPan =
      !!panNumber.trim() ||
      !!panUri;

    const hasDrivingLicense =
      !!drivingLicenseNumber.trim() ||
      !!drivingLicenseUri;

    const hasAnyDocument =
      !!selfieUri ||
      hasAadhaar ||
      hasPan ||
      hasDrivingLicense ||
      !!qrCodeUri;

    // Validate only documents the rider has started entering.
    // Nothing is required as a complete bundle.
    if (
      aadhaarNumber.trim() &&
      aadhaarNumber.trim().length !== 12
    ) {
      Alert.alert(
        'Invalid Aadhaar',
        'Aadhaar number must contain exactly 12 digits.'
      );
      return;
    }

    if (
      panNumber.trim() &&
      panNumber.trim().length !== 10
    ) {
      Alert.alert(
        'Invalid PAN',
        'PAN must contain exactly 10 characters.'
      );
      return;
    }

    if (
      !isEvOrNonMotorized &&
      drivingLicenseNumber.trim() &&
      !drivingLicenseUri
    ) {
      Alert.alert(
        'Driving Licence',
        'You entered a driving licence number. Please upload the licence document now or clear the number.'
      );
      return;
    }

    try {
      setSubmittingKyc(true);

      const finalSelfie =
        await uploadIfNeeded(
          selfieUri,
          'selfie'
        );

      const finalAadhaarFront =
        await uploadIfNeeded(
          aadhaarFrontUri,
          'aadhaar_front'
        );

      const finalAadhaarBack =
        await uploadIfNeeded(
          aadhaarBackUri,
          'aadhaar_back'
        );

      const finalPan =
        await uploadIfNeeded(
          panUri,
          'pan_card'
        );

      const finalDrivingLicense =
        await uploadIfNeeded(
          drivingLicenseUri,
          'driving_license'
        );

      const finalQrCode =
        await uploadIfNeeded(
          qrCodeUri,
          'qr_code'
        );

      const now =
        new Date().toISOString();

      const riderUpdate: Record<
        string,
        any
      > = {
        account_holder_name:
          accountHolder.trim(),

        bank_name:
          bankName.trim(),

        account_number:
          accountNumber.trim(),

        ifsc_code:
          ifsc.trim().toUpperCase(),

        upi_id:
          upi.trim() || null,

        qr_code_url:
          finalQrCode ||
          rider.qr_code_url ||
          null,

        documents_updated_at:
          now,
      };

      // Only overwrite selfie when a new one was selected.
      if (finalSelfie) {
        riderUpdate.selfie_photo_url =
          finalSelfie;

        riderUpdate.selfie_uploaded_at =
          now;
      }

      // Set KYC pending only when the rider
      // actually has document/KYC information.
      if (hasAnyDocument) {
        riderUpdate.kyc_status =
          'pending';
      }

      const {
        error: riderError,
      } = await supabase
        .from('riders')
        .update(riderUpdate)
        .eq('id', rider.id);

      if (riderError) {
        throw riderError;
      }

      const profilePayload: Record<
        string,
        any
      > = {
        rider_id: rider.id,

        account_holder_name:
          accountHolder.trim(),

        bank_name:
          bankName.trim(),

        account_number:
          accountNumber.trim(),

        ifsc_code:
          ifsc.trim().toUpperCase(),

        upi_id:
          upi.trim() || null,
      };

      // --------------------------------------------------------
      // IMPORTANT:
      // Only update document fields when the rider has supplied
      // that document. Existing documents are preserved.
      // --------------------------------------------------------

      if (aadhaarNumber.trim()) {
        profilePayload.aadhaar_number =
          aadhaarNumber.trim();
      }

      if (finalAadhaarFront) {
        profilePayload.aadhaar_front_url =
          finalAadhaarFront;
      }

      if (finalAadhaarBack) {
        profilePayload.aadhaar_back_url =
          finalAadhaarBack;
      }

      if (panNumber.trim()) {
        profilePayload.pan_number =
          panNumber
            .trim()
            .toUpperCase();
      }

      if (finalPan) {
        profilePayload.pan_card_url =
          finalPan;
      }

      if (drivingLicenseNumber.trim()) {
        profilePayload.driving_license_number =
          drivingLicenseNumber
            .trim()
            .toUpperCase();
      }

      if (finalDrivingLicense) {
        profilePayload.driving_license_url =
          finalDrivingLicense;
      }

      if (finalSelfie) {
        profilePayload.selfie_photo_url =
          finalSelfie;
      }

      if (hasAnyDocument) {
        profilePayload.kyc_status =
          'pending';
      }

      profilePayload.documents_updated_at =
        now;

      const {
        error: profileError,
      } = await supabase
        .from('rider_profiles')
        .upsert(
          profilePayload,
          {
            onConflict:
              'rider_id',
          }
        );

      if (profileError) {
        throw profileError;
      }

      setIsKycModalOpen(false);

      await fetchProfileData();

      Alert.alert(
        'Saved Successfully',
        hasAnyDocument
          ? 'Your available documents and bank details have been saved. You can upload the remaining documents later.'
          : 'Your bank details have been saved. You can upload your KYC documents later.'
      );
    } catch (err: any) {
      Alert.alert(
        'Save Failed',
        err?.message ||
          'Could not save your details.'
      );
    } finally {
      setSubmittingKyc(false);
    }
  };

  // ------------------------------------------------------------
  // LOCATION
  // ------------------------------------------------------------

  const handleUseCurrentLocation =
    async () => {
      try {
        setSavingLocation(true);

        const {
          status,
        } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Location Permission',
            'Please allow location access to automatically detect where you live.'
          );
          return;
        }

        const location =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.High,
            }
          );

        const lat =
          location.coords.latitude;

        const lng =
          location.coords.longitude;

        setLatitude(
          lat.toFixed(7)
        );

        setLongitude(
          lng.toFixed(7)
        );

        try {
          const addresses =
            await Location.reverseGeocodeAsync(
              {
                latitude: lat,
                longitude: lng,
              }
            );

          const place =
            addresses?.[0];

          if (place) {
            const generatedAddress =
              [
                place.name,
                place.street,
                place.district,
              ]
                .filter(Boolean)
                .join(', ');

            if (
              generatedAddress &&
              !address.trim()
            ) {
              setAddress(
                generatedAddress
              );
            }

            if (
              place.city ||
              place.subregion
            ) {
              setCity(
                place.city ||
                  place.subregion ||
                  ''
              );
            }

            if (place.region) {
              setState(
                place.region
              );
            }

            if (place.postalCode) {
              setPinCode(
                place.postalCode
              );
            }
          }
        } catch {
          // GPS coordinates were successfully captured.
          // Reverse geocoding is optional.
        }

        Alert.alert(
          'Location Captured',
          'Your current location has been selected. Review the address and save it.'
        );
      } catch (err: any) {
        Alert.alert(
          'Location Error',
          err?.message ||
            'Unable to get your current location.'
        );
      } finally {
        setSavingLocation(false);
      }
    };

  const handleSaveLocation =
    async () => {
      if (!rider) {
        return;
      }

      if (
        !address.trim() &&
        !city.trim() &&
        !state.trim() &&
        !pinCode.trim() &&
        !latitude &&
        !longitude
      ) {
        Alert.alert(
          'Location Required',
          'Please enter your address or select your current location.'
        );
        return;
      }

      if (
        pinCode.trim() &&
        !/^\d{6}$/.test(
          pinCode.trim()
        )
      ) {
        Alert.alert(
          'Invalid PIN Code',
          'Please enter a valid 6-digit PIN code.'
        );
        return;
      }

      try {
        setSavingLocation(true);

        const payload: Record<
          string,
          any
        > = {
          address:
            address.trim() ||
            null,

          city:
            city.trim() ||
            null,

          state:
            state.trim() ||
            null,

          pin_code:
            pinCode.trim() ||
            null,
        };

        if (latitude) {
          const parsedLat =
            Number(latitude);

          if (
            Number.isFinite(
              parsedLat
            )
          ) {
            payload.registration_latitude =
              parsedLat;
          }
        }

        if (longitude) {
          const parsedLng =
            Number(longitude);

          if (
            Number.isFinite(
              parsedLng
            )
          ) {
            payload.registration_longitude =
              parsedLng;
          }
        }

        const {
          error: updateError,
        } = await supabase
          .from('riders')
          .update(payload)
          .eq(
            'id',
            rider.id
          );

        if (updateError) {
          throw updateError;
        }

        setRider(
          (current) =>
            current
              ? {
                  ...current,
                  ...payload,
                }
              : current
        );

        Alert.alert(
          'Location Saved',
          'Your residence location has been updated successfully.'
        );
      } catch (err: any) {
        Alert.alert(
          'Save Failed',
          err?.message ||
            'Could not save your location.'
        );
      } finally {
        setSavingLocation(false);
      }
    };

  // ------------------------------------------------------------
  // LOGOUT
  // ------------------------------------------------------------

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () =>
            supabase.auth.signOut(),
        },
      ]
    );
  };

  // ------------------------------------------------------------
  // DOCUMENT BUTTON
  // ------------------------------------------------------------

  const renderDocPickerButton = (
    title: string,
    uri: string,
    type: KycDocType,
    optional = true
  ) => (
    <View
      style={{
        marginBottom: 14,
      }}
    >
      <Text
        style={[
          styles.inputGroupLabel,
          {
            color:
              theme.textMuted,
          },
        ]}
      >
        {title}{' '}
        {optional
          ? '(Optional)'
          : '*'}
      </Text>

      <TouchableOpacity
        style={[
          styles.docUploadBtn,
          {
            backgroundColor:
              theme.bg,
            borderColor:
              theme.border,
          },
        ]}
        onPress={() =>
          handlePickDocument(
            type
          )
        }
      >
        <Ionicons
          name={
            uri
              ? 'checkmark-circle'
              : 'document-attach-outline'
          }
          size={18}
          color={
            uri
              ? COLORS.emeraldGreen
              : theme.textMuted
          }
          style={{
            marginRight: 6,
          }}
        />

        <Text
          style={[
            styles.docUploadBtnText,
            {
              color: uri
                ? COLORS.emeraldGreen
                : theme.text,
            },
          ]}
        >
          {uri
            ? 'Change Document'
            : `Upload ${title}`}
        </Text>
      </TouchableOpacity>

      {uri ? (
        <Image
          source={{
            uri,
          }}
          style={
            styles.docPreviewImage
          }
        />
      ) : null}
    </View>
  );

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------

  if (loading) {
    return (
      <View
        style={[
          styles.centeredContainer,
          {
            backgroundColor:
              theme.bg,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={
            COLORS.emeraldGreen
          }
        />
      </View>
    );
  }

  // ------------------------------------------------------------
  // ERROR
  // ------------------------------------------------------------

  if (error || !rider) {
    return (
      <View
        style={[
          styles.centeredContainer,
          {
            backgroundColor:
              theme.bg,
          },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={60}
          color={COLORS.danger}
        />

        <Text
          style={[
            styles.errorTitle,
            {
              color:
                theme.text,
            },
          ]}
        >
          Failed to load profile
        </Text>

        <TouchableOpacity
          style={
            styles.retryButton
          }
          onPress={
            fetchProfileData
          }
        >
          <Text
            style={
              styles.retryText
            }
          >
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kycStatus =
    rider.kyc_status ||
    'not_submitted';

  const hasResidenceLocation =
    !!(
      address ||
      city ||
      state ||
      pinCode ||
      latitude ||
      longitude
    );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          theme.bg,
      }}
    >
      <StatusBar
        barStyle={
          isDarkMode
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          theme.headerBg
        }
      />

      {/* HEADER */}

      <View
        style={[
          styles.header,
          {
            backgroundColor:
              theme.headerBg,
            borderColor:
              theme.border,
          },
        ]}
      >
        <View
          style={
            styles.headerTopRow
          }
        >
          <Text
            style={[
              styles.headerTitle,
              {
                color:
                  theme.text,
              },
            ]}
          >
            Profile
          </Text>

          <TouchableOpacity
            onPress={
              toggleTheme
            }
            style={[
              styles.switchTrack,
              {
                backgroundColor:
                  isDarkMode
                    ? '#333'
                    : '#E0E0E0',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.switchThumb,
                {
                  transform: [
                    {
                      translateX,
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={
                  isDarkMode
                    ? 'moon-outline'
                    : 'sunny-outline'
                }
                size={12}
                color={
                  COLORS.jetBlack
                }
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.scrollContainer
        }
      >
        <Animated.View
          style={[
            styles.body,
            {
              opacity:
                fadeAnim,
              transform: [
                {
                  translateY:
                    slideUpAnim,
                },
              ],
            },
          ]}
        >
          {/* PROFILE / SELFIE */}

          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  theme.cardBg,
                borderColor:
                  theme.border,
                alignItems:
                  'center',
              },
            ]}
          >
            <View
              style={
                styles.largeAvatarContainer
              }
            >
              {selfieUri ? (
                <Image
                  source={{
                    uri: selfieUri,
                  }}
                  style={
                    styles.largeAvatar
                  }
                />
              ) : (
                <View
                  style={[
                    styles.largeAvatar,
                    styles.avatarPlaceholder,
                    {
                      backgroundColor:
                        theme.bg,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={40}
                    color={
                      theme.textMuted
                    }
                  />
                </View>
              )}
            </View>

            <Text
              style={[
                styles.riderNameText,
                {
                  color:
                    theme.text,
                  marginTop: 12,
                },
              ]}
            >
              {rider.rider_name ||
                'Rider'}
            </Text>

            <Text
              style={[
                styles.riderIdText,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              ID:{' '}
              {rider.rider_code ||
                'N/A'}
            </Text>

            {rider.vehicle_type ? (
              <View
                style={[
                  styles.vehicleTypeBadge,
                  {
                    backgroundColor:
                      COLORS.emeraldGreen +
                      '15',
                    borderColor:
                      COLORS.emeraldGreen,
                  },
                ]}
              >
                <Ionicons
                  name="bicycle-outline"
                  size={12}
                  color={
                    COLORS.emeraldGreen
                  }
                  style={{
                    marginRight: 4,
                  }}
                />

                <Text
                  style={[
                    styles.vehicleTypeText,
                    {
                      color:
                        COLORS.emeraldGreen,
                    },
                  ]}
                >
                  {
                    rider.vehicle_type
                  }
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.selfieBtn,
                {
                  backgroundColor:
                    COLORS.emeraldGreen,
                },
              ]}
              onPress={
                handleTakeSelfie
              }
              disabled={
                uploadingSelfie
              }
            >
              {uploadingSelfie ? (
                <ActivityIndicator
                  size="small"
                  color="#fff"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-reverse-outline"
                    size={18}
                    color="#fff"
                    style={{
                      marginRight: 6,
                    }}
                  />

                  <Text
                    style={
                      styles.selfieBtnText
                    }
                  >
                    {selfieUri
                      ? 'Retake Selfie'
                      : 'Take Selfie'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text
              style={{
                color:
                  theme.textMuted,
                fontSize: 11,
                textAlign:
                  'center',
                marginTop: 8,
                lineHeight: 16,
              }}
            >
              Selfie is optional while
              completing your documents.
            </Text>
          </View>

          {/* RESIDENCE LOCATION */}

          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  theme.cardBg,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <View
              style={
                styles.sectionHeaderRow
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color:
                        theme.text,
                    },
                  ]}
                >
                  Residence Location
                </Text>

                <Text
                  style={[
                    styles.sectionDescription,
                    {
                      color:
                        theme.textMuted,
                    },
                  ]}
                >
                  Add where you live. Use GPS or enter the address manually.
                </Text>
              </View>

              <Ionicons
                name="location-outline"
                size={22}
                color={
                  COLORS.emeraldGreen
                }
              />
            </View>

            <TouchableOpacity
              style={[
                styles.locationButton,
                {
                  backgroundColor:
                    COLORS.emeraldGreen,
                },
              ]}
              onPress={
                handleUseCurrentLocation
              }
              disabled={
                savingLocation
              }
            >
              {savingLocation ? (
                <ActivityIndicator
                  color="#fff"
                />
              ) : (
                <>
                  <Ionicons
                    name="navigate-outline"
                    size={18}
                    color="#fff"
                    style={{
                      marginRight: 7,
                    }}
                  />

                  <Text
                    style={
                      styles.locationButtonText
                    }
                  >
                    Use My Current Location
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {latitude &&
            longitude ? (
              <View
                style={[
                  styles.coordinatesBox,
                  {
                    backgroundColor:
                      theme.bg,
                    borderColor:
                      theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="pin-outline"
                  size={16}
                  color={
                    COLORS.emeraldGreen
                  }
                />

                <Text
                  style={[
                    styles.coordinatesText,
                    {
                      color:
                        theme.textMuted,
                    },
                  ]}
                >
                  Pinned location:{' '}
                  {latitude},{' '}
                  {longitude}
                </Text>
              </View>
            ) : null}

            <Text
              style={[
                styles.inputGroupLabel,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              Address
            </Text>

            <TextInput
              style={[
                styles.multilineInput,
                {
                  color:
                    theme.text,
                  borderColor:
                    theme.border,
                  backgroundColor:
                    theme.bg,
                },
              ]}
              placeholder="House / flat / street / area"
              placeholderTextColor={
                theme.textMuted
              }
              value={address}
              onChangeText={
                setAddress
              }
              multiline
              textAlignVertical="top"
            />

            <Text
              style={[
                styles.inputGroupLabel,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              City
            </Text>

            <TextInput
              style={[
                styles.inputContainer,
                styles.input,
                {
                  color:
                    theme.text,
                  borderColor:
                    theme.border,
                  backgroundColor:
                    theme.bg,
                },
              ]}
              placeholder="City"
              placeholderTextColor={
                theme.textMuted
              }
              value={city}
              onChangeText={
                setCity
              }
            />

            <Text
              style={[
                styles.inputGroupLabel,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              State
            </Text>

            <TextInput
              style={[
                styles.inputContainer,
                styles.input,
                {
                  color:
                    theme.text,
                  borderColor:
                    theme.border,
                  backgroundColor:
                    theme.bg,
                },
              ]}
              placeholder="State"
              placeholderTextColor={
                theme.textMuted
              }
              value={state}
              onChangeText={
                setState
              }
            />

            <Text
              style={[
                styles.inputGroupLabel,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              PIN Code
            </Text>

            <TextInput
              style={[
                styles.inputContainer,
                styles.input,
                {
                  color:
                    theme.text,
                  borderColor:
                    theme.border,
                  backgroundColor:
                    theme.bg,
                },
              ]}
              placeholder="6-digit PIN code"
              placeholderTextColor={
                theme.textMuted
              }
              keyboardType="number-pad"
              maxLength={6}
              value={pinCode}
              onChangeText={(value) =>
                setPinCode(
                  value
                    .replace(
                      /[^0-9]/g,
                      ''
                    )
                    .slice(
                      0,
                      6
                    )
                )
              }
            />

            <TouchableOpacity
              style={[
                styles.outlineButton,
                {
                  borderColor:
                    COLORS.emeraldGreen,
                },
              ]}
              onPress={
                handleSaveLocation
              }
              disabled={
                savingLocation
              }
            >
              {savingLocation ? (
                <ActivityIndicator
                  color={
                    COLORS.emeraldGreen
                  }
                />
              ) : (
                <Text
                  style={[
                    styles.outlineButtonText,
                    {
                      color:
                        COLORS.emeraldGreen,
                    },
                  ]}
                >
                  {hasResidenceLocation
                    ? 'Update Residence Location'
                    : 'Save Residence Location'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* KYC STATUS */}

          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  theme.cardBg,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                {
                  color:
                    theme.text,
                },
              ]}
            >
              KYC & Bank Details
            </Text>

            <Text
              style={[
                styles.infoLabel,
                {
                  color:
                    theme.textMuted,
                  marginVertical: 8,
                },
              ]}
            >
              KYC Status:{' '}
              <Text
                style={{
                  fontWeight:
                    '700',
                  textTransform:
                    'capitalize',
                }}
              >
                {kycStatus.replace(
                  '_',
                  ' '
                )}
              </Text>
            </Text>

            {kycStatus ===
              'rejected' &&
            profile?.rejection_reason ? (
              <Text
                style={{
                  color:
                    COLORS.danger,
                  marginBottom: 8,
                }}
              >
                Reason:{' '}
                {
                  profile.rejection_reason
                }
              </Text>
            ) : null}

            <Text
              style={[
                styles.sectionDescription,
                {
                  color:
                    theme.textMuted,
                  marginBottom: 10,
                },
              ]}
            >
              Bank details are required. KYC documents are uploaded individually and can be completed later.
            </Text>

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    COLORS.emeraldGreen,
                  marginTop: 6,
                },
              ]}
              onPress={() =>
                setIsKycModalOpen(
                  true
                )
              }
            >
              <Text
                style={
                  styles.submitButtonText
                }
              >
                {kycStatus ===
                'verified'
                  ? 'View / Update Details'
                  : 'Manage KYC & Bank Details'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* LOGOUT */}

          <TouchableOpacity
            style={
              styles.logoutButton
            }
            onPress={
              handleLogout
            }
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={
                COLORS.danger
              }
              style={{
                marginRight: 6,
              }}
            />

            <Text
              style={
                styles.logoutText
              }
            >
              Log Out
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* KYC MODAL */}

      <Modal
        visible={
          isKycModalOpen
        }
        animationType="slide"
        onRequestClose={() =>
          setIsKycModalOpen(
            false
          )
        }
      >
        <View
          style={{
            flex: 1,
            backgroundColor:
              theme.bg,
          }}
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor:
                  theme.headerBg,
                borderColor:
                  theme.border,
              },
            ]}
          >
            <View
              style={
                styles.headerTopRow
              }
            >
              <View
                style={{
                  flex: 1,
                  paddingRight: 12,
                }}
              >
                <Text
                  style={[
                    styles.headerTitle,
                    {
                      color:
                        theme.text,
                      fontSize: 20,
                    },
                  ]}
                >
                  KYC & Bank Details
                </Text>

                <Text
                  style={{
                    color:
                      theme.textMuted,
                    fontSize: 11,
                    marginTop: 3,
                  }}
                >
                  Upload what you have now. Add the rest later.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setIsKycModalOpen(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={
                    theme.text
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 50,
            }}
          >
            {/* SELFIE */}

            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    theme.cardBg,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color:
                      theme.text,
                    marginBottom: 8,
                  },
                ]}
              >
                Selfie Verification
                <Text
                  style={{
                    color:
                      theme.textMuted,
                    fontSize: 12,
                    fontWeight:
                      '500',
                  }}
                >
                  {' '}
                  (Optional)
                </Text>
              </Text>

              <Text
                style={{
                  color:
                    theme.textMuted,
                  fontSize: 12,
                  lineHeight: 18,
                  marginBottom: 12,
                }}
              >
                You can upload your selfie now or later.
              </Text>

              {selfieUri ? (
                <Image
                  source={{
                    uri: selfieUri,
                  }}
                  style={[
                    styles.selfiePreview,
                    {
                      borderColor:
                        COLORS.emeraldGreen,
                    },
                  ]}
                />
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor:
                      COLORS.emeraldGreen,
                  },
                ]}
                onPress={
                  handleTakeSelfie
                }
              >
                <Ionicons
                  name="camera-outline"
                  size={18}
                  color="#fff"
                  style={{
                    marginRight: 8,
                  }}
                />

                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  {selfieUri
                    ? 'Retake Selfie'
                    : 'Take Selfie'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* IDENTITY DOCUMENTS */}

            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    theme.cardBg,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <View
                style={
                  styles.sectionHeaderRow
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color:
                          theme.text,
                        marginBottom: 5,
                      },
                    ]}
                  >
                    Identity Documents
                  </Text>

                  <Text
                    style={[
                      styles.sectionDescription,
                      {
                        color:
                          theme.textMuted,
                      },
                    ]}
                  >
                    No document is required all at once. Upload each document whenever you have it.
                  </Text>
                </View>

                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={
                    COLORS.emeraldGreen
                  }
                />
              </View>

              {/* AADHAAR */}

              <Text
                style={[
                  styles.subsectionTitle,
                  {
                    color:
                      theme.text,
                  },
                ]}
              >
                Aadhaar
              </Text>

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                Aadhaar Number
                <Text
                  style={{
                    color:
                      theme.textMuted,
                  }}
                >
                  {' '}
                  (Optional)
                </Text>
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="12-digit Aadhaar Number"
                placeholderTextColor={
                  theme.textMuted
                }
                keyboardType="number-pad"
                maxLength={12}
                value={
                  aadhaarNumber
                }
                onChangeText={(
                  value
                ) =>
                  setAadhaarNumber(
                    value
                      .replace(
                        /[^0-9]/g,
                        ''
                      )
                      .slice(
                        0,
                        12
                      )
                  )
                }
              />

              {renderDocPickerButton(
                'Aadhaar Front',
                aadhaarFrontUri,
                'aadhaar_front'
              )}

              {renderDocPickerButton(
                'Aadhaar Back',
                aadhaarBackUri,
                'aadhaar_back'
              )}

              {/* PAN */}

              <Text
                style={[
                  styles.subsectionTitle,
                  {
                    color:
                      theme.text,
                  },
                ]}
              >
                PAN Card
              </Text>

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                PAN Number
                <Text
                  style={{
                    color:
                      theme.textMuted,
                  }}
                >
                  {' '}
                  (Optional)
                </Text>
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  styles.uppercaseText,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="10-character PAN"
                placeholderTextColor={
                  theme.textMuted
                }
                maxLength={10}
                autoCapitalize="characters"
                value={
                  panNumber
                }
                onChangeText={(
                  value
                ) =>
                  setPanNumber(
                    value
                      .replace(
                        /[^a-zA-Z0-9]/g,
                        ''
                      )
                      .toUpperCase()
                      .slice(
                        0,
                        10
                      )
                  )
                }
              />

              {renderDocPickerButton(
                'PAN Card',
                panUri,
                'pan'
              )}

              {/* DRIVING LICENCE */}

              <Text
                style={[
                  styles.subsectionTitle,
                  {
                    color:
                      theme.text,
                  },
                ]}
              >
                Driving Licence
              </Text>

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                Driving Licence Number
                <Text
                  style={{
                    color:
                      theme.textMuted,
                  }}
                >
                  {' '}
                  {isEvOrNonMotorized
                    ? '(Optional for EV)'
                    : '(Optional — upload later)'}
                </Text>
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  styles.uppercaseText,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="Enter driving licence number"
                placeholderTextColor={
                  theme.textMuted
                }
                autoCapitalize="characters"
                value={
                  drivingLicenseNumber
                }
                onChangeText={(
                  value
                ) =>
                  setDrivingLicenseNumber(
                    value.toUpperCase()
                  )
                }
              />

              {renderDocPickerButton(
                'Driving Licence',
                drivingLicenseUri,
                'driving_license'
              )}
            </View>

            {/* BANK DETAILS */}

            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    theme.cardBg,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <View
                style={
                  styles.sectionHeaderRow
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color:
                          theme.text,
                        marginBottom: 5,
                      },
                    ]}
                  >
                    Bank Details *
                  </Text>

                  <Text
                    style={[
                      styles.sectionDescription,
                      {
                        color:
                          theme.textMuted,
                      },
                    ]}
                  >
                    Bank details are mandatory for rider payments and settlements.
                  </Text>
                </View>

                <Ionicons
                  name="card-outline"
                  size={22}
                  color={
                    COLORS.emeraldGreen
                  }
                />
              </View>

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                Account Holder Name *
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="Account holder name"
                placeholderTextColor={
                  theme.textMuted
                }
                value={
                  accountHolder
                }
                onChangeText={
                  setAccountHolder
                }
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                Bank Name *
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="Bank name"
                placeholderTextColor={
                  theme.textMuted
                }
                value={
                  bankName
                }
                onChangeText={
                  setBankName
                }
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                Account Number *
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="Bank account number"
                placeholderTextColor={
                  theme.textMuted
                }
                keyboardType="number-pad"
                value={
                  accountNumber
                }
                onChangeText={
                  setAccountNumber
                }
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                IFSC Code *
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  styles.uppercaseText,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="11-character IFSC Code"
                placeholderTextColor={
                  theme.textMuted
                }
                maxLength={11}
                autoCapitalize="characters"
                value={
                  ifsc
                }
                onChangeText={(
                  value
                ) =>
                  setIfsc(
                    value
                      .replace(
                        /[^a-zA-Z0-9]/g,
                        ''
                      )
                      .toUpperCase()
                      .slice(
                        0,
                        11
                      )
                  )
                }
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  {
                    color:
                      theme.textMuted,
                  },
                ]}
              >
                UPI ID
                <Text
                  style={{
                    color:
                      theme.textMuted,
                  }}
                >
                  {' '}
                  (Optional)
                </Text>
              </Text>

              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  {
                    color:
                      theme.text,
                    borderColor:
                      theme.border,
                    backgroundColor:
                      theme.bg,
                  },
                ]}
                placeholder="example@upi"
                placeholderTextColor={
                  theme.textMuted
                }
                autoCapitalize="none"
                value={
                  upi
                }
                onChangeText={
                  setUpi
                }
              />

              {renderDocPickerButton(
                'Payment QR Code',
                qrCodeUri,
                'qr_code'
              )}
            </View>

            {/* INFO */}

            <View
              style={[
                styles.submitInfoBox,
                {
                  backgroundColor:
                    theme.cardBg,
                  borderColor:
                    theme.border,
                },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={
                  COLORS.emeraldGreen
                }
              />

              <Text
                style={{
                  flex: 1,
                  color:
                    theme.textMuted,
                  fontSize: 12,
                  lineHeight: 18,
                  marginLeft: 10,
                }}
              >
                You do not need to upload every document now. Save your bank details and whichever documents you currently have. You can return here later and add the remaining documents.
              </Text>
            </View>

            {/* SAVE */}

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    COLORS.emeraldGreen,
                },
              ]}
              onPress={
                handleSubmitKYC
              }
              disabled={
                submittingKyc
              }
            >
              {submittingKyc ? (
                <ActivityIndicator
                  color="#fff"
                />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={18}
                    color="#fff"
                    style={{
                      marginRight: 8,
                    }}
                  />

                  <Text
                    style={
                      styles.submitButtonText
                    }
                  >
                    Save Details
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },

  centeredContainer: {
    flex: 1,
    justifyContent:
      'center',
    alignItems:
      'center',
    padding: 20,
  },

  header: {
    paddingTop:
      Platform.OS === 'ios'
        ? 64
        : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },

  headerTopRow: {
    flexDirection:
      'row',
    justifyContent:
      'space-between',
    alignItems:
      'center',
  },

  headerTitle: {
    fontSize: 24,
    fontWeight:
      '700',
  },

  switchTrack: {
    width: 50,
    height: 26,
    borderRadius: 99,
    padding: 2,
    justifyContent:
      'center',
  },

  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor:
      '#fff',
    justifyContent:
      'center',
    alignItems:
      'center',
  },

  body: {
    padding: 16,
  },

  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight:
      '700',
  },

  sectionHeaderRow: {
    flexDirection:
      'row',
    alignItems:
      'flex-start',
    marginBottom: 12,
  },

  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },

  subsectionTitle: {
    fontSize: 14,
    fontWeight:
      '700',
    marginTop: 8,
    marginBottom: 10,
  },

  largeAvatarContainer: {
    position:
      'relative',
  },

  largeAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor:
      COLORS.emeraldGreen,
  },

  avatarPlaceholder: {
    justifyContent:
      'center',
    alignItems:
      'center',
  },

  riderNameText: {
    fontSize: 18,
    fontWeight:
      '700',
  },

  riderIdText: {
    fontSize: 13,
    marginTop: 2,
  },

  vehicleTypeBadge: {
    flexDirection:
      'row',
    alignItems:
      'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },

  vehicleTypeText: {
    fontSize: 12,
    fontWeight:
      '700',
  },

  selfieBtn: {
    flexDirection:
      'row',
    alignItems:
      'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
    marginTop: 12,
  },

  selfieBtnText: {
    color: '#fff',
    fontWeight:
      '700',
    fontSize: 13,
  },

  selfiePreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    alignSelf:
      'center',
    marginBottom: 12,
  },

  infoLabel: {
    fontSize: 14,
  },

  inputGroupLabel: {
    fontSize: 12,
    fontWeight:
      '700',
    textTransform:
      'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },

  inputContainer: {
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    height: 48,
    borderWidth: 1,
  },

  input: {
    fontSize: 14,
    fontWeight:
      '600',
  },

  multilineInput: {
    minHeight: 82,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderWidth: 1,
    fontSize: 14,
    fontWeight:
      '600',
  },

  uppercaseText: {
    textTransform:
      'uppercase',
  },

  docUploadBtn: {
    flexDirection:
      'row',
    alignItems:
      'center',
    justifyContent:
      'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  docUploadBtnText: {
    fontSize: 13,
    fontWeight:
      '600',
  },

  docPreviewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 8,
    resizeMode:
      'cover',
  },

  coordinatesBox: {
    flexDirection:
      'row',
    alignItems:
      'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    marginBottom: 12,
  },

  coordinatesText: {
    flex: 1,
    fontSize: 11,
    marginLeft: 7,
    lineHeight: 16,
  },

  locationButton: {
    height: 50,
    borderRadius: 99,
    alignItems:
      'center',
    justifyContent:
      'center',
    flexDirection:
      'row',
    marginBottom: 12,
  },

  locationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight:
      '700',
  },

  outlineButton: {
    height: 48,
    borderRadius: 99,
    borderWidth: 1,
    alignItems:
      'center',
    justifyContent:
      'center',
    marginTop: 4,
  },

  outlineButtonText: {
    fontSize: 14,
    fontWeight:
      '700',
  },

  submitInfoBox: {
    flexDirection:
      'row',
    alignItems:
      'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },

  submitButton: {
    height: 50,
    borderRadius: 99,
    alignItems:
      'center',
    justifyContent:
      'center',
    marginVertical: 8,
    flexDirection:
      'row',
  },

  submitButtonText: {
    color: '#fff',
    fontWeight:
      '700',
    fontSize: 15,
  },

  logoutButton: {
    flexDirection:
      'row',
    alignItems:
      'center',
    justifyContent:
      'center',
    backgroundColor:
      '#FEE2E2',
    height: 48,
    borderRadius: 99,
    marginTop: 8,
  },

  logoutText: {
    color:
      COLORS.danger,
    fontWeight:
      '700',
    fontSize: 14,
  },

  errorTitle: {
    fontSize: 16,
    fontWeight:
      '700',
    marginVertical: 12,
  },

  retryButton: {
    backgroundColor:
      COLORS.emeraldGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
  },

  retryText: {
    color: '#fff',
  },
});