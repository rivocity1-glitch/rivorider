// src/app/(tabs)/profile.tsx
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
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
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const COLORS = {
  emeraldGreen: '#10B981',
  limeGreen: '#10B981',
  jetBlack: '#0B0F19',
  white: '#FFFFFF',
  offWhite: '#F3F4F6',
  borderLight: '#E5E7EB',
  textMuted: '#6B7280',
  danger: '#EF4444',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  // Dark mode specialized values
  darkCard: '#1F2937',
  darkBorder: '#374151',
  darkMuted: '#9CA3AF',
};

interface Rider {
  id: string;
  auth_user_id: string;
  rider_name: string;
  email: string;
  phone: string;
  rating: number;
  kyc_status: 'not_submitted' | 'pending' | 'verified' | 'rejected' | null;
  profile_photo_url?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  verification_notes?: string;
  documents_updated_at?: string;
  created_at?: string;
}

interface RiderProfile {
  id: string;
  rider_id: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  emergency_contact?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Theme Sync System
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const themeToggleAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(20)).current;
  const editBtnScale = useRef(new Animated.Value(1)).current;
  const logoutBtnScale = useRef(new Animated.Value(1)).current;

  // Form states for editing
  const [formPhone, setFormPhone] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');
  const [formAccountHolder, setFormAccountHolder] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formIfsc, setFormIfsc] = useState('');
  const [formUpi, setFormUpi] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formStateName, setFormStateName] = useState('');
  const [formPinCode, setFormPinCode] = useState('');
  const [formEmergencyContact, setFormEmergencyContact] = useState('');

  const theme = {
    bg: isDarkMode ? COLORS.jetBlack : COLORS.offWhite,
    cardBg: isDarkMode ? COLORS.darkCard : COLORS.white,
    text: isDarkMode ? COLORS.white : COLORS.jetBlack,
    textMuted: isDarkMode ? COLORS.darkMuted : COLORS.textMuted,
    border: isDarkMode ? COLORS.darkBorder : COLORS.borderLight,
    headerBg: isDarkMode ? COLORS.darkCard : COLORS.white,
  };

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

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

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

  const animateButton = (scaleRef: Animated.Value, toVal: number) => {
    Animated.timing(scaleRef, {
      toValue: toVal,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const populateFormFields = (riderData: Rider, profileData: RiderProfile | null) => {
    setFormPhone(riderData.phone || '');
    setFormVehicleNumber(riderData.vehicle_number || '');
    setFormAccountHolder(riderData.account_holder_name || '');
    setFormBankName(riderData.bank_name || '');
    setFormAccountNumber(riderData.account_number || '');
    setFormIfsc(riderData.ifsc_code || '');
    setFormUpi(riderData.upi_id || '');
    setFormAddress(profileData?.address || '');
    setFormCity(profileData?.city || '');
    setFormStateName(profileData?.state || '');
    setFormPinCode(profileData?.pin_code || '');
    setFormEmergencyContact(profileData?.emergency_contact || '');
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
      setRider(riderData);

      const { data: profileData, error: profileError } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('rider_id', riderData.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
        populateFormFields(riderData, profileData);
      } else {
        const defaultProfile: RiderProfile = {
          id: '',
          rider_id: riderData.id,
        };
        setProfile(defaultProfile);
        populateFormFields(riderData, defaultProfile);
      }

      startAnimations();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while loading profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = () => {
    if (rider) {
      populateFormFields(rider, profile);
    }
    setEditModalVisible(true);
  };

  const handleUpdateProfile = async () => {
    if (!rider || !profile) return;
    try {
      setUpdating(true);

      const { error: riderUpdateError } = await supabase
        .from('riders')
        .update({
          phone: formPhone,
          vehicle_number: formVehicleNumber,
          account_holder_name: formAccountHolder,
          bank_name: formBankName,
          account_number: formAccountNumber,
          ifsc_code: formIfsc,
          upi_id: formUpi,
        })
        .eq('id', rider.id);

      if (riderUpdateError) throw riderUpdateError;

      const profileUpdates = {
        address: formAddress,
        city: formCity,
        state: formStateName,
        pin_code: formPinCode,
        emergency_contact: formEmergencyContact,
      };

      const { error: profileUpdateError } = await supabase
        .from('rider_profiles')
        .upsert({
          rider_id: rider.id,
          ...profileUpdates,
        }, { onConflict: 'rider_id' });

      if (profileUpdateError) throw profileUpdateError;

      const updatedRider = {
        ...rider,
        phone: formPhone,
        vehicle_number: formVehicleNumber,
        account_holder_name: formAccountHolder,
        bank_name: formBankName,
        account_number: formAccountNumber,
        ifsc_code: formIfsc,
        upi_id: formUpi,
      };
      const updatedProfile = { ...profile, ...profileUpdates };
      
      setRider(updatedRider);
      setProfile(updatedProfile);
      populateFormFields(updatedRider, updatedProfile);
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update details.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAvatarPress = async () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option to update profile picture',
      [
        { text: 'Take Photo', onPress: () => pickImage(ImagePicker.launchCameraAsync) },
        { text: 'Choose From Gallery', onPress: () => pickImage(ImagePicker.launchImageLibraryAsync) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const pickImage = async (launchFunction: Function) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const cameraPermissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted || !cameraPermissionResult.granted) {
        Alert.alert('Permission Denied', 'Permissions are required to access library or camera.');
        return;
      }

      const result = await launchFunction({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during image sourcing selection.');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!rider) return;
    try {
      setUploadingPhoto(true);

      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function (e) {
          reject(new TypeError('Network request failed'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${rider.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('rider-profiles')
        .upload(filePath, blob, { contentType: 'image/' + fileExt });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rider-profiles')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('riders')
        .update({ profile_photo_url: publicUrl })
        .eq('id', rider.id);

      if (updateError) throw updateError;

      setRider({ ...rider, profile_photo_url: publicUrl });
      Alert.alert('Success', 'Profile photo updated successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload photo image.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
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
      ],
      { cancelable: true }
    );
  };

  const maskAccount = (num?: string) => {
    if (!num) return 'Not Added';
    if (num.length < 4) return 'XXXX' + num;
    return `XXXX XXXX ${num.slice(-4)}`;
  };

  const getKycBadge = (status: string | null) => {
    switch (status) {
      case 'verified':
        return { label: 'Verified', color: '#10B981', icon: 'checkmark-circle' };
      case 'pending':
        return { label: 'Verification in Progress', color: '#F59E0B', icon: 'time' };
      case 'rejected':
        return { label: 'Rejected', color: '#EF4444', icon: 'close-circle' };
      default:
        return { label: 'Not Submitted', color: '#6B7280', icon: 'alert-circle' };
    }
  };

  const handleOpenEmail = () => {
    Linking.openURL('mailto:rivo.city1@gmail.com');
  };

  const handleOpenWhatsApp = () => {
    Alert.alert('Support', 'Redirecting to Rivo WhatsApp Support workspace...');
  };

  const formatJoinedDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const dateObj = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `Joined Rivo • ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    } catch (e) {
      return '';
    }
  };

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={[styles.skeletonContainer, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.headerBg} />
        <View style={[styles.skeletonHeader, { backgroundColor: theme.cardBg, borderColor: theme.border }]} />
        <ScrollView style={styles.skeletonBody} showsVerticalScrollIndicator={false}>
          <View style={[styles.skeletonCard, { backgroundColor: theme.cardBg }]} />
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
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Oops! Something went wrong</Text>
        <Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error || 'Failed to fetch rider account profile.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProfileData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kyc = getKycBadge(rider.kyc_status);
  const currentStatus = rider.kyc_status || 'not_submitted';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.headerBg} />
      
      {/* HEADER SECTION */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          </View>
          <TouchableOpacity activeOpacity={0.9} onPress={toggleTheme} style={[styles.switchTrack, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
            <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]}>
              <Text style={{ fontSize: 11, textAlign: 'center' }}>{isDarkMode ? '🌙' : '☀️'}</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          
          {/* PROFILE HERO CARD */}
          <View style={[styles.profileHeroCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarPress} activeOpacity={0.8}>
                {rider.profile_photo_url ? (
                  <Image source={{ uri: rider.profile_photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.bg }]}>
                    <Ionicons name="person" size={32} color={theme.textMuted} />
                  </View>
                )}
                {uploadingPhoto && (
                  <View style={styles.avatarLoaderLayer}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={12} color="#ffffff" />
                </View>
              </TouchableOpacity>

              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={[styles.riderNameText, { color: theme.text }]}>{rider.rider_name || 'Rivo Rider'}</Text>
                <Text style={[styles.riderIdText, { color: theme.textMuted }]}>ID: {rider.id ? `RDR-${rider.id.substring(0, 6).toUpperCase()}` : 'Not Available'}</Text>
                {rider.created_at ? (
                  <Text style={[styles.joinedText, { color: theme.textMuted }]}>{formatJoinedDate(rider.created_at)}</Text>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={[styles.ratingBadge, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                    <FontAwesome name="star" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text style={[styles.ratingText, { color: theme.text }]}>
                      {rider.rating && rider.rating > 0 ? rider.rating.toFixed(1) : '5.0'}
                    </Text>
                  </View>
                  <View style={[styles.kycBadge, { backgroundColor: kyc.color + '15', borderColor: kyc.color }]}>
                    <Ionicons name={kyc.icon as any} size={12} color={kyc.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.kycText, { color: kyc.color }]}>{kyc.label}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* EDIT BUTTON */}
          <Animated.View style={{ transform: [{ scale: editBtnScale }] }}>
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]} 
              onPress={handleOpenEditModal} 
              onPressIn={() => animateButton(editBtnScale, 0.96)}
              onPressOut={() => animateButton(editBtnScale, 1)}
              activeOpacity={0.9}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.emeraldGreen} style={{ marginRight: 6 }} />
              <Text style={[styles.editButtonText, { color: COLORS.emeraldGreen }]}>Edit Profile</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* DYNAMIC KYC STATUS CARD SYSTEM */}
          {currentStatus === 'not_submitted' && (
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="shield-outline" size={20} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '800', color: theme.text }]}>🛡 KYC Not Submitted</Text>
              </View>
              <Text style={[styles.infoLabel, { color: theme.textMuted, lineHeight: 20, marginBottom: 16 }]}>
                Complete your KYC verification before you can receive delivery requests.
              </Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: COLORS.emeraldGreen, borderRadius: 12, alignItems: 'center', paddingVertical: 12 }]} 
                onPress={() => router.push("/complete-kyc")}
                activeOpacity={0.8}
              >
                <Text style={[styles.retryText, { fontWeight: '700' }]}>Complete KYC</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentStatus === 'pending' && (
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#272314' : '#FEF3C7', borderColor: isDarkMode ? '#453507' : '#FDE68A' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="time" size={20} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '800', color: '#B45309' }]}>Your KYC is under review.</Text>
              </View>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#FCD34D' : '#92400E', lineHeight: 20, marginBottom: 12 }]}>
                Your KYC documents have been submitted. Our team will review them within 24–48 hours.
              </Text>
              <View style={[styles.infoDivider, { backgroundColor: isDarkMode ? '#453507' : '#FCD34D' }]} />
              <View style={[styles.infoRow, { paddingTop: 6 }]}>
                <Text style={[styles.infoLabel, { color: isDarkMode ? '#FCD34D' : '#92400E' }]}>Submitted On</Text>
                <Text style={[styles.infoValue, { color: isDarkMode ? '#FFF' : '#78350F' }]}>{formatTimestamp(rider.documents_updated_at)}</Text>
              </View>
            </View>
          )}

          {currentStatus === 'verified' && (
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#062E20' : '#E6F4EA', borderColor: isDarkMode ? '#044E34' : '#A7F3D0' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '800', color: '#047857' }]}>Your account is verified.</Text>
              </View>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#A7F3D0' : '#065F46', lineHeight: 20, marginBottom: 12 }]}>
                Your account has been verified successfully. You can now receive delivery requests.
              </Text>
              <View style={[styles.infoDivider, { backgroundColor: isDarkMode ? '#044E34' : '#A7F3D0' }]} />
              <View style={[styles.infoRow, { paddingTop: 6 }]}>
                <Text style={[styles.infoLabel, { color: isDarkMode ? '#A7F3D0' : '#065F46' }]}>Verified On</Text>
                <Text style={[styles.infoValue, { color: isDarkMode ? '#FFF' : '#044E34' }]}>{formatTimestamp(rider.documents_updated_at)}</Text>
              </View>
            </View>
          )}

          {currentStatus === 'rejected' && (
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#3B1212' : '#FEE2E2', borderColor: isDarkMode ? '#6B1D1D' : '#FCA5A5' }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '800', color: '#B91C1C' }]}>KYC Rejected</Text>
              </View>
              <View style={[styles.immutableWarningBox, { backgroundColor: 'transparent', borderColor: isDarkMode ? '#6B1D1D' : '#FCA5A5', marginBottom: 16 }]}>
                <Ionicons name="alert-circle" size={16} color="#B91C1C" style={{ marginTop: 2, marginRight: 6 }} />
                <Text style={[styles.immutableWarningText, { flex: 1, fontWeight: '600', color: '#B91C1C' }]}>
                  {rider.verification_notes || 'The submitted proof files are blurry or mismatched validation configuration properties.'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: COLORS.danger, borderRadius: 12, alignItems: 'center', paddingVertical: 12 }]} 
                onPress={() => router.push("/complete-kyc")}
                activeOpacity={0.8}
              >
                <Text style={[styles.retryText, { fontWeight: '700' }]}>Resubmit KYC</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SECTION 1: PERSONAL DETAILS */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="person" size={16} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Personal Details</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Full Name</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.rider_name || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Email Address</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.email || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Mobile Number</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.phone || 'Not Added'}</Text>
            </View>
          </View>

          {/* SECTION 2: VEHICLE DETAILS */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="bicycle" size={16} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Vehicle Details</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Vehicle Type</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.vehicle_type || 'Not Available'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Vehicle Number</Text>
              <Text style={[styles.infoValue, styles.uppercaseText, { color: theme.text }]}>{rider.vehicle_number || 'Not Added'}</Text>
            </View>
          </View>

          {/* SECTION 4: BANK DETAILS */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="wallet" size={16} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Bank Details</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Bank Name</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.bank_name || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Account Holder</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.account_holder_name || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Account Number</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{maskAccount(rider.account_number)}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>IFSC Code</Text>
              <Text style={[styles.infoValue, styles.uppercaseText, { color: theme.text }]}>{rider.ifsc_code || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>UPI ID</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{rider.upi_id || 'Not Added'}</Text>
            </View>
          </View>

          {/* SECTION 5: ADDRESS */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={16} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Address</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Address</Text>
              <Text style={[styles.infoValue, { textAlign: 'right', maxWidth: '60%' }]} numberOfLines={2}>
                {profile?.address || 'Not Added'}
              </Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>City / Town</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profile?.city || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>State</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profile?.state || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>PIN Code</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profile?.pin_code || 'Not Added'}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Emergency Contact</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profile?.emergency_contact || 'Not Added'}</Text>
            </View>
          </View>

          {/* SECTION 6: SUPPORT */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="help-circle" size={17} color={COLORS.emeraldGreen} style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Support</Text>
            </View>
            
            <TouchableOpacity style={styles.supportAction} onPress={handleOpenEmail} activeOpacity={0.7}>
              <View style={styles.supportLeft}>
                <Ionicons name="mail" size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.supportText, { color: theme.text }]}>Email Support</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.supportSubText, { color: theme.textMuted }]}>rivo.city1@gmail.com</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
            
            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.supportAction} onPress={handleOpenWhatsApp} activeOpacity={0.7}>
              <View style={styles.supportLeft}>
                <Ionicons name="logo-whatsapp" size={16} color="#10B981" style={{ marginRight: 10 }} />
                <Text style={[styles.supportText, { color: theme.text }]}>WhatsApp Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.supportAction} onPress={() => {}} activeOpacity={0.7}>
              <View style={styles.supportLeft}>
                <Ionicons name="document-text" size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.supportText, { color: theme.text }]}>Terms & Conditions</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.supportAction} onPress={() => {}} activeOpacity={0.7}>
              <View style={styles.supportLeft}>
                <Ionicons name="lock-closed" size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.supportText, { color: theme.text }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.supportAction} onPress={() => {}} activeOpacity={0.7}>
              <View style={styles.supportLeft}>
                <Ionicons name="information-circle" size={16} color={theme.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.supportText, { color: theme.text }]}>About Rivo</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* LOGOUT SYSTEM */}
          <Animated.View style={{ transform: [{ scale: logoutBtnScale }] }}>
            <TouchableOpacity 
              style={[styles.logoutButton, { borderColor: COLORS.danger + '30' }]} 
              onPress={handleLogout} 
              onPressIn={() => animateButton(logoutBtnScale, 0.96)}
              onPressOut={() => animateButton(logoutBtnScale, 1)}
              activeOpacity={0.9}
            >
              <Ionicons name="log-out" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </Animated.View>
          
          {/* APP INFORMATION */}
          <View style={styles.appVersionContainer}>
            <Text style={[styles.appVersionText, { color: theme.textMuted }]}>Version 2.4.0</Text>
            <View style={styles.footerLinksRow}>
              <Text style={[styles.footerLinkItem, { color: theme.textMuted }]}>Privacy Policy</Text>
              <Text style={[styles.footerLinkDivider, { color: theme.textMuted }]}>•</Text>
              <Text style={[styles.footerLinkItem, { color: theme.textMuted }]}>Terms</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* EDIT MODAL / SHEET */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Update Profile Information</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              
              {/* KYC WARNING CARD */}
              <View style={[styles.immutableWarningBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.emeraldGreen} style={{ marginTop: 2 }} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.immutableWarningTitle, { color: theme.text }]}>KYC Verification</Text>
                  <Text style={[styles.immutableWarningText, { color: theme.textMuted }]}>
                    To modify core system identity attributes or official identification details, navigate to the dedicated KYC status dashboard page flow.
                  </Text>
                </View>
              </View>

              <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Contact Info</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="call-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
              </View>

              <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Vehicle Particulars</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="card-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, styles.uppercaseText, { color: theme.text }]} value={formVehicleNumber} onChangeText={setFormVehicleNumber} placeholder="Vehicle Number" placeholderTextColor={theme.textMuted} autoCapitalize="characters" />
              </View>

              <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Banking Infrastructure</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="person-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formAccountHolder} onChangeText={setFormAccountHolder} placeholder="Account Holder Name" placeholderTextColor={theme.textMuted} />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="business-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formBankName} onChangeText={setFormBankName} placeholder="Bank Name" placeholderTextColor={theme.textMuted} />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="wallet-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formAccountNumber} onChangeText={setFormAccountNumber} placeholder="Account Number" placeholderTextColor={theme.textMuted} keyboardType="number-pad" />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="git-branch-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, styles.uppercaseText, { color: theme.text }]} value={formIfsc} onChangeText={setFormIfsc} placeholder="IFSC Code" placeholderTextColor={theme.textMuted} autoCapitalize="characters" />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="qr-code-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formUpi} onChangeText={setFormUpi} placeholder="UPI ID" placeholderTextColor={theme.textMuted} autoCapitalize="none" />
              </View>

              <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Location Mapping</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="home-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formAddress} onChangeText={setFormAddress} placeholder="Address" placeholderTextColor={theme.textMuted} />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="map-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formCity} onChangeText={setFormCity} placeholder="City" placeholderTextColor={theme.textMuted} />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="location-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formStateName} onChangeText={setFormStateName} placeholder="State" placeholderTextColor={theme.textMuted} />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="pin-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formPinCode} onChangeText={setFormPinCode} placeholder="PIN Code" placeholderTextColor={theme.textMuted} keyboardType="number-pad" />
              </View>

              <Text style={[styles.inputGroupLabel, { color: theme.textMuted }]}>Emergency Protocol</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={[styles.input, { color: theme.text }]} value={formEmergencyContact} onChangeText={setFormEmergencyContact} placeholder="Emergency Contact" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={[styles.modalActions, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
              <TouchableOpacity style={[styles.cancelModalButton, { borderColor: theme.border }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.cancelModalText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveModalButton, { backgroundColor: COLORS.emeraldGreen }]} onPress={handleUpdateProfile} disabled={updating}>
                {updating ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.saveModalText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
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
    fontWeight: '800',
    letterSpacing: -0.5,
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
  },
  body: {
    padding: 16,
  },
  profileHeroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1.5,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.emeraldGreen,
    width: 22,
    height: 22,
    borderRadius: 11,
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
  joinedText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  kycText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  editButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoDivider: {
    height: 1,
    marginVertical: 4,
  },
  uppercaseText: {
    textTransform: 'uppercase',
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
    paddingVertical: 14,
    borderRadius: 16,
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
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 6,
  },
  footerLinkItem: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerLinkDivider: {
    fontSize: 10,
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
    borderRadius: 20,
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
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.emeraldGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalForm: {
    padding: 20,
  },
  immutableWarningBox: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  immutableWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  immutableWarningText: {
    fontSize: 12,
    lineHeight: 18,
  },
  inputGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    height: 50,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    marginRight: 12,
  },
  cancelModalText: {
    fontWeight: '700',
    fontSize: 15,
  },
  saveModalButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  saveModalText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});