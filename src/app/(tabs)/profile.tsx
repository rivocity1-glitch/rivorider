// src/app/(tabs)/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { COLORS, useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

interface Rider {
  id: string;
  auth_user_id: string;
  rider_name: string;
  email: string;
  phone: string;
  rating: number;
  kyc_status: 'not_submitted' | 'pending' | 'verified' | 'rejected' | null;
  status?: 'active' | 'inactive';
  profile_photo_url?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  created_at?: string;
}

interface RiderProfile {
  id: string;
  rider_id: string;
  aadhaar_number?: string;
  aadhaar_front_url?: string;
  pan_number?: string;
  pan_card_url?: string;
  driving_license_number?: string;
  driving_license_url?: string;
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

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme, theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const themeToggleAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(20)).current;
  const logoutBtnScale = useRef(new Animated.Value(1)).current;

  const [selfieUrl, setSelfieUrl] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarUrl, setAadhaarUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panUrl, setPanUrl] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dlUrl, setDlUrl] = useState('');

  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideUpAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const animateButton = (scaleRef: Animated.Value, toVal: number) => {
    Animated.timing(scaleRef, { toValue: toVal, duration: 80, useNativeDriver: true }).start();
  };

  const normalizePhotoUrl = (url?: string) => {
    if (!url) return '';
    return url.replace('/rider-profiles/', '/avatars/');
  };

  const populateFields = (riderData: Rider, profileData: RiderProfile | null) => {
    setSelfieUrl(normalizePhotoUrl(riderData.profile_photo_url));
    if (profileData) {
      setAadhaarNumber(profileData.aadhaar_number || '');
      setAadhaarUrl(profileData.aadhaar_front_url || '');
      setPanNumber(profileData.pan_number || '');
      setPanUrl(profileData.pan_card_url || '');
      setDlNumber(profileData.driving_license_number || '');
      setDlUrl(profileData.driving_license_url || '');
      setAccountHolder(profileData.account_holder_name || riderData.account_holder_name || '');
      setBankName(profileData.bank_name || riderData.bank_name || '');
      setAccountNumber(profileData.account_number || riderData.account_number || '');
      setIfsc(profileData.ifsc_code || riderData.ifsc_code || '');
      setUpi(profileData.upi_id || riderData.upi_id || '');
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication failed or user not logged in.');

      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (riderError) throw riderError;

      const normalizedRider = {
        ...riderData,
        profile_photo_url: normalizePhotoUrl(riderData.profile_photo_url),
      };
      setRider(normalizedRider);

      const { data: profileData, error: profileError } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('rider_id', riderData.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      setProfile(profileData || null);
      populateFields(normalizedRider, profileData || null);
      startAnimations();
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureSelfie = async () => {
    try {
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPerm.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadSelfie(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const uploadSelfie = async (uri: string) => {
    if (!rider) return;
    try {
      setUploadingPhoto(true);

      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${rider.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: `image/${fileExt}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('riders')
        .update({ profile_photo_url: publicUrl })
        .eq('id', rider.id);

      if (updateError) throw updateError;

      setSelfieUrl(publicUrl);
      setRider({ ...rider, profile_photo_url: publicUrl });
      Alert.alert('Success', 'Selfie updated successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload selfie.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUploadDocument = (type: 'aadhaar' | 'pan' | 'dl') => {
    Alert.alert(
      'Upload Document',
      'Select camera or library to capture document',
      [
        { text: 'Take Photo', onPress: () => captureDocumentPhoto(type, ImagePicker.launchCameraAsync) },
        { text: 'Choose From Gallery', onPress: () => captureDocumentPhoto(type, ImagePicker.launchImageLibraryAsync) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const captureDocumentPhoto = async (type: 'aadhaar' | 'pan' | 'dl', launchFunc: Function) => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!camPerm.granted || !libPerm.granted) {
        Alert.alert('Permission Denied', 'Permissions are required.');
        return;
      }

      const result = await launchFunc({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadDocumentFile(type, result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'An error occurred picking document photo.');
    }
  };

  const uploadDocumentFile = async (type: 'aadhaar' | 'pan' | 'dl', uri: string) => {
    if (!rider) return;
    try {
      setUploadingDoc(type);

      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${type}-${rider.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('rider-documents')
        .upload(fileName, blob, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rider-documents')
        .getPublicUrl(fileName);

      if (type === 'aadhaar') setAadhaarUrl(publicUrl);
      if (type === 'pan') setPanUrl(publicUrl);
      if (type === 'dl') setDlUrl(publicUrl);

      Alert.alert('Success', 'Document photo uploaded successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload document.');
    } finally {
      setUploadingDoc(null);
    }
  };

  const isEvOrNonMotorized = ['ev', 'electric', 'bicycle', 'cycle', 'ev gearbike']
    .some(type => (rider?.vehicle_type || '').toLowerCase().includes(type));

  const handleSaveBankDetails = async () => {
    if (!rider) return;

    if (!accountHolder.trim()) return Alert.alert('Validation Error', 'Account Holder Name is required.');
    if (!bankName.trim()) return Alert.alert('Validation Error', 'Bank Name is required.');
    if (!accountNumber.trim()) return Alert.alert('Validation Error', 'Account Number is required.');
    if (!ifsc.trim()) return Alert.alert('Validation Error', 'IFSC Code is required.');

    try {
      setSavingBankDetails(true);

      const bankPayload = {
        account_holder_name: accountHolder.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifsc.trim().toUpperCase(),
        upi_id: upi.trim(),
      };

      const { error: profileErr } = await supabase
        .from('rider_profiles')
        .upsert({ rider_id: rider.id, ...bankPayload }, { onConflict: 'rider_id' });

      if (profileErr) throw profileErr;

      const { error: riderErr } = await supabase
        .from('riders')
        .update(bankPayload)
        .eq('id', rider.id);

      if (riderErr) throw riderErr;

      Alert.alert('Success', 'Bank details updated successfully.');
      setIsEditingBank(false);
      await fetchProfileData();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update bank details.');
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handleSubmitKYC = async () => {
    if (!rider) return;

    if (!selfieUrl) return Alert.alert('Missing Selfie', 'Capture a live profile selfie first.');
    if (!aadhaarNumber.trim()) return Alert.alert('Missing Details', 'Enter your Aadhaar number.');
    if (!aadhaarUrl) return Alert.alert('Missing Document', 'Upload your Aadhaar front photo.');
    if (!panNumber.trim()) return Alert.alert('Missing Details', 'Enter your PAN number.');
    if (!panUrl) return Alert.alert('Missing Document', 'Upload your PAN card photo.');

    if (!isEvOrNonMotorized) {
      if (!dlNumber.trim()) return Alert.alert('Missing Details', 'Driving Licence is required for petrol vehicles.');
      if (!dlUrl) return Alert.alert('Missing Document', 'Upload your Driving Licence photo.');
    }

    if (!accountHolder.trim()) return Alert.alert('Missing Details', 'Enter Account Holder Name.');
    if (!bankName.trim()) return Alert.alert('Missing Details', 'Enter Bank Name.');
    if (!accountNumber.trim()) return Alert.alert('Missing Details', 'Enter Account Number.');
    if (!ifsc.trim()) return Alert.alert('Missing Details', 'Enter Bank IFSC Code.');

    try {
      setSubmittingKyc(true);

      const profilePayload = {
        rider_id: rider.id,
        aadhaar_number: aadhaarNumber.trim(),
        aadhaar_front_url: aadhaarUrl,
        pan_number: panNumber.trim().toUpperCase(),
        pan_card_url: panUrl,
        driving_license_number: dlNumber.trim().toUpperCase(),
        driving_license_url: dlUrl,
        account_holder_name: accountHolder.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifsc.trim().toUpperCase(),
        upi_id: upi.trim(),
      };

      const { error: profileError } = await supabase
        .from('rider_profiles')
        .upsert(profilePayload, { onConflict: 'rider_id' });

      if (profileError) throw profileError;

      const { error: riderError } = await supabase
        .from('riders')
        .update({ kyc_status: 'pending', status: 'inactive' })
        .eq('id', rider.id);

      if (riderError) throw riderError;

      setRider({ ...rider, kyc_status: 'pending', status: 'inactive' });
      Alert.alert('Submission Successful', 'Your KYC has been submitted for review.');
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not submit verification documents.');
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

  const handleOpenEmail = () => Linking.openURL('mailto:rivocityhelp1@gmail.com');

  if (loading) {
    return (
      <View style={[styles.skeletonContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.headerBg} />
        <View style={[styles.skeletonHeader, { backgroundColor: theme.cardBg, borderColor: theme.border }]} />
        <ScrollView style={styles.skeletonBody} showsVerticalScrollIndicator={false}>
          <View style={[styles.skeletonCard, { backgroundColor: theme.cardBg }]} />
          <View style={[styles.skeletonCard, { backgroundColor: theme.cardBg }]} />
        </ScrollView>
      </View>
    );
  }

  if (error || !rider) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Oops! Something went wrong</Text>
        <Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error || 'Failed to fetch profile.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfileData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kycStatus = rider.kyc_status || 'not_submitted';
  const isEditable = kycStatus === 'not_submitted' || kycStatus === 'rejected';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.headerBg} />
      
      {/* HEADER WITH MASTER APP THEME SWITCH */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile & KYC</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={toggleTheme} style={[styles.switchTrack, { backgroundColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
            <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]}>
              <Ionicons name={isDarkMode ? "moon-outline" : "sunny-outline"} size={12} color={COLORS.jetBlack} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          
          {/* PROFILE PHOTO CARD */}
          <View style={[styles.profileHeroCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.largeAvatarContainer}
                onPress={handleCaptureSelfie}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {selfieUrl ? (
                  <Image source={{ uri: selfieUrl }} style={styles.largeAvatar} />
                ) : (
                  <View style={[styles.largeAvatar, styles.avatarPlaceholder, { backgroundColor: theme.bg }]}>
                    <Ionicons name="camera-outline" size={40} color={theme.textMuted} />
                  </View>
                )}
                {uploadingPhoto && (
                  <View style={styles.avatarLoaderLayer}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={14} color="#ffffff" />
                </View>
              </TouchableOpacity>

              <Text style={[styles.riderNameText, { color: theme.text, marginTop: 12 }]}>{rider.rider_name || 'Rivo Rider'}</Text>
              <Text style={[styles.riderIdText, { color: theme.textMuted }]}>ID: {rider.id ? `RDR-${rider.id.substring(0, 6).toUpperCase()}` : 'N/A'}</Text>
              
              {rider.vehicle_type ? (
                <View style={[styles.vehicleTypeBadge, { backgroundColor: COLORS.emeraldGreen + '15', borderColor: COLORS.emeraldGreen }]}>
                  <Ionicons name="bicycle-outline" size={12} color={COLORS.emeraldGreen} style={{ marginRight: 4 }} />
                  <Text style={[styles.vehicleTypeText, { color: COLORS.emeraldGreen }]}>{rider.vehicle_type}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* KYC STATUS CARDS */}
          {kycStatus === 'pending' && (
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#272314' : '#FEF3C7', borderColor: isDarkMode ? '#453507' : '#FDE68A' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={22} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, color: '#B45309' }]}>Documents Under Review</Text>
              </View>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#FCD34D' : '#92400E', lineHeight: 20 }]}>
                Your documents are under review. You cannot receive deliveries until verification is complete.
              </Text>
            </View>
          )}

          {kycStatus === 'rejected' && (
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#3B1212' : '#FEE2E2', borderColor: isDarkMode ? '#6B1D1D' : '#FCA5A5' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="close-circle-outline" size={22} color={COLORS.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, color: '#B91C1C' }]}>Verification Rejected</Text>
              </View>
              <Text style={[styles.infoLabel, { color: '#B91C1C', lineHeight: 20, marginBottom: 8 }]}>
                Reason: {profile?.rejection_reason || 'Document proofs were unreadable or mismatched.'}
              </Text>
              <Text style={[styles.infoLabel, { color: '#7F1D1D', fontSize: 12 }]}>
                Please update details below and resubmit.
              </Text>
            </View>
          )}

          {kycStatus === 'verified' && (
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#062E20' : '#DCFCE7', borderColor: isDarkMode ? '#044E34' : '#A7F3D0' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, color: '#047857' }]}>Account Verified</Text>
              </View>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#A7F3D0' : '#065F46', lineHeight: 20 }]}>
                Your account has been verified successfully.
              </Text>
            </View>
          )}

          {/* IDENTITY VERIFICATION CARD */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Identity Verification</Text>
            </View>

            {/* Aadhaar */}
            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Aadhaar Card</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="card-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
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
            <View style={styles.docUploadRow}>
              <TouchableOpacity
                style={[styles.docUploadBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                onPress={() => handleUploadDocument('aadhaar')}
                disabled={!isEditable || uploadingDoc === 'aadhaar'}
              >
                {uploadingDoc === 'aadhaar' ? (
                  <ActivityIndicator size="small" color={COLORS.emeraldGreen} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color={COLORS.emeraldGreen} style={{ marginRight: 6 }} />
                    <Text style={[styles.docUploadBtnText, { color: COLORS.emeraldGreen }]}>
                      {aadhaarUrl ? 'Re-upload Aadhaar Front' : 'Upload Aadhaar Front'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {aadhaarUrl ? <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.emeraldGreen} style={{ marginLeft: 8 }} /> : null}
            </View>
            {aadhaarUrl ? <Image source={{ uri: aadhaarUrl }} style={styles.docPreviewImage} /> : null}

            <View style={[styles.infoDivider, { backgroundColor: theme.border, marginVertical: 16 }]} />

            {/* PAN Card */}
            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>PAN Card</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.uppercaseText, { color: theme.text }]}
                placeholder="Enter 10-digit PAN Number"
                placeholderTextColor={theme.textMuted}
                maxLength={10}
                autoCapitalize="characters"
                value={panNumber}
                onChangeText={setPanNumber}
                editable={isEditable}
              />
            </View>
            <View style={styles.docUploadRow}>
              <TouchableOpacity
                style={[styles.docUploadBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                onPress={() => handleUploadDocument('pan')}
                disabled={!isEditable || uploadingDoc === 'pan'}
              >
                {uploadingDoc === 'pan' ? (
                  <ActivityIndicator size="small" color={COLORS.emeraldGreen} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color={COLORS.emeraldGreen} style={{ marginRight: 6 }} />
                    <Text style={[styles.docUploadBtnText, { color: COLORS.emeraldGreen }]}>
                      {panUrl ? 'Re-upload PAN Card' : 'Upload PAN Card'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {panUrl ? <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.emeraldGreen} style={{ marginLeft: 8 }} /> : null}
            </View>
            {panUrl ? <Image source={{ uri: panUrl }} style={styles.docPreviewImage} /> : null}

            <View style={[styles.infoDivider, { backgroundColor: theme.border, marginVertical: 16 }]} />

            {/* Driving License */}
            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>
              Driving Licence {isEvOrNonMotorized ? '(Optional for EV / Cycle)' : '(Required)'}
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="car-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.uppercaseText, { color: theme.text }]}
                placeholder={isEvOrNonMotorized ? "Driving Licence Number (Optional)" : "Enter Driving Licence Number"}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                value={dlNumber}
                onChangeText={setDlNumber}
                editable={isEditable}
              />
            </View>
            <View style={styles.docUploadRow}>
              <TouchableOpacity
                style={[styles.docUploadBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                onPress={() => handleUploadDocument('dl')}
                disabled={!isEditable || uploadingDoc === 'dl'}
              >
                {uploadingDoc === 'dl' ? (
                  <ActivityIndicator size="small" color={COLORS.emeraldGreen} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color={COLORS.emeraldGreen} style={{ marginRight: 6 }} />
                    <Text style={[styles.docUploadBtnText, { color: COLORS.emeraldGreen }]}>
                      {dlUrl ? 'Re-upload Driving Licence' : isEvOrNonMotorized ? 'Upload Driving Licence (Optional)' : 'Upload Driving Licence'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {dlUrl ? <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.emeraldGreen} style={{ marginLeft: 8 }} /> : null}
            </View>
            {dlUrl ? <Image source={{ uri: dlUrl }} style={styles.docPreviewImage} /> : null}
          </View>

          {/* BANK DETAILS CARD */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={styles.cardHeader}>
                <Ionicons name="wallet-outline" size={18} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Bank Details</Text>
              </View>
              <TouchableOpacity 
                style={styles.editBankBtn} 
                onPress={() => setIsEditingBank(!isEditingBank)}
              >
                <Ionicons name={isEditingBank ? "close-outline" : "create-outline"} size={16} color={COLORS.emeraldGreen} />
                <Text style={styles.editBankBtnText}>{isEditingBank ? 'Cancel' : 'Edit Bank Details'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Account Holder Name</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Name as per bank records"
                placeholderTextColor={theme.textMuted}
                value={accountHolder}
                onChangeText={setAccountHolder}
                editable={isEditingBank || isEditable}
              />
            </View>

            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Bank Name</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="business-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="e.g. HDFC Bank"
                placeholderTextColor={theme.textMuted}
                value={bankName}
                onChangeText={setBankName}
                editable={isEditingBank || isEditable}
              />
            </View>

            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Account Number</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="card-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Bank Account Number"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                value={accountNumber}
                onChangeText={setAccountNumber}
                editable={isEditingBank || isEditable}
              />
            </View>

            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>IFSC Code</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="git-branch-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.uppercaseText, { color: theme.text }]}
                placeholder="11-character IFSC Code"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                maxLength={11}
                value={ifsc}
                onChangeText={setIfsc}
                editable={isEditingBank || isEditable}
              />
            </View>

            <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>UPI ID (Optional)</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Ionicons name="qr-code-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="e.g. mobile@upi"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                value={upi}
                onChangeText={setUpi}
                editable={isEditingBank || isEditable}
              />
            </View>

            {isEditingBank && (
              <TouchableOpacity
                style={[styles.saveBankBtn, { backgroundColor: COLORS.emeraldGreen }]}
                onPress={handleSaveBankDetails}
                disabled={savingBankDetails}
                activeOpacity={0.8}
              >
                {savingBankDetails ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBankBtnText}>Save Bank Details</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* SUBMIT KYC BUTTON */}
          {isEditable && (
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: COLORS.emeraldGreen }]}
              onPress={handleSubmitKYC}
              disabled={submittingKyc}
              activeOpacity={0.8}
            >
              {submittingKyc ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit for Verification</Text>
              )}
            </TouchableOpacity>
          )}

          {/* SUPPORT CARD */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, marginTop: 4 }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="help-circle-outline" size={17} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Support</Text>
            </View>
            
            <TouchableOpacity style={styles.supportAction} onPress={handleOpenEmail} activeOpacity={0.7}>
              <View style={styles.supportLeft}>
                <Ionicons name="mail-outline" size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.supportText, { color: theme.text }]}>Email Support</Text>
              </View>
              <Text style={[styles.supportSubText, { color: theme.textMuted }]}>rivocityhelp1@gmail.com</Text>
            </TouchableOpacity>
          </View>

          {/* LOGOUT BUTTON */}
          <Animated.View style={{ transform: [{ scale: logoutBtnScale }] }}>
            <TouchableOpacity 
              style={[styles.logoutButton, { borderColor: COLORS.danger + '30' }]} 
              onPress={handleLogout} 
              onPressIn={() => animateButton(logoutBtnScale, 0.96)}
              onPressOut={() => animateButton(logoutBtnScale, 1)}
              activeOpacity={0.9}
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </Animated.View>
          
          <View style={styles.appVersionContainer}>
            <Text style={[styles.appVersionText, { color: theme.textMuted }]}>Version 2.4.0</Text>
          </View>
        </Animated.View>
      </ScrollView>
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
  avatarLoaderLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.emeraldGreen,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
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
    height: 140,
    borderRadius: 16,
    marginTop: 10,
    resizeMode: 'cover',
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
    height: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
  supportSubText: {
    fontSize: 13,
    fontWeight: '500',
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
});