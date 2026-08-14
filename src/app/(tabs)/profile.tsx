import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
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
  profile_photo_url?: string;
  vehicle_type?: string;
  vehicle_number?: string;

  // Identity documents
  aadhaar_number?: string;
  aadhaar_document_url?: string;
  pan_number?: string;
  pan_document_url?: string;
  driving_license_number?: string;
  driving_license_document_url?: string;

  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;

  gender?: string;
  blood_group?: string;

  selfie_photo_url?: string;
  selfie_locked?: boolean;
  selfie_uploaded_at?: string;

  vehicle_rc_document_url?: string;
  vehicle_front_photo_url?: string;
  vehicle_back_photo_url?: string;

  created_at?: string;
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

  passbook_url?: string;

  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;

  rejection_reason?: string;

  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  emergency_contact?: string;
}

type UploadType =
  | 'aadhaar'
  | 'aadhaar_back'
  | 'pan'
  | 'dl'
  | 'selfie'
  | 'passbook'
  | 'vehicle_rc'
  | 'vehicle_front'
  | 'vehicle_back';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const BLOOD_GROUP_OPTIONS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme, theme } = useTheme();

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<UploadType | null>(null);
  const [requestingUpdate, setRequestingUpdate] = useState(false);

  const themeToggleAnim = useRef(
    new Animated.Value(isDarkMode ? 1 : 0)
  ).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(20)).current;
  const logoutBtnScale = useRef(new Animated.Value(1)).current;

  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarUrl, setAadhaarUrl] = useState('');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState('');

  const [panNumber, setPanNumber] = useState('');
  const [panUrl, setPanUrl] = useState('');

  const [dlNumber, setDlNumber] = useState('');
  const [dlUrl, setDlUrl] = useState('');

  const [passbookUrl, setPassbookUrl] = useState('');
  const [vehicleRcUrl, setVehicleRcUrl] = useState('');
  const [vehicleFrontUrl, setVehicleFrontUrl] = useState('');
  const [vehicleBackUrl, setVehicleBackUrl] = useState('');

  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');

  const [activeDropdown, setActiveDropdown] = useState<
    'gender' | 'bloodGroup' | null
  >(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  useEffect(() => {
    Animated.timing(themeToggleAnim, {
      toValue: isDarkMode ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isDarkMode]);

  const translateX = themeToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 26],
  });

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

  const animateButton = (
    scaleRef: Animated.Value,
    toVal: number
  ) => {
    Animated.timing(scaleRef, {
      toValue: toVal,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const normalizePhotoUrl = (url?: string) => {
    if (!url) return '';
    return url.replace('/rider-profiles/', '/avatars/');
  };

  const isEvOrNonMotorized = [
    'ev',
    'electric',
    'bicycle',
    'cycle',
    'ev gearbike',
  ].some((type) =>
    (rider?.vehicle_type || '').toLowerCase().includes(type)
  );

  const getKycItems = () => {
    const items = [
      {
        key: 'gender',
        label: 'Gender',
        complete: !!gender,
      },
      {
        key: 'blood',
        label: 'Blood Group',
        complete: !!bloodGroup,
      },
      {
        key: 'selfie',
        label: 'Selfie',
        complete: !!selfieUrl,
      },
      {
        key: 'aadhaar_number',
        label: 'Aadhaar Number',
        complete: aadhaarNumber.trim().length === 12,
      },
      {
        key: 'aadhaar_front',
        label: 'Aadhaar Front',
        complete: !!aadhaarUrl,
      },
      {
        key: 'aadhaar_back',
        label: 'Aadhaar Back',
        complete: !!aadhaarBackUrl,
      },
      {
        key: 'pan_number',
        label: 'PAN Number',
        complete: panNumber.trim().length === 10,
      },
      {
        key: 'pan',
        label: 'PAN Document',
        complete: !!panUrl,
      },
      {
        key: 'bank_holder',
        label: 'Account Holder',
        complete: !!accountHolder.trim(),
      },
      {
        key: 'bank',
        label: 'Bank Name',
        complete: !!bankName.trim(),
      },
      {
        key: 'account',
        label: 'Account Number',
        complete: !!accountNumber.trim(),
      },
      {
        key: 'ifsc',
        label: 'IFSC Code',
        complete: ifsc.trim().length >= 11,
      },
      {
        key: 'passbook',
        label: 'Bank Passbook',
        complete: !!passbookUrl,
      },
    ];

    if (!isEvOrNonMotorized) {
      items.push(
        {
          key: 'dl_number',
          label: 'Driving Licence Number',
          complete: dlNumber.trim().length > 0,
        },
        {
          key: 'dl',
          label: 'Driving Licence',
          complete: !!dlUrl,
        }
      );
    }

    items.push(
      {
        key: 'vehicle_rc',
        label: 'Vehicle RC',
        complete: !!vehicleRcUrl,
      },
      {
        key: 'vehicle_front',
        label: 'Vehicle Front Photo',
        complete: !!vehicleFrontUrl,
      },
      {
        key: 'vehicle_back',
        label: 'Vehicle Back Photo',
        complete: !!vehicleBackUrl,
      }
    );

    return items;
  };

  const kycItems = getKycItems();
  const completedKycItems = kycItems.filter((item) => item.complete).length;
  const totalKycItems = kycItems.length;
  const kycProgress =
    totalKycItems > 0 ? completedKycItems / totalKycItems : 0;
  const missingKycItems = kycItems.filter((item) => !item.complete);
  const isKycComplete = missingKycItems.length === 0;

  const populateFields = (
    riderData: Rider,
    profileData: RiderProfile | null
  ) => {
    setGender(riderData.gender || '');
    setBloodGroup(riderData.blood_group || '');
    setSelfieUrl(
      normalizePhotoUrl(
        riderData.selfie_photo_url || riderData.profile_photo_url
      )
    );

    if (profileData) {
      setAadhaarNumber(
        profileData.aadhaar_number || riderData.aadhaar_number || ''
      );
      setAadhaarUrl(
        profileData.aadhaar_front_url ||
          riderData.aadhaar_document_url ||
          ''
      );
      setAadhaarBackUrl(profileData.aadhaar_back_url || '');

      setPanNumber(
        profileData.pan_number || riderData.pan_number || ''
      );
      setPanUrl(
        profileData.pan_card_url || riderData.pan_document_url || ''
      );

      setDlNumber(
        profileData.driving_license_number ||
          riderData.driving_license_number ||
          ''
      );
      setDlUrl(
        profileData.driving_license_url ||
          riderData.driving_license_document_url ||
          ''
      );

      setPassbookUrl(profileData.passbook_url || '');

      setAccountHolder(
        profileData.account_holder_name ||
          riderData.account_holder_name ||
          ''
      );
      setBankName(
        profileData.bank_name || riderData.bank_name || ''
      );
      setAccountNumber(
        profileData.account_number || riderData.account_number || ''
      );
      setIfsc(profileData.ifsc_code || riderData.ifsc_code || '');
      setUpi(profileData.upi_id || riderData.upi_id || '');
    }

    setVehicleRcUrl(riderData.vehicle_rc_document_url || '');
    setVehicleFrontUrl(riderData.vehicle_front_photo_url || '');
    setVehicleBackUrl(riderData.vehicle_back_photo_url || '');
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Authentication failed or user not logged in.');
      }

      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (riderError) {
        throw riderError;
      }

      const normalizedRider: Rider = {
        ...riderData,
        selfie_photo_url: normalizePhotoUrl(riderData.selfie_photo_url),
        profile_photo_url: normalizePhotoUrl(riderData.profile_photo_url),
      };

      setRider(normalizedRider);

      const { data: profileData, error: profileError } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('rider_id', riderData.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(profileData || null);
      populateFields(normalizedRider, profileData || null);

      startAnimations();
    } catch (err: any) {
      setError(
        err.message || 'An error occurred while loading profile.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = (type: UploadType) => {
    Alert.alert(
      'Upload Document',
      'Choose how you want to upload this document.',
      [
        {
          text: 'Take Photo',
          onPress: () => captureDocumentPhoto(type, 'camera'),
        },
        {
          text: 'Choose From Gallery',
          onPress: () => captureDocumentPhoto(type, 'gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const captureDocumentPhoto = async (
    type: UploadType,
    source: 'camera' | 'gallery'
  ) => {
    try {
      if (source === 'camera') {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Permission Denied',
            'Camera permission is required.'
          );
          return;
        }
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
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
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.7,
            });

      if (
        result.canceled ||
        !result.assets ||
        result.assets.length === 0
      ) {
        return;
      }

      await uploadDocumentFile(type, result.assets[0].uri);
    } catch (e) {
      console.error('Document picker error:', e);
      Alert.alert('Error', 'Unable to select the document photo.');
    }
  };

  const uploadDocumentFile = async (type: UploadType, uri: string) => {
    if (!rider) return;

    try {
      setUploadingDoc(type);

      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send();
      });

      const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExtension =
        extension === 'png'
          ? 'png'
          : extension === 'webp'
          ? 'webp'
          : 'jpg';

      const fileName = `${type}-${rider.id}-${Date.now()}.${safeExtension}`;
      const contentType =
        safeExtension === 'png'
          ? 'image/png'
          : safeExtension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from('rider-documents')
        .upload(fileName, blob, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from('rider-documents')
        .getPublicUrl(fileName);

      switch (type) {
        case 'aadhaar':
          await updateProfileAndState(
            { aadhaar_front_url: publicUrl },
            { aadhaar_front_url: publicUrl }
          );
          setAadhaarUrl(publicUrl);
          break;

        case 'aadhaar_back':
          await updateProfileAndState(
            { aadhaar_back_url: publicUrl },
            { aadhaar_back_url: publicUrl }
          );
          setAadhaarBackUrl(publicUrl);
          break;

        case 'pan':
          await updateProfileAndState(
            { pan_card_url: publicUrl },
            { pan_card_url: publicUrl }
          );
          setPanUrl(publicUrl);
          break;

        case 'dl':
          await updateProfileAndState(
            { driving_license_url: publicUrl },
            { driving_license_url: publicUrl }
          );
          setDlUrl(publicUrl);
          break;

        case 'passbook':
          await updateProfileAndState(
            { passbook_url: publicUrl },
            { passbook_url: publicUrl }
          );
          setPassbookUrl(publicUrl);
          break;

        case 'selfie':
          await updateRiderAndState({
            selfie_photo_url: publicUrl,
            selfie_uploaded_at: new Date().toISOString(),
          });
          setSelfieUrl(publicUrl);
          break;

        case 'vehicle_rc':
          await updateRiderAndState({
            vehicle_rc_document_url: publicUrl,
          });
          setVehicleRcUrl(publicUrl);
          break;

        case 'vehicle_front':
          await updateRiderAndState({
            vehicle_front_photo_url: publicUrl,
          });
          setVehicleFrontUrl(publicUrl);
          break;

        case 'vehicle_back':
          await updateRiderAndState({
            vehicle_back_photo_url: publicUrl,
          });
          setVehicleBackUrl(publicUrl);
          break;
      }

      Alert.alert(
        'Upload Successful',
        'Document uploaded successfully.'
      );
    } catch (err: any) {
      console.error('Document upload error:', err);
      Alert.alert(
        'Upload Failed',
        err?.message || 'Could not upload document.'
      );
    } finally {
      setUploadingDoc(null);
    }
  };

  const updateProfileAndState = async (
    profileUpdate: Partial<RiderProfile>,
    stateUpdate: Partial<RiderProfile>
  ) => {
    if (!rider) return;

    const { data, error: updateError } = await supabase
      .from('rider_profiles')
      .upsert(
        {
          rider_id: rider.id,
          ...profileUpdate,
        },
        { onConflict: 'rider_id' }
      )
      .select()
      .single();

    if (updateError) throw updateError;

    setProfile(
      (previous) =>
        ({
          ...(previous || {}),
          ...stateUpdate,
          ...(data || {}),
        }) as RiderProfile
    );
  };

  const updateRiderAndState = async (riderUpdate: Partial<Rider>) => {
    if (!rider) return;

    const { error: updateError } = await supabase
      .from('riders')
      .update(riderUpdate)
      .eq('id', rider.id);

    if (updateError) throw updateError;

    setRider((previous) =>
      previous ? { ...previous, ...riderUpdate } : previous
    );
  };

  const updateProfileNumbers = async () => {
    if (!rider) return;

    const profilePayload = {
      rider_id: rider.id,
      aadhaar_number: aadhaarNumber.trim() || null,
      pan_number: panNumber.trim().toUpperCase() || null,
      driving_license_number: dlNumber.trim().toUpperCase() || null,
      account_holder_name: accountHolder.trim() || null,
      bank_name: bankName.trim() || null,
      account_number: accountNumber.trim() || null,
      ifsc_code: ifsc.trim().toUpperCase() || null,
      upi_id: upi.trim() || null,
    };

    const { error } = await supabase.from('rider_profiles').upsert(
      profilePayload,
      { onConflict: 'rider_id' }
    );

    if (error) throw error;

    const { error: riderError } = await supabase
      .from('riders')
      .update({
        aadhaar_number: profilePayload.aadhaar_number,
        pan_number: profilePayload.pan_number,
        driving_license_number: profilePayload.driving_license_number,
        account_holder_name: profilePayload.account_holder_name,
        bank_name: profilePayload.bank_name,
        account_number: profilePayload.account_number,
        ifsc_code: profilePayload.ifsc_code,
        upi_id: profilePayload.upi_id,
        gender: gender || null,
        blood_group: bloodGroup || null,
      })
      .eq('id', rider.id);

    if (riderError) throw riderError;
  };

  const handleSaveBankDetails = async () => {
    if (!rider) return;

    if (!accountHolder.trim()) {
      return Alert.alert(
        'Validation Error',
        'Account Holder Name is required.'
      );
    }

    if (!bankName.trim()) {
      return Alert.alert(
        'Validation Error',
        'Bank Name is required.'
      );
    }

    if (!accountNumber.trim()) {
      return Alert.alert(
        'Validation Error',
        'Account Number is required.'
      );
    }

    if (!ifsc.trim()) {
      return Alert.alert(
        'Validation Error',
        'IFSC Code is required.'
      );
    }

    try {
      setSavingBankDetails(true);
      await updateProfileNumbers();

      Alert.alert('Success', 'Bank details updated successfully.');
      setIsEditingBank(false);
      await fetchProfileData();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message || 'Failed to save bank details.'
      );
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handleSubmitKYC = async () => {
    if (!rider) return;

    try {
      setSubmittingKyc(true);
      await updateProfileNumbers();

      const missing = getKycItems().filter((item) => !item.complete);

      if (missing.length > 0) {
        const firstMissing = missing
          .slice(0, 5)
          .map((item) => `• ${item.label}`)
          .join('\n');

        Alert.alert(
          'KYC Incomplete',
          `Please complete the following:\n\n${firstMissing}${
            missing.length > 5
              ? `\n• And ${missing.length - 5} more`
              : ''
          }`
        );
        return;
      }

      const { error: riderError } = await supabase
        .from('riders')
        .update({
          gender: gender,
          blood_group: bloodGroup,
          kyc_status: 'pending',
          status: 'inactive',
        })
        .eq('id', rider.id);

      if (riderError) throw riderError;

      const { error: profileError } = await supabase
        .from('rider_profiles')
        .upsert(
          {
            rider_id: rider.id,
            aadhaar_number: aadhaarNumber.trim(),
            pan_number: panNumber.trim().toUpperCase(),
            driving_license_number: dlNumber.trim().toUpperCase(),
            aadhaar_front_url: aadhaarUrl,
            aadhaar_back_url: aadhaarBackUrl,
            pan_card_url: panUrl,
            driving_license_url: dlUrl,
            passbook_url: passbookUrl,
            account_holder_name: accountHolder.trim(),
            bank_name: bankName.trim(),
            account_number: accountNumber.trim(),
            ifsc_code: ifsc.trim().toUpperCase(),
            upi_id: upi.trim(),
            kyc_status: 'pending',
          },
          { onConflict: 'rider_id' }
        );

      if (profileError) throw profileError;

      setRider((previous) =>
        previous
          ? {
              ...previous,
              gender,
              blood_group: bloodGroup,
              kyc_status: 'pending',
              status: 'inactive',
            }
          : previous
      );

      await fetchProfileData();

      Alert.alert(
        'Submission Successful',
        'Your KYC has been submitted for verification. You will be notified after admin review.'
      );
    } catch (err: any) {
      Alert.alert(
        'Submission Failed',
        err?.message || 'Failed to submit KYC.'
      );
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleRequestDocumentUpdate = async () => {
    if (!rider) return;

    try {
      setRequestingUpdate(true);

      const { error: ticketError } = await supabase
        .from('rider_support_tickets')
        .insert({
          rider_id: rider.id,
          category: 'document_update',
          status: 'open',
          subject: 'Request Document Update',
        });

      if (ticketError) throw ticketError;

      Alert.alert(
        'Success',
        'Document update request submitted successfully.'
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message || 'Failed to submit document update request.'
      );
    } finally {
      setRequestingUpdate(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
          } catch (err) {
            Alert.alert('Error', 'Failed to sign out properly.');
          }
        },
      },
    ]);
  };

  const handleOpenHelp = () =>
    Linking.openURL('https://rivo-website.pages.dev/help');

  const renderUploadButton = (
    type: UploadType,
    label: string,
    uploaded: boolean
  ) => (
    <View style={styles.docUploadRow}>
      <TouchableOpacity
        style={[
          styles.docUploadBtn,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
        onPress={() => handleUploadDocument(type)}
        disabled={uploadingDoc === type}
      >
        {uploadingDoc === type ? (
          <ActivityIndicator
            size="small"
            color={COLORS.emeraldGreen}
          />
        ) : (
          <>
            <Ionicons
              name="camera-outline"
              size={18}
              color={COLORS.emeraldGreen}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.docUploadBtnText,
                { color: COLORS.emeraldGreen },
              ]}
            >
              {uploaded ? `Re-upload ${label}` : `Upload ${label}`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {uploaded && (
        <Ionicons
          name="checkmark-circle-outline"
          size={20}
          color={COLORS.emeraldGreen}
          style={{ marginLeft: 8 }}
        />
      )}
    </View>
  );

  const renderPreview = (url: string) =>
    url ? (
      <Image source={{ uri: url }} style={styles.docPreviewImage} />
    ) : null;

  if (loading) {
    return (
      <View
        style={[
          styles.skeletonContainer,
          { backgroundColor: theme.bg },
        ]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.headerBg}
        />
        <View
          style={[
            styles.skeletonHeader,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        />
        <ScrollView style={styles.skeletonBody}>
          <View
            style={[
              styles.skeletonCard,
              { backgroundColor: theme.cardBg },
            ]}
          />
          <View
            style={[
              styles.skeletonCard,
              { backgroundColor: theme.cardBg },
            ]}
          />
        </ScrollView>
      </View>
    );
  }

  if (error || !rider) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: theme.bg },
        ]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.bg}
        />
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={COLORS.danger}
        />
        <Text style={[styles.errorTitle, { color: theme.text }]}>
          Oops! Something went wrong
        </Text>
        <Text
          style={[
            styles.errorMessage,
            { color: theme.textMuted },
          ]}
        >
          {error || 'Failed to fetch profile.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchProfileData}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kycStatus = rider.kyc_status || 'not_submitted';
  const isEditable =
    kycStatus === 'not_submitted' || kycStatus === 'rejected';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.headerBg}
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBg,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Profile & KYC
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={toggleTheme}
            style={[
              styles.switchTrack,
              {
                backgroundColor: isDarkMode ? '#333' : '#E0E0E0',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.switchThumb,
                { transform: [{ translateX }] },
              ]}
            >
              <Ionicons
                name={isDarkMode ? 'moon-outline' : 'sunny-outline'}
                size={12}
                color={COLORS.jetBlack}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.body,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          {/* PROFILE HERO */}
          <View
            style={[
              styles.profileHeroCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={styles.largeAvatarContainer}>
                {selfieUrl ? (
                  <Image
                    source={{ uri: selfieUrl }}
                    style={styles.largeAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.largeAvatar,
                      styles.avatarPlaceholder,
                      { backgroundColor: theme.bg },
                    ]}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={40}
                      color={theme.textMuted}
                    />
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.riderNameText,
                  { color: theme.text, marginTop: 12 },
                ]}
              >
                {rider.rider_name || 'Rivo Rider'}
              </Text>

              <Text
                style={[
                  styles.riderIdText,
                  { color: theme.textMuted },
                ]}
              >
                ID: {rider.rider_code || 'N/A'}
              </Text>

              {rider.vehicle_type ? (
                <View
                  style={[
                    styles.vehicleTypeBadge,
                    {
                      backgroundColor: COLORS.emeraldGreen + '15',
                      borderColor: COLORS.emeraldGreen,
                    },
                  ]}
                >
                  <Ionicons
                    name="bicycle-outline"
                    size={12}
                    color={COLORS.emeraldGreen}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      { color: COLORS.emeraldGreen },
                    ]}
                  >
                    {rider.vehicle_type}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* SELFIE UPLOAD */}
            {isEditable && (
              <View style={{ marginTop: 16 }}>
                {renderUploadButton('selfie', 'Selfie', !!selfieUrl)}
                {renderPreview(selfieUrl)}
              </View>
            )}
          </View>

          {/* KYC PROGRESS */}
          {kycStatus !== 'verified' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.progressHeader}>
                <View>
                  <Text
                    style={[styles.cardTitle, { color: theme.text }]}
                  >
                    Complete Your KYC
                  </Text>
                  <Text
                    style={[
                      styles.progressSubtext,
                      { color: theme.textMuted },
                    ]}
                  >
                    {completedKycItems} of {totalKycItems} requirements
                    completed
                  </Text>
                </View>

                <Text
                  style={[
                    styles.progressPercentage,
                    { color: COLORS.emeraldGreen },
                  ]}
                >
                  {Math.round(kycProgress * 100)}%
                </Text>
              </View>

              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(kycProgress * 100)}%`,
                      backgroundColor: COLORS.emeraldGreen,
                    },
                  ]}
                />
              </View>

              {missingKycItems.length > 0 && (
                <View
                  style={[
                    styles.missingBox,
                    {
                      backgroundColor: isDarkMode
                        ? '#30230A'
                        : '#FFF7ED',
                      borderColor: isDarkMode
                        ? '#5A420F'
                        : '#FED7AA',
                    },
                  ]}
                >
                  <View style={styles.missingHeader}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={18}
                      color="#D97706"
                    />
                    <Text
                      style={[
                        styles.missingTitle,
                        {
                          color: isDarkMode ? '#FCD34D' : '#92400E',
                        },
                      ]}
                    >
                      Missing Information
                    </Text>
                  </View>

                  {missingKycItems.slice(0, 8).map((item) => (
                    <View key={item.key} style={styles.missingRow}>
                      <View style={styles.missingDot} />
                      <Text
                        style={[
                          styles.missingText,
                          {
                            color: isDarkMode
                              ? '#FDE68A'
                              : '#78350F',
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  ))}

                  {missingKycItems.length > 8 && (
                    <Text
                      style={[
                        styles.moreMissingText,
                        {
                          color: isDarkMode ? '#FCD34D' : '#92400E',
                        },
                      ]}
                    >
                      + {missingKycItems.length - 8} more items
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* STATUS */}
          {kycStatus === 'pending' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode
                    ? '#272314'
                    : '#FEF3C7',
                  borderColor: isDarkMode ? '#453507' : '#FDE68A',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color="#D97706"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    { fontSize: 16, color: '#B45309' },
                  ]}
                >
                  Documents Under Review
                </Text>
              </View>

              <Text
                style={[
                  styles.infoLabel,
                  {
                    color: isDarkMode ? '#FCD34D' : '#92400E',
                    lineHeight: 20,
                  },
                ]}
              >
                Your KYC documents have been submitted and are
                currently under admin review.
              </Text>
            </View>
          )}

          {kycStatus === 'rejected' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode
                    ? '#3B1212'
                    : '#FEE2E2',
                  borderColor: isDarkMode ? '#6B1D1D' : '#FCA5A5',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color={COLORS.danger}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    { fontSize: 16, color: '#B91C1C' },
                  ]}
                >
                  Verification Rejected
                </Text>
              </View>

              <Text
                style={[
                  styles.infoLabel,
                  {
                    color: '#B91C1C',
                    lineHeight: 20,
                    marginBottom: 8,
                  },
                ]}
              >
                Reason:{' '}
                {profile?.rejection_reason ||
                  'Document proofs were unreadable or mismatched.'}
              </Text>

              <Text
                style={[
                  styles.infoLabel,
                  { color: '#7F1D1D', fontSize: 12 },
                ]}
              >
                Update the missing or incorrect information below and
                resubmit.
              </Text>
            </View>
          )}

          {kycStatus === 'verified' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode
                    ? '#062E20'
                    : '#DCFCE7',
                  borderColor: isDarkMode ? '#044E34' : '#A7F3D0',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color={COLORS.emeraldGreen}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    { fontSize: 16, color: '#047857' },
                  ]}
                >
                  Account Verified
                </Text>
              </View>

              <Text
                style={[
                  styles.infoLabel,
                  {
                    color: isDarkMode ? '#A7F3D0' : '#065F46',
                    lineHeight: 20,
                  },
                ]}
              >
                Your rider KYC has been verified successfully.
              </Text>

              <TouchableOpacity
                style={[
                  styles.docUploadBtn,
                  {
                    backgroundColor: theme.bg,
                    borderColor: COLORS.emeraldGreen,
                    marginTop: 12,
                  },
                ]}
                onPress={handleRequestDocumentUpdate}
                disabled={requestingUpdate}
              >
                {requestingUpdate ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.emeraldGreen}
                  />
                ) : (
                  <Text
                    style={[
                      styles.docUploadBtnText,
                      { color: COLORS.emeraldGreen },
                    ]}
                  >
                    Request Document Update
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* PERSONAL DETAILS */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={COLORS.emeraldGreen}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Personal Details
              </Text>
            </View>

            <Text
              style={[
                styles.inputGroupLabel,
                { color: theme.textMuted },
              ]}
            >
              Gender *
            </Text>

            <TouchableOpacity
              activeOpacity={isEditable ? 0.7 : 1}
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
              onPress={() =>
                isEditable && setActiveDropdown('gender')
              }
            >
              <Ionicons
                name="male-female-outline"
                size={16}
                color={theme.textMuted}
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.input,
                  {
                    color: gender ? theme.text : theme.textMuted,
                  },
                ]}
              >
                {gender || 'Select Gender'}
              </Text>
              {isEditable && (
                <Ionicons
                  name="chevron-down-outline"
                  size={16}
                  color={theme.textMuted}
                />
              )}
            </TouchableOpacity>

            <Text
              style={[
                styles.inputGroupLabel,
                { color: theme.textMuted },
              ]}
            >
              Blood Group *
            </Text>

            <TouchableOpacity
              activeOpacity={isEditable ? 0.7 : 1}
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
              onPress={() =>
                isEditable && setActiveDropdown('bloodGroup')
              }
            >
              <Ionicons
                name="water-outline"
                size={16}
                color={theme.textMuted}
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.input,
                  {
                    color: bloodGroup ? theme.text : theme.textMuted,
                  },
                ]}
              >
                {bloodGroup || 'Select Blood Group'}
              </Text>
              {isEditable && (
                <Ionicons
                  name="chevron-down-outline"
                  size={16}
                  color={theme.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* IDENTITY */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.emeraldGreen}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Identity Verification
              </Text>
            </View>

            {/* AADHAAR */}
            <Text
              style={[
                styles.inputGroupLabel,
                { color: theme.textMuted },
              ]}
            >
              Aadhaar Number *
            </Text>

            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="card-outline"
                size={16}
                color={theme.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter 12-digit Aadhaar Number"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={12}
                value={aadhaarNumber}
                onChangeText={setAadhaarNumber}
                editable={isEditable}
              />
            </View>

            {renderUploadButton(
              'aadhaar',
              'Aadhaar Front',
              !!aadhaarUrl
            )}
            {renderPreview(aadhaarUrl)}

            {renderUploadButton(
              'aadhaar_back',
              'Aadhaar Back',
              !!aadhaarBackUrl
            )}
            {renderPreview(aadhaarBackUrl)}

            <View
              style={[
                styles.infoDivider,
                {
                  backgroundColor: theme.border,
                  marginVertical: 16,
                },
              ]}
            />

            {/* PAN */}
            <Text
              style={[
                styles.inputGroupLabel,
                { color: theme.textMuted },
              ]}
            >
              PAN Number *
            </Text>

            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={theme.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.uppercaseText,
                  { color: theme.text },
                ]}
                placeholder="Enter 10-character PAN"
                placeholderTextColor={theme.textMuted}
                maxLength={10}
                autoCapitalize="characters"
                value={panNumber}
                onChangeText={setPanNumber}
                editable={isEditable}
              />
            </View>

            {renderUploadButton('pan', 'PAN Card', !!panUrl)}
            {renderPreview(panUrl)}

            <View
              style={[
                styles.infoDivider,
                {
                  backgroundColor: theme.border,
                  marginVertical: 16,
                },
              ]}
            />

            {/* DL */}
            <Text
              style={[
                styles.inputGroupLabel,
                { color: theme.textMuted },
              ]}
            >
              Driving Licence{' '}
              {isEvOrNonMotorized
                ? '(Optional for EV / Cycle)'
                : '(Required)'}
            </Text>

            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="car-outline"
                size={16}
                color={theme.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.uppercaseText,
                  { color: theme.text },
                ]}
                placeholder={
                  isEvOrNonMotorized
                    ? 'Driving Licence Number (Optional)'
                    : 'Enter Driving Licence Number'
                }
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                value={dlNumber}
                onChangeText={setDlNumber}
                editable={isEditable}
              />
            </View>

            {renderUploadButton('dl', 'Driving Licence', !!dlUrl)}
            {renderPreview(dlUrl)}
          </View>

          {/* BANK */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={COLORS.emeraldGreen}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Bank Details
                </Text>
              </View>

              <TouchableOpacity
                style={styles.editBankBtn}
                onPress={() => setIsEditingBank(!isEditingBank)}
              >
                <Ionicons
                  name={
                    isEditingBank
                      ? 'close-outline'
                      : 'create-outline'
                  }
                  size={16}
                  color={COLORS.emeraldGreen}
                />
                <Text style={styles.editBankBtnText}>
                  {isEditingBank ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {(
              [
                [
                  'Account Holder Name *',
                  accountHolder,
                  setAccountHolder,
                  'Name as per bank records',
                ],
                [
                  'Bank Name *',
                  bankName,
                  setBankName,
                  'Bank name',
                ],
                [
                  'Account Number *',
                  accountNumber,
                  setAccountNumber,
                  'Bank account number',
                ],
                [
                  'IFSC Code *',
                  ifsc,
                  setIfsc,
                  '11-character IFSC Code',
                ],
                ['UPI ID', upi, setUpi, 'example@upi'],
              ] as [string, string, (value: string) => void, string][]
            ).map((field, index) => (
              <View key={field[0]}>
                <Text
                  style={[
                    styles.inputGroupLabel,
                    { color: theme.textMuted },
                  ]}
                >
                  {field[0]}
                </Text>

                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder={field[3]}
                    placeholderTextColor={theme.textMuted}
                    value={field[1]}
                    onChangeText={field[2]}
                    editable={isEditingBank || isEditable}
                    keyboardType={
                      index === 2 ? 'number-pad' : 'default'
                    }
                    autoCapitalize={
                      index === 3
                        ? 'characters'
                        : index === 4
                        ? 'none'
                        : 'sentences'
                    }
                    maxLength={index === 3 ? 11 : undefined}
                  />
                </View>
              </View>
            ))}

            {isEditingBank && (
              <TouchableOpacity
                style={[
                  styles.saveBankBtn,
                  { backgroundColor: COLORS.emeraldGreen },
                ]}
                onPress={handleSaveBankDetails}
                disabled={savingBankDetails}
              >
                {savingBankDetails ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBankBtnText}>
                    Save Bank Details
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* PASSBOOK */}
          {kycStatus !== 'verified' && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name="book-outline"
                  size={18}
                  color={COLORS.emeraldGreen}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Bank Passbook
                </Text>
              </View>

              <Text
                style={[
                  styles.infoLabel,
                  {
                    color: theme.textMuted,
                    marginTop: 6,
                    marginBottom: 10,
                  },
                ]}
              >
                Upload a clear photo of your passbook or bank proof.
              </Text>

              {renderUploadButton(
                'passbook',
                'Passbook',
                !!passbookUrl
              )}
              {renderPreview(passbookUrl)}
            </View>
          )}

          {/* VEHICLE DOCUMENTS */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="bicycle-outline"
                size={18}
                color={COLORS.emeraldGreen}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Vehicle Verification
              </Text>
            </View>

            <Text
              style={[
                styles.infoLabel,
                {
                  color: theme.textMuted,
                  marginTop: 6,
                  marginBottom: 10,
                },
              ]}
            >
              Complete your vehicle verification documents and photos.
            </Text>

            {renderUploadButton(
              'vehicle_rc',
              'Vehicle RC',
              !!vehicleRcUrl
            )}
            {renderPreview(vehicleRcUrl)}

            {renderUploadButton(
              'vehicle_front',
              'Vehicle Front Photo',
              !!vehicleFrontUrl
            )}
            {renderPreview(vehicleFrontUrl)}

            {renderUploadButton(
              'vehicle_back',
              'Vehicle Back Photo',
              !!vehicleBackUrl
            )}
            {renderPreview(vehicleBackUrl)}
          </View>

          {/* SUBMIT */}
          {isEditable && (
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: COLORS.emeraldGreen },
              ]}
              onPress={handleSubmitKYC}
              disabled={submittingKyc}
              activeOpacity={0.8}
            >
              {submittingKyc ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isKycComplete
                    ? 'Submit for Verification'
                    : `Complete ${missingKycItems.length} Missing Items`}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* SUPPORT */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
                marginTop: 4,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="help-circle-outline"
                size={17}
                color={COLORS.emeraldGreen}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Support
              </Text>
            </View>

            <TouchableOpacity
              style={styles.supportAction}
              onPress={handleOpenHelp}
            >
              <View style={styles.supportLeft}>
                <Ionicons
                  name="help-buoy-outline"
                  size={16}
                  color={theme.textMuted}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.supportText,
                    { color: theme.text },
                  ]}
                >
                  Help Center
                </Text>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.infoDivider,
                {
                  backgroundColor: theme.border,
                  marginVertical: 8,
                },
              ]}
            />

            <TouchableOpacity
              style={styles.supportAction}
              onPress={() => router.push('/notifications' as any)}
            >
              <View style={styles.supportLeft}>
                <Ionicons
                  name="notifications-outline"
                  size={16}
                  color={theme.textMuted}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.supportText,
                    { color: theme.text },
                  ]}
                >
                  Notifications
                </Text>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* LOGOUT */}
          <Animated.View
            style={{ transform: [{ scale: logoutBtnScale }] }}
          >
            <TouchableOpacity
              style={[
                styles.logoutButton,
                { borderColor: COLORS.danger + '30' },
              ]}
              onPress={handleLogout}
              onPressIn={() =>
                animateButton(logoutBtnScale, 0.96)
              }
              onPressOut={() => animateButton(logoutBtnScale, 1)}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color={COLORS.danger}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.appVersionContainer}>
            <Text
              style={[
                styles.appVersionText,
                { color: theme.textMuted },
              ]}
            >
              Version 2.4.0
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* DROPDOWN */}
      <Modal
        animationType="fade"
        transparent
        visible={activeDropdown !== null}
        onRequestClose={() => setActiveDropdown(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveDropdown(null)}
        >
          <View
            style={[
              styles.dropdownModalCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.dropdownModalTitle,
                { color: theme.text },
              ]}
            >
              {activeDropdown === 'gender'
                ? 'Select Gender'
                : 'Select Blood Group'}
            </Text>

            {(activeDropdown === 'gender'
              ? GENDER_OPTIONS
              : BLOOD_GROUP_OPTIONS
            ).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownItem,
                  { borderTopColor: theme.border },
                ]}
                onPress={() => {
                  if (activeDropdown === 'gender') {
                    setGender(option);
                  }
                  if (activeDropdown === 'bloodGroup') {
                    setBloodGroup(option);
                  }
                  setActiveDropdown(null);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    { color: theme.text },
                    (activeDropdown === 'gender' &&
                      gender === option) ||
                    (activeDropdown === 'bloodGroup' &&
                      bloodGroup === option)
                      ? {
                          color: COLORS.emeraldGreen,
                          fontWeight: '800',
                        }
                      : null,
                  ]}
                >
                  {option}
                </Text>

                {(activeDropdown === 'gender' && gender === option) ||
                (activeDropdown === 'bloodGroup' &&
                  bloodGroup === option) ? (
                  <Ionicons
                    name="checkmark-outline"
                    size={18}
                    color={COLORS.emeraldGreen}
                  />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  switchTrack: {
    width: 50,
    height: 26,
    borderRadius: 99,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 16,
  },
  profileHeroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  largeAvatarContainer: {
    position: 'relative',
  },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.emeraldGreen,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderNameText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  riderIdText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  vehicleTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  vehicleTypeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
  },
  inputGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    height: 52,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  uppercaseText: {
    textTransform: 'uppercase',
  },
  docUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  docUploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  docUploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  docPreviewImage: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    marginTop: 10,
    resizeMode: 'cover',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubtext: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  progressPercentage: {
    fontSize: 22,
    fontWeight: '900',
  },
  progressTrack: {
    height: 10,
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  missingBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  missingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  missingTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  missingDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#D97706',
    marginRight: 8,
  },
  missingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreMissingText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  editBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBankBtnText: {
    color: COLORS.emeraldGreen,
    fontWeight: '700',
    fontSize: 13,
  },
  saveBankBtn: {
    height: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBankBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  submitButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
  },
  supportAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  supportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    height: 52,
    borderRadius: 99,
    marginTop: 8,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 15,
  },
  appVersionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingBottom: 24,
  },
  appVersionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  skeletonContainer: {
    flex: 1,
  },
  skeletonHeader: {
    height: 80,
    borderBottomWidth: 1,
  },
  skeletonBody: {
    padding: 16,
  },
  skeletonCard: {
    height: 140,
    borderRadius: 24,
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.emeraldGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalCard: {
    width: '100%',
    maxHeight: 380,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
});