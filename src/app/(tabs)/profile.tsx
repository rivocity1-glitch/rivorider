import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  // Animations
  const themeToggleAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(20)).current;

  // Staged / Local KYC State
  const [selfieUri, setSelfieUri] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFrontUri, setAadhaarFrontUri] = useState('');
  const [aadhaarBackUri, setAadhaarBackUri] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panUri, setPanUri] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseUri, setDrivingLicenseUri] = useState('');

  // Bank & QR
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');
  const [qrCodeUri, setQrCodeUri] = useState('');

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

  const populateFields = (
    riderData: Rider,
    profileData: RiderProfile | null
  ) => {
    setSelfieUri(
      riderData.selfie_photo_url || profileData?.selfie_photo_url || ''
    );
    setQrCodeUri(riderData.qr_code_url || '');

    if (!profileData) return;

    setAadhaarNumber(profileData.aadhaar_number || '');
    setAadhaarFrontUri(profileData.aadhaar_front_url || '');
    setAadhaarBackUri(profileData.aadhaar_back_url || '');
    setPanNumber(profileData.pan_number || '');
    setPanUri(profileData.pan_card_url || '');
    setDrivingLicenseNumber(profileData.driving_license_number || '');
    setDrivingLicenseUri(profileData.driving_license_url || '');

    setAccountHolder(
      profileData.account_holder_name || riderData.account_holder_name || ''
    );
    setBankName(profileData.bank_name || riderData.bank_name || '');
    setAccountNumber(
      profileData.account_number || riderData.account_number || ''
    );
    setIfsc(profileData.ifsc_code || riderData.ifsc_code || '');
    setUpi(profileData.upi_id || riderData.upi_id || '');
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
        throw new Error('User not logged in');
      }

      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (riderError) throw riderError;

      setRider(riderData);

      const { data: profileData, error: profileError } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('rider_id', riderData.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(profileData || null);
      populateFields(riderData, profileData || null);
      startAnimations();
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeSelfie = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Denied',
          'Camera access is required to take your selfie.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setSelfieUri(result.assets[0].uri);
      Alert.alert(
        'Selfie Selected',
        'Your selfie has been selected. It will be uploaded when you submit your KYC.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to capture selfie.');
    }
  };

  const handlePickDocument = async (type: KycDocType) => {
    Alert.alert('Select Document', 'Choose source', [
      {
        text: 'Camera',
        onPress: () => selectImage(type, 'camera'),
      },
      {
        text: 'Gallery',
        onPress: () => selectImage(type, 'gallery'),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
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

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;

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
    } catch {
      Alert.alert('Error', 'Unable to select document image.');
    }
  };

  const uploadToStorage = async (
    fileName: string,
    uri: string
  ): Promise<string> => {
    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send();
    });

    const { error: uploadError } = await supabase.storage
      .from('rider-documents')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('rider-documents')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const uploadIfNeeded = async (uri: string, prefix: string) => {
    if (!uri) return null;
    if (uri.startsWith('http')) return uri;

    return uploadToStorage(
      `${prefix}-${rider?.id}-${Date.now()}.jpg`,
      uri
    );
  };

  const handleSubmitKYC = async () => {
    if (!rider) return;

    if (!selfieUri) {
      Alert.alert('Missing Selfie', 'Please take your selfie first.');
      return;
    }

    if (aadhaarNumber.trim().length !== 12) {
      Alert.alert(
        'Invalid Aadhaar',
        'Please provide a valid 12-digit Aadhaar number.'
      );
      return;
    }

    if (!aadhaarFrontUri) {
      Alert.alert(
        'Missing Document',
        'Please select the Aadhaar front document.'
      );
      return;
    }

    if (!aadhaarBackUri) {
      Alert.alert(
        'Missing Document',
        'Please select the Aadhaar back document.'
      );
      return;
    }

    if (panNumber.trim().length !== 10) {
      Alert.alert(
        'Invalid PAN',
        'Please provide a valid 10-character PAN number.'
      );
      return;
    }

    if (!panUri) {
      Alert.alert('Missing Document', 'Please select the PAN card document.');
      return;
    }

    // License check only enforced if NOT EV or non-motorized
    if (!isEvOrNonMotorized) {
      if (!drivingLicenseNumber.trim()) {
        Alert.alert(
          'Missing Driving Licence',
          'Please enter your driving licence number.'
        );
        return;
      }

      if (!drivingLicenseUri) {
        Alert.alert(
          'Missing Document',
          'Please select your driving licence document.'
        );
        return;
      }
    }

    if (
      !accountHolder.trim() ||
      !bankName.trim() ||
      !accountNumber.trim() ||
      ifsc.trim().length !== 11
    ) {
      Alert.alert(
        'Missing Bank Details',
        'Please complete all required bank information.'
      );
      return;
    }

    try {
      setSubmittingKyc(true);

      const [
        finalSelfie,
        finalAadhaarFront,
        finalAadhaarBack,
        finalPan,
        finalDrivingLicense,
        finalQrCode,
      ] = await Promise.all([
        uploadIfNeeded(selfieUri, 'selfie'),
        uploadIfNeeded(aadhaarFrontUri, 'aadhaar_front'),
        uploadIfNeeded(aadhaarBackUri, 'aadhaar_back'),
        uploadIfNeeded(panUri, 'pan_card'),
        uploadIfNeeded(drivingLicenseUri, 'driving_license'),
        uploadIfNeeded(qrCodeUri, 'qr_code'),
      ]);

      const now = new Date().toISOString();

      const { error: riderError } = await supabase
        .from('riders')
        .update({
          kyc_status: 'pending',
          selfie_photo_url: finalSelfie,
          selfie_uploaded_at: now,
          account_holder_name: accountHolder.trim(),
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          ifsc_code: ifsc.trim().toUpperCase(),
          upi_id: upi.trim() || null,
          qr_code_url: finalQrCode || null,
          documents_updated_at: now,
        })
        .eq('id', rider.id);

      if (riderError) throw riderError;

      const { error: profileError } = await supabase
        .from('rider_profiles')
        .upsert(
          {
            rider_id: rider.id,
            aadhaar_number: aadhaarNumber.trim(),
            aadhaar_front_url: finalAadhaarFront,
            aadhaar_back_url: finalAadhaarBack,
            pan_number: panNumber.trim().toUpperCase(),
            pan_card_url: finalPan,
            driving_license_number:
              drivingLicenseNumber.trim().toUpperCase() || null,
            driving_license_url: finalDrivingLicense || null,
            selfie_photo_url: finalSelfie,
            account_holder_name: accountHolder.trim(),
            bank_name: bankName.trim(),
            account_number: accountNumber.trim(),
            ifsc_code: ifsc.trim().toUpperCase(),
            upi_id: upi.trim() || null,
            kyc_status: 'pending',
            documents_updated_at: now,
          },
          {
            onConflict: 'rider_id',
          }
        );

      if (profileError) throw profileError;

      setIsKycModalOpen(false);
      await fetchProfileData();

      Alert.alert(
        'KYC Submitted',
        'Your KYC documents have been submitted to the admin team for verification.'
      );
    } catch (err: any) {
      Alert.alert(
        'Submission Error',
        err?.message || 'Could not submit KYC details.'
      );
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  const renderDocPickerButton = (
    title: string,
    uri: string,
    type: KycDocType,
    optional = false
  ) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>
        {title} {optional ? '(Optional)' : '*'}
      </Text>

      <TouchableOpacity
        style={[
          styles.docUploadBtn,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
        onPress={() => handlePickDocument(type)}
      >
        <Ionicons
          name={uri ? 'checkmark-circle' : 'document-attach-outline'}
          size={18}
          color={uri ? COLORS.emeraldGreen : theme.textMuted}
          style={{ marginRight: 6 }}
        />

        <Text
          style={[
            styles.docUploadBtnText,
            {
              color: uri ? COLORS.emeraldGreen : theme.text,
            },
          ]}
        >
          {uri ? 'Change Selected Document' : `Select ${title}`}
        </Text>
      </TouchableOpacity>

      {uri ? (
        <Image source={{ uri }} style={styles.docPreviewImage} />
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View
        style={[styles.centeredContainer, { backgroundColor: theme.bg }]}
      >
        <ActivityIndicator size="large" color={COLORS.emeraldGreen} />
      </View>
    );
  }

  if (error || !rider) {
    return (
      <View
        style={[styles.centeredContainer, { backgroundColor: theme.bg }]}
      >
        <Ionicons name="alert-circle-outline" size={60} color={COLORS.danger} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>
          Failed to load profile
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfileData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kycStatus = rider.kyc_status || 'not_submitted';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.headerBg}
      />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.headerBg, borderColor: theme.border },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Profile
          </Text>

          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.switchTrack,
              { backgroundColor: isDarkMode ? '#333' : '#E0E0E0' },
            ]}
          >
            <Animated.View
              style={[styles.switchThumb, { transform: [{ translateX }] }]}
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

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Animated.View
          style={[
            styles.body,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          {/* PROFILE / SELFIE */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
                alignItems: 'center',
              },
            ]}
          >
            <View style={styles.largeAvatarContainer}>
              {selfieUri ? (
                <Image
                  source={{ uri: selfieUri }}
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
                    name="person-outline"
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
              {rider.rider_name || 'Rider'}
            </Text>

            <Text style={[styles.riderIdText, { color: theme.textMuted }]}>
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

            <TouchableOpacity
              style={[
                styles.selfieBtn,
                { backgroundColor: COLORS.emeraldGreen },
              ]}
              onPress={handleTakeSelfie}
              disabled={uploadingSelfie}
            >
              {uploadingSelfie ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="camera-reverse-outline"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.selfieBtnText}>
                    {selfieUri ? 'Retake Selfie' : 'Take Selfie'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text
              style={{
                color: theme.textMuted,
                fontSize: 11,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 16,
              }}
            >
              Selfie will be submitted with your KYC.
            </Text>
          </View>

          {/* KYC STATUS */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              KYC Verification
            </Text>

            <Text
              style={[
                styles.infoLabel,
                {
                  color: theme.textMuted,
                  marginVertical: 8,
                },
              ]}
            >
              Status:{' '}
              <Text
                style={{
                  fontWeight: '700',
                  textTransform: 'capitalize',
                }}
              >
                {kycStatus.replace('_', ' ')}
              </Text>
            </Text>

            {kycStatus === 'rejected' && profile?.rejection_reason && (
              <Text style={{ color: COLORS.danger, marginBottom: 8 }}>
                Reason: {profile.rejection_reason}
              </Text>
            )}

            {kycStatus !== 'verified' && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: COLORS.emeraldGreen,
                    marginTop: 6,
                  },
                ]}
                onPress={() => setIsKycModalOpen(true)}
              >
                <Text style={styles.submitButtonText}>
                  {kycStatus === 'pending'
                    ? 'Edit & Resubmit KYC'
                    : 'Complete KYC'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* LOGOUT */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons
              name="log-out-outline"
              size={18}
              color={COLORS.danger}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* KYC MODAL */}
      <Modal
        visible={isKycModalOpen}
        animationType="slide"
        onRequestClose={() => setIsKycModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          {/* MODAL HEADER */}
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
              <Text
                style={[
                  styles.headerTitle,
                  { color: theme.text, fontSize: 20 },
                ]}
              >
                Complete KYC
              </Text>

              <TouchableOpacity onPress={() => setIsKycModalOpen(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 40,
            }}
          >
            {/* SELFIE SECTION */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.text, marginBottom: 8 },
                ]}
              >
                Selfie Verification *
              </Text>

              <Text
                style={{
                  color: theme.textMuted,
                  fontSize: 12,
                  lineHeight: 18,
                  marginBottom: 12,
                }}
              >
                Take a clear selfie using the front camera. Selected images are uploaded only when you press submit.
              </Text>

              {selfieUri ? (
                <Image
                  source={{ uri: selfieUri }}
                  style={[
                    styles.selfiePreview,
                    { borderColor: COLORS.emeraldGreen },
                  ]}
                />
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: COLORS.emeraldGreen },
                ]}
                onPress={handleTakeSelfie}
              >
                <Ionicons
                  name="camera-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.submitButtonText}>
                  {selfieUri ? 'Retake Selfie' : 'Take Selfie'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* IDENTITY DOCUMENTS */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.text, marginBottom: 12 },
                ]}
              >
                Identity Documents
              </Text>

              {/* Aadhaar */}
              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                Aadhaar Number *
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="12-digit Aadhaar Number"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={12}
                value={aadhaarNumber}
                onChangeText={(value) =>
                  setAadhaarNumber(
                    value.replace(/[^0-9]/g, '').slice(0, 12)
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
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                PAN Number *
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  styles.uppercaseText,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="10-character PAN"
                placeholderTextColor={theme.textMuted}
                maxLength={10}
                autoCapitalize="characters"
                value={panNumber}
                onChangeText={(value) =>
                  setPanNumber(
                    value
                      .replace(/[^a-zA-Z0-9]/g, '')
                      .toUpperCase()
                      .slice(0, 10)
                  )
                }
              />

              {renderDocPickerButton('PAN Card', panUri, 'pan')}

              {/* DRIVING LICENCE (OPTIONAL FOR EV) */}
              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                Driving Licence Number{' '}
                {isEvOrNonMotorized ? '(Optional for EV)' : '*'}
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  styles.uppercaseText,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder={
                  isEvOrNonMotorized
                    ? 'Driving licence number (Optional)'
                    : 'Enter driving licence number'
                }
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                value={drivingLicenseNumber}
                onChangeText={(value) =>
                  setDrivingLicenseNumber(value.toUpperCase())
                }
              />

              {renderDocPickerButton(
                'Driving Licence',
                drivingLicenseUri,
                'driving_license',
                isEvOrNonMotorized
              )}
            </View>

            {/* BANK DETAILS & QR */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.text, marginBottom: 12 },
                ]}
              >
                Bank & Payment Details
              </Text>

              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                Account Holder Name *
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Holder name"
                placeholderTextColor={theme.textMuted}
                value={accountHolder}
                onChangeText={setAccountHolder}
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                Bank Name *
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Bank name"
                placeholderTextColor={theme.textMuted}
                value={bankName}
                onChangeText={setBankName}
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                Account Number *
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Bank account number"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                value={accountNumber}
                onChangeText={setAccountNumber}
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                IFSC Code *
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  styles.uppercaseText,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="11-character IFSC Code"
                placeholderTextColor={theme.textMuted}
                maxLength={11}
                autoCapitalize="characters"
                value={ifsc}
                onChangeText={(value) =>
                  setIfsc(
                    value
                      .replace(/[^a-zA-Z0-9]/g, '')
                      .toUpperCase()
                      .slice(0, 11)
                  )
                }
              />

              <Text
                style={[
                  styles.inputGroupLabel,
                  { color: theme.textMuted },
                ]}
              >
                UPI ID (Optional)
              </Text>
              <TextInput
                style={[
                  styles.inputContainer,
                  styles.input,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="example@upi"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                value={upi}
                onChangeText={setUpi}
              />

              {renderDocPickerButton(
                'Payment QR Code',
                qrCodeUri,
                'qr_code',
                true
              )}
            </View>

            {/* SUBMIT INFO */}
            <View
              style={[
                styles.submitInfoBox,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={COLORS.emeraldGreen}
              />
              <Text
                style={{
                  flex: 1,
                  color: theme.textMuted,
                  fontSize: 12,
                  lineHeight: 18,
                  marginLeft: 10,
                }}
              >
                Your selected documents remain on your device until you press Submit KYC to Admin.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: COLORS.emeraldGreen },
              ]}
              onPress={handleSubmitKYC}
              disabled={submittingKyc}
            >
              {submittingKyc ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Submit KYC to Admin
                </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '700',
  },
  largeAvatarContainer: {
    position: 'relative',
  },
  largeAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: COLORS.emeraldGreen,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderNameText: {
    fontSize: 18,
    fontWeight: '700',
  },
  riderIdText: {
    fontSize: 13,
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
  selfieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
    marginTop: 12,
  },
  selfieBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  selfiePreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  inputGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    fontWeight: '600',
  },
  uppercaseText: {
    textTransform: 'uppercase',
  },
  docUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  docUploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  docPreviewImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 8,
    resizeMode: 'cover',
  },
  submitInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  submitButton: {
    height: 50,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    flexDirection: 'row',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    height: 48,
    borderRadius: 99,
    marginTop: 8,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 12,
  },
  retryButton: {
    backgroundColor: COLORS.emeraldGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
  },
  retryText: {
    color: '#fff',
  },
});