// app/(tabs)/dashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getUnreadNotificationCount } from '../../services/notifications';
import { getAssignedVendors, getCurrentRiderProfile, updateAvailabilityStatus } from '../../services/rider';

const { width, height } = Dimensions.get('window');

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
  darkCard: '#1F2937',
  darkBorder: '#374151',
  darkMuted: '#9CA3AF',
  amberBgLight: '#FFFBEB',
  amberBgDark: '#2D2210',
  amberBorderLight: '#D97706',
  amberBorderDark: '#B45309',
  amberTextLight: '#92400E',
  amberTextDark: '#FDE68A',
  redBgLight: '#FEF2F2',
  redBgDark: '#2D1414',
  redBorderLight: '#DC2626',
  redBorderDark: '#991B1B',
  redTextLight: '#991B1B',
  redTextDark: '#FCA5A5',
};

const AVAILABLE_SHIFTS = [
  { id: '1', name: 'Morning Shift (06:00 AM - 10:00 AM)', durationHours: 4 },
  { id: '2', name: 'Midday Shift (10:00 AM - 02:00 PM)', durationHours: 4 },
  { id: '3', name: 'Evening Shift (02:00 PM - 06:00 PM)', durationHours: 4 },
  { id: '4', name: 'Prime Shift (06:00 PM - 11:00 PM)', durationHours: 5 }
];

export default function DashboardScreen() {
  const router = useRouter();
  const [rider, setRider] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorProfile, setErrorProfile] = useState<boolean>(false);
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const bellScale = useRef(new Animated.Value(1)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const themeToggleAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  const [shiftModalVisible, setShiftModalVisible] = useState<boolean>(false);
  const [sosModalVisible, setSosModalVisible] = useState<boolean>(false);
  const [reportingSos, setReportingSos] = useState<boolean>(false);
  const [selectedSosOption, setSelectedSosOption] = useState<string | null>(null);
  const [customInputText, setCustomInputText] = useState<string>('');
  const [attachedPhotoUri, setAttachedPhotoUri] = useState<string | null>(null);

  const [shiftTimeRemaining, setShiftTimeRemaining] = useState<number>(0); 
  const [showExtensionModal, setShowExtensionModal] = useState<boolean>(false);
  const [hasExtendedCurrentShift, setHasExtendedCurrentShift] = useState<boolean>(false);
  
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [tutorialStep, setTutorialStep] = useState<number>(0);

  const [greeting, setGreeting] = useState({
    text: '',
    subtitle: '',
    icon: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const onlineBtnScale = useRef(new Animated.Value(1)).current;

  const theme = {
    bg: isDarkMode ? COLORS.jetBlack : COLORS.offWhite,
    cardBg: isDarkMode ? COLORS.darkCard : COLORS.white,
    text: isDarkMode ? COLORS.white : COLORS.jetBlack,
    textMuted: isDarkMode ? COLORS.darkMuted : COLORS.textMuted,
    border: isDarkMode ? COLORS.darkBorder : COLORS.borderLight,
    headerBg: isDarkMode ? COLORS.darkCard : COLORS.white,
  };

  const updateGreeting = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes >= 5 * 60 && totalMinutes < 12 * 60) {
      setGreeting({ text: 'Good Morning', subtitle: "Ready to conquer today's deliveries?", icon: '👋' });
    } else if (totalMinutes >= 12 * 60 && totalMinutes < 17 * 60) {
      setGreeting({ text: 'Good Afternoon', subtitle: 'Hope your deliveries are going smoothly.', icon: '☀️' });
    } else if (totalMinutes >= 17 * 60 && totalMinutes < 21 * 60) {
      setGreeting({ text: 'Good Evening', subtitle: "You're doing great. Finish today's deliveries strong.", icon: '🌇' });
    } else {
      setGreeting({ text: 'Good Night', subtitle: 'Drive safely and have a peaceful night.', icon: '🌙' });
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const res = await getUnreadNotificationCount(user.id, 'rider');
        if (res.success && typeof res.data === 'number') {
          setUnreadNotificationsCount(res.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    updateGreeting();
    loadDashboardData();
    checkTutorialStatus();

    const greetingInterval = setInterval(() => {
      updateGreeting();
    }, 60000);

    return () => clearInterval(greetingInterval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      if (rider?.id) {
        getCurrentRiderProfile().then((profileData) => {
          if (profileData) {
            handleKycSafetySync(profileData);
          }
        });
      }
    }, [rider?.id])
  );

  useEffect(() => {
    Animated.timing(themeToggleAnim, {
      toValue: isDarkMode ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isDarkMode]);

  // SHIFT TIMER & 10-MINUTE EXTENSION TRIGGER
  useEffect(() => {
    let interval: any = setInterval(() => {
      calculateShiftTimers();
    }, 1000);
    return () => clearInterval(interval);
  }, [activeShift, hasExtendedCurrentShift]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    updateGreeting();
    await fetchUnreadCount();
    await loadDashboardData(true);
    setRefreshing(false);
  }, []);

  const translateX = themeToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 26], 
  });

  async function checkTutorialStatus() {
    try {
      const value = await AsyncStorage.getItem('@rivo_tutorial_completed');
      if (value === null) setShowTutorial(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function completeTutorial() {
    try {
      await AsyncStorage.setItem('@rivo_tutorial_completed', 'true');
      setShowTutorial(false);
    } catch (e) {
      console.error(e);
    }
  }

  const handleKycSafetySync = async (profileData: any) => {
    const isOnline = profileData.availability_status?.toLowerCase() === 'available';
    const kycStatus = profileData.kyc_status;

    if (isOnline && kycStatus !== 'verified') {
      try {
        const updatedProfile = await updateAvailabilityStatus('offline');
        if (updatedProfile) {
          setRider(updatedProfile);
          return;
        }
      } catch (err) {
        console.error('[KYC Safety System] Failed to drop driver availability status offline:', err);
      }
    }
    setRider(profileData);
  };

  async function loadDashboardData(isRefresh = false) {
    try {
      if (!isRefresh) setLoading(true);
      const profileData = await getCurrentRiderProfile();
      if (!profileData) {
        setErrorProfile(true);
        setLoading(false);
        return;
      }

      // 1. Calculate Today's Earnings & Deliveries
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('rider_earning, updated_at, created_at')
        .eq('rider_id', profileData.id)
        .ilike('order_status', 'delivered')
        .gte('created_at', startOfDay.toISOString());

      const earningsToday = (todayOrders || []).reduce((sum, o) => sum + (Number(o.rider_earning) || 0), 0);
      const ordersCompletedToday = todayOrders?.length || 0;

      // 2. Calculate Lifetime Earnings directly from delivered orders
      const { data: totalOrders } = await supabase
        .from('orders')
        .select('rider_earning')
        .eq('rider_id', profileData.id)
        .ilike('order_status', 'delivered');

      const totalEarnings = (totalOrders || []).reduce((sum, o) => sum + (Number(o.rider_earning) || 0), 0);

      const enhancedProfile = {
        ...profileData,
        earnings_today: earningsToday,
        orders_completed: ordersCompletedToday,
        total_earnings: totalEarnings,
      };

      await handleKycSafetySync(enhancedProfile);

      // Active shift lookup
      const { data: shiftData } = await supabase
        .from('rider_shifts')
        .select('*')
        .eq('rider_id', profileData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      let currentActiveShift = null;
      if (shiftData && shiftData.length > 0) {
        currentActiveShift = shiftData[0];
        setActiveShift(currentActiveShift);
      } else {
        setActiveShift(null);
        setShowExtensionModal(false);
        setHasExtendedCurrentShift(false);
      }

      // 3. Store Order Assignments (Only count if rider is Online and has Active Shift)
      const isRiderOnline = profileData.availability_status?.toLowerCase() === 'available';
      const hasActiveShift = !!currentActiveShift;

      const vendorsData = await getAssignedVendors();
      const enhancedVendors = await Promise.all(
        (vendorsData || []).map(async (v: any) => {
          // Guard: If rider is offline or has no active shift, pending orders stay 0
          if (!isRiderOnline || !hasActiveShift) {
            return { ...v, pendingOrdersCount: 0 };
          }

          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('vendor_id', v.id)
            .or(`rider_id.eq.${profileData.id},rider_id.is.null`)
            .not('order_status', 'ilike', 'delivered')
            .not('order_status', 'ilike', 'cancel%');
            
          return { ...v, pendingOrdersCount: count || 0 };
        })
      );
      setVendors(enhancedVendors);

      // Customer reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('rider_id', profileData.id)
        .order('created_at', { ascending: false });
      setReviews(reviewsData || []);

      // Recent deliveries
      const { data: deliveriesData } = await supabase
        .from('orders')
        .select('id, order_number, order_status, total_amount, updated_at, vendor:vendors(shop_name)')
        .eq('rider_id', profileData.id)
        .ilike('order_status', 'delivered')
        .order('updated_at', { ascending: false })
        .limit(5);
      setRecentDeliveries(deliveriesData || []);

      if (!isRefresh) setLoading(false);
      triggerEntranceAnimation();
    } catch (err) {
      console.error(err);
      setErrorProfile(true);
      if (!isRefresh) setLoading(false);
    }
  }

  function triggerEntranceAnimation() {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  function calculateShiftTimers() {
    if (!activeShift || activeShift.status !== 'active') {
      setShiftTimeRemaining(0);
      setShowExtensionModal(false);
      return;
    }

    const now = new Date().getTime();
    const end = new Date(activeShift.shift_end).getTime();

    if (now < end) {
      const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
      setShiftTimeRemaining(remainingSeconds);

      // Trigger Modal popup when 10 minutes (600s) or less remain
      if (remainingSeconds <= 600 && remainingSeconds > 0 && !hasExtendedCurrentShift) {
        setShowExtensionModal(true);
      } else {
        setShowExtensionModal(false);
      }
    } else {
      setShiftTimeRemaining(0);
      setShowExtensionModal(false);
      triggerAutoShiftCompletion();
    }
  }

  async function triggerAutoShiftCompletion() {
    if (!activeShift || activeShift.status !== 'active') return;
    try {
      const now = new Date();
      await supabase
        .from('rider_shifts')
        .update({
          shift_end: now.toISOString(),
          status: 'completed',
        })
        .eq('id', activeShift.id)
        .select()
        .single();

      setActiveShift(null);
      setHasExtendedCurrentShift(false);
      setShowExtensionModal(false);
      await loadDashboardData(true);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSelectShift(shift: typeof AVAILABLE_SHIFTS[0]) {
    if (rider?.kyc_status !== 'verified') {
      alert('Complete your KYC verification first.');
      return;
    }

    // Guard: Prevent offline riders from selecting a shift
    if (rider?.availability_status?.toLowerCase() !== 'available') {
      alert('You must be Online to select a shift. Turn your status to Online first.');
      return;
    }

    if (activeShift) {
      alert("You already have an active shift.");
      setShiftModalVisible(false);
      return;
    }

    try {
      const now = new Date();
      const futureEnd = new Date(now.getTime() + shift.durationHours * 60 * 60 * 1000); 
      
      const { data, error } = await supabase
        .from('rider_shifts')
        .insert({
          rider_id: rider.id,
          shift_start: now.toISOString(),
          shift_end: futureEnd.toISOString(),
          status: 'active',
          created_at: now.toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setActiveShift(data);
        setHasExtendedCurrentShift(false);
      }
      
      setShiftModalVisible(false);
      await loadDashboardData(true);
    } catch (error) {
      console.error(error);
      setShiftModalVisible(false);
    }
  }

  async function handleEndShiftEarly() {
    if (!activeShift || activeShift.status !== 'active') return;
    try {
      const now = new Date();
      await supabase
        .from('rider_shifts')
        .update({
          shift_end: now.toISOString(),
          status: 'completed',
        })
        .eq('id', activeShift.id)
        .select()
        .single();

      setActiveShift(null);
      setShiftTimeRemaining(0);
      setHasExtendedCurrentShift(false);
      setShowExtensionModal(false);
      await loadDashboardData(true);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleContinueShift() {
    if (!activeShift || activeShift.status !== 'active') return;
    try {
      const currentEnd = new Date(activeShift.shift_end);
      // Extend shift by 2 hours
      const extendedEnd = new Date(currentEnd.getTime() + 2 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('rider_shifts')
        .update({ shift_end: extendedEnd.toISOString() })
        .eq('id', activeShift.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setActiveShift(data);
        setHasExtendedCurrentShift(true);
        setShowExtensionModal(false);
      }
    } catch (error) {
      console.error('[Shift Extension System] Failed to extend operational shift windows:', error);
    }
  }

  async function toggleAvailability() {
    if (!rider) return;

    if (rider.kyc_status === 'pending') {
      alert('Your account is under verification.');
      return;
    }
    if (rider.kyc_status === 'rejected') {
      alert('Complete your KYC verification first.');
      return;
    }

    Animated.sequence([
      Animated.timing(onlineBtnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(onlineBtnScale, { toValue: 1, duration: 80, useNativeDriver: true })
    ]).start();

    const currentStatus = rider.availability_status?.toLowerCase();
    const newStatus = currentStatus === 'available' ? 'offline' : 'available';
    
    try {
      const updatedRider = await updateAvailabilityStatus(newStatus);
      if (updatedRider) {
        setRider((prev: any) => ({ ...prev, ...updatedRider }));
        await loadDashboardData(true);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    }
  }

  async function pickImageAttachment() {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Camera permissions are required to attach live validation images.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled) {
      setAttachedPhotoUri(result.assets[0].uri);
    }
  }

  async function submitSosReport() {
    if (!selectedSosOption) return;

    if ((selectedSosOption === 'Road Block' || selectedSosOption === 'Accident') && !attachedPhotoUri) {
      alert('A validation photo attachment is required for Road Block or Accident declarations.');
      return;
    }

    if ((selectedSosOption === 'Need Assistance' || selectedSosOption === 'Other') && !customInputText.trim()) {
      alert('Please fill out the descriptive information context before submitting.');
      return;
    }

    setReportingSos(true);
    try {
      await supabase.from('rider_emergency_reports').insert({
        rider_id: rider.id,
        issue_type: selectedSosOption,
        description: customInputText,
        photo_url: attachedPhotoUri,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      alert(`Emergency SOS Submitted successfully for: ${selectedSosOption}`);
      resetSosModalState();
    } catch (e) {
      console.error(e);
    } finally {
      setReportingSos(false);
    }
  }

  function resetSosModalState() {
    setSosModalVisible(false);
    setSelectedSosOption(null);
    setCustomInputText('');
    setAttachedPhotoUri(null);
  }

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getAvatarFallback = (name: string) => {
    if (!name) return 'RV';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : `${name.substring(0, 2)}`.toUpperCase();
  };

  if (errorProfile) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.bg }]}>
        <Text style={styles.errorTitle}>Sync Interrupted</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.errorButton}>
          <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Login Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAvailable = rider?.availability_status?.toLowerCase() === 'available';
  const averageRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : rider?.rating || '5.0';

  const tutorialSteps = [
    { title: 'Dashboard V2', desc: 'Monitor metrics, stores, and active shift timers smoothly.' },
    { title: 'Fulfillment Nodes', desc: 'Track live store locations and total assigned pending count.' },
    { title: 'Operational Status', desc: 'Securely switch online or offline to manage incoming dispatches.' },
    { title: 'SOS Emergency Support', desc: 'Report vehicle logs or road barriers instantly to active support.' }
  ];

  const SkeletonCard = () => (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: 0.6 }]}>
      <View style={{ width: '40%', height: 16, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4, marginBottom: 12 }} />
      <View style={{ width: '80%', height: 24, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4, marginBottom: 8 }} />
      <View style={{ width: '60%', height: 14, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* HEADER */}
      <View style={[styles.headerContainer, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>{greeting.icon} {greeting.text}</Text>
            <Text style={[styles.riderName, { color: theme.text }]}>{loading ? 'Loading...' : (rider?.rider_name || 'Rivo Partner')}</Text>
            <Text style={[styles.riderSubtitle, { color: theme.textMuted }]}>{greeting.subtitle}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity activeOpacity={0.9} onPress={toggleTheme} style={[styles.switchTrack, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
              <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]}>
                <Text style={{ fontSize: 11, textAlign: 'center' }}>{isDarkMode ? '🌙' : '☀️'}</Text>
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Animated.sequence([
                  Animated.timing(bellScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
                  Animated.timing(bellScale, { toValue: 1, duration: 80, useNativeDriver: true })
                ]).start(() => {
                  router.push('/notifications');
                });
              }}
            >
              <Animated.View style={[styles.bellContainer, { transform: [{ scale: bellScale }] }]}>
                <Ionicons name="notifications-outline" size={24} color={theme.text} />
                {unreadNotificationsCount > 0 && (
                  <View style={styles.badgeIndicator} />
                )}
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Animated.sequence([
                  Animated.timing(avatarScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
                  Animated.timing(avatarScale, { toValue: 1, duration: 80, useNativeDriver: true })
                ]).start(() => {
                  router.push('/profile');
                });
              }}
            >
              <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                {!loading && (
                  rider?.profile_photo_url ? (
                    <Image source={{ uri: rider.profile_photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{getAvatarFallback(rider?.rider_name || '')}</Text>
                    </View>
                  )
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.largePillSkeleton, { backgroundColor: theme.cardBg, borderColor: theme.border }]} />
          <SkeletonCard />
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 90, backgroundColor: theme.cardBg, borderRadius: 20, borderWidth: 1, borderColor: theme.border }} />
            <View style={{ flex: 1, height: 90, backgroundColor: theme.cardBg, borderRadius: 20, borderWidth: 1, borderColor: theme.border }} />
          </View>
          <SkeletonCard />
        </ScrollView>
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.emeraldGreen} colors={[COLORS.emeraldGreen]} />
          }
        >
          <Animated.View style={{ padding: 16, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            {/* KYC Dynamic Status Restriction Alert Cards */}
            {rider?.kyc_status === 'pending' && (
              <View style={[styles.kycAlertCard, { backgroundColor: isDarkMode ? COLORS.amberBgDark : COLORS.amberBgLight, borderLeftColor: isDarkMode ? COLORS.amberBorderDark : COLORS.amberBorderLight }]}>
                <Text style={[styles.kycAlertTitle, { color: isDarkMode ? COLORS.amberTextDark : COLORS.amberTextLight }]}>🛡️ Verification in Progress</Text>
                <Text style={[styles.kycAlertDesc, { color: isDarkMode ? COLORS.darkMuted : COLORS.textMuted }]}>
                  Your KYC documents are currently under review. You'll be able to receive deliveries once your account has been verified.
                </Text>
              </View>
            )}

            {rider?.kyc_status === 'rejected' && (
              <View style={[styles.kycAlertCard, { backgroundColor: isDarkMode ? COLORS.redBgDark : COLORS.redBgLight, borderLeftColor: isDarkMode ? COLORS.redBorderDark : COLORS.redBorderLight }]}>
                <Text style={[styles.kycAlertTitle, { color: isDarkMode ? COLORS.redTextDark : COLORS.redTextLight }]}>❌ Verification Required</Text>
                <Text style={[styles.kycAlertDesc, { color: isDarkMode ? COLORS.darkMuted : COLORS.textMuted, marginBottom: 12 }]}>
                  Your KYC verification was rejected. Please update your documents from your Profile.
                </Text>
                <TouchableOpacity 
                  activeOpacity={0.8} 
                  onPress={() => router.push('/profile')} 
                  style={[styles.kycActionBtn, { backgroundColor: isDarkMode ? COLORS.redBorderDark : COLORS.redBorderLight }]}
                >
                  <Text style={styles.kycActionBtnText}>Update Documents</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 1. ONLINE STATUS PILL */}
            <Animated.View style={{ transform: [{ scale: onlineBtnScale }], marginBottom: 20 }}>
              <TouchableOpacity 
                activeOpacity={rider?.kyc_status === 'verified' ? 0.9 : 1} 
                onPress={toggleAvailability} 
                style={[
                  styles.statusLargePill, 
                  { 
                    backgroundColor: isAvailable ? '#E6F4EA' : (isDarkMode ? '#2D3748' : '#F3F4F6'), 
                    borderColor: isAvailable ? '#A3E635' : theme.border,
                    opacity: rider?.kyc_status === 'verified' ? 1 : 0.6
                  }
                ]}
              >
                <View style={[styles.statusIndicatorDot, { backgroundColor: isAvailable ? COLORS.emeraldGreen : '#9CA3AF' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusPillTitle, { color: isAvailable ? '#137333' : theme.text }]}>
                    {isAvailable ? '🟢 Online' : '⚫ Offline'}
                  </Text>
                  <Text style={[styles.statusPillSubtitle, { color: isAvailable ? '#137333' : theme.textMuted }]}>
                    {rider?.kyc_status === 'verified' 
                      ? (isAvailable ? 'Tap to go Offline' : 'Tap to go Online') 
                      : (rider?.kyc_status === 'pending' ? 'Waiting for verification' : 'Disabled')}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* 2. STATS GRID */}
            <View style={styles.gridContainer}>
              <View style={[styles.gridItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>💰 Today's Earnings</Text>
                <Text style={[styles.metricValue, { color: COLORS.emeraldGreen }]}>₹{rider?.earnings_today || 0}</Text>
              </View>
              <View style={[styles.gridItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>📦 Today's Deliveries</Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>{rider?.orders_completed || 0}</Text>
              </View>
            </View>

            <View style={styles.gridContainer}>
              <View style={[styles.gridItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>💼 Lifetime Earnings</Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>₹{rider?.total_earnings || 0}</Text>
              </View>
              <View style={[styles.gridItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>⭐ Rating</Text>
                <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{averageRating} / 5.0</Text>
              </View>
            </View>

            {/* 3. CURRENT SHIFT CARD */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>⏱️ My Shift</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
                <View>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Shift Time Remaining</Text>
                  <Text style={[styles.timerText, { color: shiftTimeRemaining > 0 ? COLORS.emeraldGreen : theme.text }]}>
                    {shiftTimeRemaining > 0 ? formatTimer(shiftTimeRemaining) : '00:00:00'}
                  </Text>
                </View>

                {shiftTimeRemaining > 0 ? (
                  <TouchableOpacity onPress={handleEndShiftEarly} style={[styles.actionBtn, { backgroundColor: COLORS.danger }]}>
                    <Text style={styles.actionBtnText}>End Shift</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    onPress={() => {
                      if (rider?.kyc_status !== 'verified') {
                        alert('Complete your KYC verification first.');
                      } else if (!isAvailable) {
                        alert('You must be Online to select a shift. Turn your status to Online first.');
                      } else {
                        setShiftModalVisible(true);
                      }
                    }} 
                    style={[styles.actionBtn, { backgroundColor: isAvailable ? COLORS.emeraldGreen : '#9CA3AF' }]}
                  >
                    <Text style={styles.actionBtnText}>Select Shift</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* 4. ASSIGNED STORES */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 4 }]}>🏪 Assigned Stores</Text>
              {vendors.length > 0 ? (
                vendors.map((vendor) => (
                  <View key={vendor.id} style={[styles.vendorRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.vendorName, { color: theme.text }]}>{vendor.shop_name || 'Fulfillment Point'}</Text>
                      <Text style={styles.vendorStatusTag}>🟢 Open</Text>
                    </View>
                    <View style={[styles.orderBadge, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                      <Text style={[styles.orderBadgeText, { color: theme.text }]}>{vendor.pendingOrdersCount || 0} Active Orders</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateIcon}>🏪</Text>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No stores assigned.</Text>
                  <Text style={[styles.emptyStateDesc, { color: theme.textMuted }]}>New assignments will appear here.</Text>
                </View>
              )}
            </View>

            {/* 5. RECENT DELIVERIES */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 4 }]}>📋 Recent Deliveries</Text>
              {recentDeliveries.length > 0 ? (
                recentDeliveries.map((delivery) => (
                  <View key={delivery.id} style={[styles.deliveryRow, { borderColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deliveryNumber, { color: theme.text }]}>#{delivery.order_number || delivery.id.substring(0,8)}</Text>
                      <Text style={[styles.deliveryStore, { color: theme.textMuted }]}>{delivery.vendor?.shop_name || 'Rivo Store Point'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.deliveryAmount}>+₹{delivery.total_amount || 0}</Text>
                      <Text style={styles.deliveryStatusSuccess}>✔ Delivered</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateIcon}>📦</Text>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No recent deliveries.</Text>
                  <Text style={[styles.emptyStateDesc, { color: theme.textMuted }]}>Complete your first order today.</Text>
                </View>
              )}
            </View>

            {/* 6. CUSTOMER REVIEWS */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 4 }]}>💬 Customer Reviews</Text>
              {reviews.length > 0 ? (
                reviews.slice(0, 2).map((rev) => (
                  <View key={rev.id} style={[styles.reviewItem, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14 }}>{'★'.repeat(rev.rating)}</Text>
                      <Text style={{ color: theme.textMuted, fontSize: 10 }}>{new Date(rev.created_at).toLocaleDateString()}</Text>
                    </View>
                    {rev.comment ? <Text style={[styles.reviewComment, { color: theme.text }]}>{rev.comment}</Text> : null}
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateIcon}>⭐</Text>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No reviews yet</Text>
                  <Text style={[styles.emptyStateDesc, { color: theme.textMuted }]}>Complete deliveries to receive ratings.</Text>
                </View>
              )}
            </View>

            {/* 7. EMERGENCY SOS CARD */}
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: COLORS.danger, borderWidth: 1, borderRadius: 20 }]}>
              <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>🚨 Emergency SOS</Text>
              <Text style={[styles.metricLabel, { color: theme.textMuted, marginTop: 4, marginBottom: 14 }]}>
                Need help during delivery? Report an emergency immediately.
              </Text>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setSosModalVisible(true)} 
                style={[styles.actionBtn, { backgroundColor: COLORS.danger, alignItems: 'center', borderRadius: 12 }]}
              >
                <Text style={styles.actionBtnText}>Open SOS</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      )}

      {/* 10-MINUTE SHIFT EXTENSION POPUP MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showExtensionModal}
        onRequestClose={() => setShowExtensionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderRadius: 24, padding: 24 }]}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>⏰</Text>
            
            <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>
              Shift Ending Soon!
            </Text>
            
            <Text style={[styles.modalSubtitle, { color: theme.textMuted, textAlign: 'center', marginVertical: 12, lineHeight: 20 }]}>
              Your current shift ends in <Text style={{ fontWeight: '800', color: COLORS.emeraldGreen }}>{formatTimer(shiftTimeRemaining)}</Text>. 
              Would you like to extend your shift by 2 hours to keep receiving deliveries?
            </Text>

            <View style={{ gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={async () => {
                  await handleContinueShift();
                }}
                style={{
                  backgroundColor: COLORS.emeraldGreen,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 16 }}>
                  Yes, Extend Shift
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={async () => {
                  setShowExtensionModal(false);
                  await handleEndShiftEarly(); // 👈 Instantly completes the active shift in DB
                }}
                style={{
                  backgroundColor: theme.border,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>
                  No, End Shift Now
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SHIFT SELECT MODAL */}
      <Modal animationType="slide" transparent={true} visible={shiftModalVisible} onRequestClose={() => setShiftModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Choose Your Shift</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Select a shift time below to start taking deliveries.</Text>
            
            <View style={{ gap: 10, marginVertical: 10 }}>
              {AVAILABLE_SHIFTS.map((shift) => (
                <TouchableOpacity 
                  key={shift.id} 
                  onPress={() => handleSelectShift(shift)} 
                  style={[styles.shiftSelectorCard, { backgroundColor: theme.bg, borderColor: theme.border, borderRadius: 16 }]}
                >
                  <Text style={[styles.shiftSelectorText, { color: theme.text }]}>{shift.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setShiftModalVisible(false)} style={[styles.closeModalBtn, { backgroundColor: theme.border, borderRadius: 99 }]}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SOS MODAL */}
      <Modal animationType="slide" transparent={true} visible={sosModalVisible} onRequestClose={() => resetSosModalState()}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Rivo Live Incident Panel</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Select an emergency code template below to acquire rescue support.</Text>

            {reportingSos ? (
              <ActivityIndicator color={COLORS.danger} size="large" style={{ marginVertical: 40 }} />
            ) : selectedSosOption === null ? (
              <View style={styles.sosOptionsGrid}>
                {['Out of Fuel', 'Vehicle Breakdown', 'Road Block', 'Accident', 'Need Assistance', 'Other'].map((option) => (
                  <TouchableOpacity 
                    key={option} 
                    onPress={() => setSelectedSosOption(option)}
                    style={[styles.sosOptionCard, { backgroundColor: theme.bg, borderColor: theme.border, borderRadius: 16 }]}
                  >
                    <Text style={[styles.sosOptionText, { color: theme.text }]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ fontWeight: '700', color: theme.text, marginBottom: 8 }}>
                  Incident Mode: <Text style={{ color: COLORS.danger }}>{selectedSosOption}</Text>
                </Text>

                {(selectedSosOption === 'Road Block' || selectedSosOption === 'Accident') && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted, marginBottom: 8 }]}>This incident option requires verification documentation.</Text>
                    <TouchableOpacity onPress={pickImageAttachment} style={[styles.photoPickerBtn, { backgroundColor: theme.bg, borderColor: theme.border, borderRadius: 16 }]}>
                      <Text style={{ fontWeight: '600', color: theme.text }}>
                        {attachedPhotoUri ? '✅ Photo Document Attached' : '📸 Launch Verification Camera'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedSosOption === 'Need Assistance' && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted, marginBottom: 8 }]}>What kind of assistance do you need?</Text>
                    <TextInput 
                      style={[styles.formTextInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, borderRadius: 16 }]} 
                      placeholder="Specify required layout details..."
                      placeholderTextColor={theme.textMuted}
                      value={customInputText}
                      onChangeText={setCustomInputText}
                    />
                  </View>
                )}

                {selectedSosOption === 'Other' && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted, marginBottom: 8 }]}>What is the other issue/problem?</Text>
                    <TextInput 
                      style={[styles.formTextInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, borderRadius: 16 }]} 
                      placeholder="Describe the problem context details..."
                      placeholderTextColor={theme.textMuted}
                      value={customInputText}
                      onChangeText={setCustomInputText}
                    />
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => setSelectedSosOption(null)} style={[styles.closeModalBtn, { flex: 1, marginTop: 0, backgroundColor: theme.border, borderRadius: 99 }]}>
                    <Text style={{ fontWeight: '700', color: theme.text }}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={submitSosReport} style={[styles.actionBtn, { flex: 1, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center', borderRadius: 99 }]}>
                    <Text style={styles.actionBtnText}>Submit Alert</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {selectedSosOption === null && (
              <TouchableOpacity onPress={() => resetSosModalState()} style={[styles.closeModalBtn, { backgroundColor: theme.border, borderRadius: 99 }]}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* TUTORIAL OVERLAY */}
      {showTutorial && (
        <View style={styles.tutorialOverlay}>
          <View style={[styles.tutorialCard, { backgroundColor: theme.cardBg, borderRadius: 24 }]}>
            <Text style={styles.tutorialBadge}>WIZARD GUIDE {tutorialStep + 1} / 4</Text>
            <Text style={[styles.tutorialTitle, { color: theme.text }]}>{tutorialSteps[tutorialStep].title}</Text>
            <Text style={[styles.tutorialDesc, { color: theme.textMuted }]}>{tutorialSteps[tutorialStep].desc}</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, alignItems: 'center' }}>
              {tutorialStep > 0 ? (
                <TouchableOpacity onPress={() => setTutorialStep(p => p - 1)} style={styles.tutorialBackBtn}>
                  <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Back</Text>
                </TouchableOpacity>
              ) : <View />}

              <TouchableOpacity 
                onPress={() => {
                  if (tutorialStep < 3) {
                    setTutorialStep(p => p + 1);
                  } else {
                    completeTutorial();
                  }
                }} 
                style={[styles.tutorialNextBtn, { backgroundColor: COLORS.emeraldGreen, borderRadius: 99 }]}
              >
                <Text style={{ color: COLORS.white, fontWeight: '800' }}>
                  {tutorialStep === 3 ? 'Finish' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: COLORS.danger,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorButton: {
    backgroundColor: COLORS.jetBlack,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.emeraldGreen,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.emeraldGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 15,
  },
  brandTitle: {
    color: COLORS.emeraldGreen,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  riderName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  riderSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
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
  bellContainer: {
    padding: 4,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },
  kycAlertCard: {
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1.5,
  },
  kycAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  kycAlertDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  kycActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  kycActionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  statusLargePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 16,
  },
  statusPillTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusPillSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  largePillSkeleton: {
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  actionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  vendorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  vendorStatusTag: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emeraldGreen,
    marginTop: 2,
  },
  orderBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewItem: {
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  deliveryNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  deliveryStore: {
    fontSize: 12,
    marginTop: 2,
  },
  deliveryAmount: {
    color: COLORS.emeraldGreen,
    fontSize: 16,
    fontWeight: '700',
  },
  deliveryStatusSuccess: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emeraldGreen,
    marginTop: 2,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyStateIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyStateDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: height * 0.85,
  },
  modalIndicator: {
    width: 36,
    height: 4,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  shiftSelectorCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  shiftSelectorText: {
    fontWeight: '600',
    fontSize: 14,
  },
  sosOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  sosOptionCard: {
    width: '48%',
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  sosOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoPickerBtn: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  formTextInput: {
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 50,
  },
  closeModalBtn: {
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  tutorialCard: {
    padding: 24,
    width: '100%',
  },
  tutorialBadge: {
    color: COLORS.emeraldGreen,
    fontSize: 11,
    fontWeight: '800',
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  tutorialDesc: {
    fontSize: 14,
    marginTop: 12,
    lineHeight: 22,
  },
  tutorialBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tutorialNextBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});