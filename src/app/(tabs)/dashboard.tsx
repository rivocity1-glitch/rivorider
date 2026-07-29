// src/app/(tabs)/dashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getUnreadNotificationCount } from '../../services/notifications';
import { getAssignedVendors, getCurrentRiderProfile, updateAvailabilityStatus } from '../../services/rider';

const { height } = Dimensions.get('window');

const COLORS = {
  emeraldGreen: '#10B981',
  emeraldLight: '#ECFDF5',
  jetBlack: '#0B0F19',
  white: '#FFFFFF',
  offWhite: '#F8FAFC',
  borderLight: '#E2E8F0',
  textMuted: '#64748B',
  danger: '#EF4444',
  cardBg: '#FFFFFF',
  amberBgLight: '#FFFBEB',
  amberBorderLight: '#F59E0B',
  amberTextLight: '#92400E',
  blueBg: '#EFF6FF',
  blueBorder: '#3B82F6',
  blueText: '#1E40AF',
};

// 4-Hour Fixed Slots with Motivating Titles
interface SlotTemplate {
  id: string;
  name: string;
  subtitle: string;
  startHour: number;
  endHour: number;
}

const SHIFT_TEMPLATES: SlotTemplate[] = [
  { id: '1', name: '🌅 Morning Hustle', subtitle: 'Breakfast & Early Rush', startHour: 6, endHour: 10 },
  { id: '2', name: '🚀 Peak Conqueror', subtitle: 'Prime Lunch Demand', startHour: 10, endHour: 14 },
  { id: '3', name: '🔥 Unstoppable Momentum', subtitle: 'Tea & Evening Snack Orders', startHour: 14, endHour: 18 },
  { id: '4', name: '⭐ Night Champion', subtitle: 'Dinner Peak Orders', startHour: 18, endHour: 22 },
  { id: '5', name: '🌙 Midnight Legend', subtitle: 'Late Night Cravings', startHour: 22, endHour: 2 },
];

type IncidentTypeKey =
  | 'Accident'
  | 'Road Block'
  | 'Out of Fuel'
  | 'Vehicle Breakdown'
  | 'Need Assistance'
  | 'Other';

interface IncidentCard {
  type: IncidentTypeKey;
  title: string;
  desc: string;
  icon: string;
}

const INCIDENT_TYPES: IncidentCard[] = [
  { type: 'Accident', title: 'Accident', desc: 'Vehicle collision or injury', icon: '🚑' },
  { type: 'Road Block', title: 'Road Block', desc: 'Road closed or blocked', icon: '🚧' },
  { type: 'Out of Fuel', title: 'Out of Fuel', desc: 'Fuel exhausted', icon: '⛽' },
  { type: 'Vehicle Breakdown', title: 'Vehicle Breakdown', desc: 'Mechanical issue', icon: '🔧' },
  { type: 'Need Assistance', title: 'Need Assistance', desc: 'General help required', icon: '🆘' },
  { type: 'Other', title: 'Other Issue', desc: 'Describe another issue', icon: '❓' },
];

type SosModalView = 'SELECT_INCIDENT' | 'INCIDENT_FORM' | 'ACTIVE_SOS';

export default function DashboardScreen() {
  const router = useRouter();
  const [rider, setRider] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [scheduledShifts, setScheduledShifts] = useState<any[]>([]);
  const [dueReservedShift, setDueReservedShift] = useState<any>(null);

  const [vendors, setVendors] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorProfile, setErrorProfile] = useState<boolean>(false);

  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const bellScale = useRef(new Animated.Value(1)).current;

  // Calendar & Shift Modal
  const [shiftModalVisible, setShiftModalVisible] = useState<boolean>(false);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = Today, 1 = Tomorrow, 2 = Day After Tomorrow
  const [shiftTimeRemaining, setShiftTimeRemaining] = useState<number>(0);
  const [restTimeRemaining, setRestTimeRemaining] = useState<number>(0);

  // SOS States
  const [sosModalVisible, setSosModalVisible] = useState<boolean>(false);
  const [sosModalView, setSosModalView] = useState<SosModalView>('SELECT_INCIDENT');
  const [selectedSosOption, setSelectedSosOption] = useState<IncidentCard | null>(null);
  const [attachedPhotoUri, setAttachedPhotoUri] = useState<string | null>(null);
  const [customInputText, setCustomInputText] = useState<string>('');
  const [activeSosReport, setActiveSosReport] = useState<any>(null);
  const [currentGps, setCurrentGps] = useState<any>(null);

  const [greeting, setGreeting] = useState({ text: '', subtitle: '', icon: '' });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const onlineBtnScale = useRef(new Animated.Value(1)).current;

  const riderRef = useRef<any>(null);
  const dashboardChannelRef = useRef<any>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    riderRef.current = rider;
  }, [rider]);

  const debouncedReloadDashboard = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchUnreadCount();
      loadDashboardData(true);
    }, 400);
  }, []);

  const updateGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) {
      setGreeting({ text: 'Good Morning', subtitle: "Ready to conquer today's deliveries?", icon: '👋' });
    } else if (hours >= 12 && hours < 17) {
      setGreeting({ text: 'Good Afternoon', subtitle: 'Keep the momentum going strong.', icon: '☀️' });
    } else if (hours >= 17 && hours < 21) {
      setGreeting({ text: 'Good Evening', subtitle: "Finish today's shifts on a high note.", icon: '🌇' });
    } else {
      setGreeting({ text: 'Good Night', subtitle: 'Drive safely and rest up.', icon: '🌙' });
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const res: any = await getUnreadNotificationCount(user.id, 'rider');
        if (res && res.success && typeof res.data === 'number') {
          setUnreadNotificationsCount(res.data);
        } else if (typeof res === 'number') {
          setUnreadNotificationsCount(res);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    updateGreeting();
    loadDashboardData();
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  // Realtime Subscriptions
  useEffect(() => {
    if (!rider?.id) return;
    const riderId = rider.id;

    if (dashboardChannelRef.current) supabase.removeChannel(dashboardChannelRef.current);

    const channel = supabase
      .channel(`public:dashboard:rider:${riderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => debouncedReloadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_shifts' }, () => debouncedReloadDashboard())
      .subscribe();

    dashboardChannelRef.current = channel;

    return () => {
      if (dashboardChannelRef.current) supabase.removeChannel(dashboardChannelRef.current);
    };
  }, [rider?.id, debouncedReloadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      calculateShiftAndRestTimers();
    }, 1000);
    return () => clearInterval(interval);
  }, [activeShift, scheduledShifts]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
      if (rider?.id) {
        getCurrentRiderProfile().then((profileData) => {
          if (profileData) handleKycSafetySync(profileData);
        });
      }
    }, [rider?.id])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    updateGreeting();
    await fetchUnreadCount();
    await loadDashboardData(true);
    setRefreshing(false);
  }, []);

  const handleKycSafetySync = async (profileData: any) => {
    const isOnline = profileData.availability_status?.toLowerCase() === 'available';
    if (isOnline && profileData.kyc_status !== 'verified') {
      try {
        const updated = await updateAvailabilityStatus('offline');
        if (updated) {
          setRider(updated);
          return;
        }
      } catch (err) {
        console.error(err);
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

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: todayOrders } = await supabase
        .from('orders')
        .select('rider_earning')
        .eq('rider_id', profileData.id)
        .ilike('order_status', 'delivered')
        .gte('created_at', startOfDay.toISOString());

      const earningsToday = (todayOrders || []).reduce((sum, o) => sum + (Number(o.rider_earning) || 0), 0);

      const { data: totalOrders } = await supabase
        .from('orders')
        .select('rider_earning')
        .eq('rider_id', profileData.id)
        .ilike('order_status', 'delivered');

      const totalEarnings = (totalOrders || []).reduce((sum, o) => sum + (Number(o.rider_earning) || 0), 0);

      const enhancedProfile = {
        ...profileData,
        earnings_today: earningsToday,
        orders_completed: todayOrders?.length || 0,
        total_earnings: totalEarnings,
      };

      await handleKycSafetySync(enhancedProfile);

      // Load Active Shift
      const { data: shiftData } = await supabase
        .from('rider_shifts')
        .select('*')
        .eq('rider_id', profileData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (shiftData && shiftData.length > 0) {
        setActiveShift(shiftData[0]);
      } else {
        setActiveShift(null);
      }

      // Load Scheduled Future Shifts
      const { data: scheduled } = await supabase
        .from('rider_shifts')
        .select('*')
        .eq('rider_id', profileData.id)
        .eq('status', 'scheduled')
        .order('shift_start', { ascending: true });

      setScheduledShifts(scheduled || []);

      // Check if any scheduled shift is due right now
      const now = new Date();
      const due = (scheduled || []).find((s) => new Date(s.shift_start) <= now && new Date(s.shift_end) > now);
      setDueReservedShift(due || null);

      const isRiderOnline = profileData.availability_status?.toLowerCase() === 'available';
      const isFullyEligible = isRiderOnline && !!shiftData?.[0];

      const vendorsData = await getAssignedVendors();
      const enhancedVendors = await Promise.all(
        (vendorsData || []).map(async (v: any) => {
          if (!isFullyEligible) return { ...v, pendingOrdersCount: 0 };
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

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('rider_id', profileData.id)
        .order('created_at', { ascending: false });
      setReviews(reviewsData || []);

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

  function calculateShiftAndRestTimers() {
    const now = new Date().getTime();

    if (activeShift && activeShift.status === 'active') {
      const end = new Date(activeShift.shift_end).getTime();
      if (now < end) {
        setShiftTimeRemaining(Math.max(0, Math.floor((end - now) / 1000)));
      } else {
        setShiftTimeRemaining(0);
        triggerAutoShiftCompletion();
      }
    } else {
      setShiftTimeRemaining(0);
    }

    if (activeShift?.rest_start) {
      const restEnd = new Date(activeShift.rest_start).getTime() + 10 * 60 * 1000;
      if (now < restEnd) {
        setRestTimeRemaining(Math.max(0, Math.floor((restEnd - now) / 1000)));
      } else {
        setRestTimeRemaining(0);
      }
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
          rest_start: now.toISOString(),
          status: 'completed',
        })
        .eq('id', activeShift.id);

      setActiveShift(null);
      await loadDashboardData(true);
    } catch (error) {
      console.error(error);
    }
  }

  // Handle Select / Reserve Shift Slot
  async function handleReserveShiftSlot(template: SlotTemplate, dateOffset: number) {
    if (rider?.kyc_status !== 'verified') {
      alert('Complete your KYC verification first.');
      return;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dateOffset);

    const start = new Date(targetDate);
    start.setHours(template.startHour, 0, 0, 0);

    const end = new Date(targetDate);
    if (template.endHour < template.startHour) {
      end.setDate(end.getDate() + 1);
    }
    end.setHours(template.endHour, 0, 0, 0);

    const isToday = dateOffset === 0;

    try {
      const { error } = await supabase
        .from('rider_shifts')
        .insert({
          rider_id: rider.id,
          shift_start: start.toISOString(),
          shift_end: end.toISOString(),
          status: isToday ? 'active' : 'scheduled',
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      setShiftModalVisible(false);
      Alert.alert(
        isToday ? 'Shift Started!' : 'Shift Reserved!',
        isToday
          ? `You have started ${template.name}.`
          : `Reserved ${template.name} for ${getFormattedDayLabel(dateOffset)}.`
      );
      await loadDashboardData(true);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Booking Failed', err.message || 'Slot conflict or network issue.');
    }
  }

  function promptEndShiftConfirmation() {
    Alert.alert(
      'End Shift Early?',
      'Are you sure you want to end your current shift? You will enter a 10-minute rest window before booking your next shift.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift',
          style: 'destructive',
          onPress: async () => {
            await handleEndShiftEarly();
          },
        },
      ]
    );
  }

  async function handleEndShiftEarly() {
    if (!activeShift || activeShift.status !== 'active') return;
    try {
      const now = new Date();
      await supabase
        .from('rider_shifts')
        .update({
          shift_end: now.toISOString(),
          rest_start: now.toISOString(),
          status: 'completed',
        })
        .eq('id', activeShift.id);

      setActiveShift(null);
      setShiftTimeRemaining(0);
      await loadDashboardData(true);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleStartReservedShift(shiftId: string) {
    try {
      const now = new Date();
      await supabase
        .from('rider_shifts')
        .update({ status: 'active', shift_start: now.toISOString() })
        .eq('id', shiftId);

      setDueReservedShift(null);
      await loadDashboardData(true);
      Alert.alert('Shift Active!', 'Your reserved shift is now live. Safe driving!');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCancelReservedShift(shiftId: string) {
    try {
      await supabase.from('rider_shifts').delete().eq('id', shiftId);
      setDueReservedShift(null);
      await loadDashboardData(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleAvailability() {
    if (!rider) return;
    if (rider.kyc_status !== 'verified') {
      alert('Complete KYC verification first.');
      return;
    }

    Animated.sequence([
      Animated.timing(onlineBtnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(onlineBtnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
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

  async function pickImageAttachment() {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      alert('Camera permissions are required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 });
    if (!result.canceled) setAttachedPhotoUri(result.assets[0].uri);
  }

  async function captureGpsLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        location_accuracy: loc.coords.accuracy ?? null,
        timestamp: new Date(loc.timestamp).toISOString(),
      };
      setCurrentGps(coords);
      return coords;
    } catch (err) {
      return null;
    }
  }

  async function handleSosOpen() {
    if (!rider?.id) return;
    setSosModalVisible(true);
    const { data } = await supabase
      .from('rider_emergency_reports')
      .select('*')
      .eq('rider_id', rider.id)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setActiveSosReport(data[0]);
      setSosModalView('ACTIVE_SOS');
    } else {
      setSosModalView('SELECT_INCIDENT');
      captureGpsLocation();
    }
  }

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFormattedDayLabel = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isSlotAlreadyReserved = (template: SlotTemplate, offset: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offset);

    return scheduledShifts.some((s) => {
      const shiftDate = new Date(s.shift_start);
      return (
        shiftDate.getDate() === targetDate.getDate() &&
        shiftDate.getMonth() === targetDate.getMonth() &&
        shiftDate.getHours() === template.startHour
      );
    });
  };

  if (errorProfile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Sync Interrupted</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.errorButton}>
          <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Login Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAvailable = rider?.availability_status?.toLowerCase() === 'available';
  const hasShift = !!activeShift;
  const isFullyEligible = isAvailable && hasShift;
  const averageRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : rider?.rating || '5.0';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>{greeting.icon} {greeting.text}</Text>
            <Text style={styles.riderName}>{loading ? 'Loading...' : (rider?.rider_name || 'Rivo Partner')}</Text>
            <Text style={styles.riderSubtitle}>{greeting.subtitle}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/notifications')}>
              <Animated.View style={[styles.bellContainer, { transform: [{ scale: bellScale }] }]}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.jetBlack} />
                {unreadNotificationsCount > 0 && <View style={styles.badgeIndicator} />}
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/profile')}>
              {rider?.profile_photo_url ? (
                <Image source={{ uri: rider.profile_photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{(rider?.rider_name || 'R').substring(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.emeraldGreen} colors={[COLORS.emeraldGreen]} />}
      >
        <Animated.View style={{ padding: 16, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* 1. DUE RESERVED SHIFT ALERT BANNER */}
          {dueReservedShift && (
            <View style={styles.reservedAlertBanner}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>⏰</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reservedAlertTitle}>Your Reserved Shift is Ready!</Text>
                <Text style={styles.reservedAlertSub}>You reserved a shift for right now. Do you want to start now?</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity onPress={() => handleStartReservedShift(dueReservedShift.id)} style={styles.btnStartNow}>
                    <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12 }}>Start Shift Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleCancelReservedShift(dueReservedShift.id)} style={styles.btnCancelShift}>
                    <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* 2. OPERATIONAL STATUS PILL */}
          <Animated.View style={{ transform: [{ scale: onlineBtnScale }], marginBottom: 14 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={toggleAvailability}
              style={[
                styles.statusLargePill,
                {
                  backgroundColor: isFullyEligible ? COLORS.emeraldLight : isAvailable ? COLORS.amberBgLight : COLORS.offWhite,
                  borderColor: isFullyEligible ? COLORS.emeraldGreen : isAvailable ? COLORS.amberBorderLight : COLORS.borderLight,
                },
              ]}
            >
              <View style={[styles.statusIndicatorDot, { backgroundColor: isFullyEligible ? COLORS.emeraldGreen : isAvailable ? COLORS.amberBorderLight : '#9CA3AF' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusPillTitle, { color: isFullyEligible ? '#065F46' : isAvailable ? COLORS.amberTextLight : COLORS.jetBlack }]}>
                  {isFullyEligible ? '🟢 Online — Shift Active' : isAvailable ? '🟡 Online — No Active Shift' : '⚫ Offline'}
                </Text>
                <Text style={styles.statusPillSubtitle}>
                  {isFullyEligible ? 'Receiving Delivery Requests' : isAvailable ? 'Select or reserve a shift to get orders' : 'Tap to go Online'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* 3. SHIFT EXTENSION PROMPT (<= 30 MIN REMAINING) */}
          {shiftTimeRemaining > 0 && shiftTimeRemaining <= 1800 && (
            <View style={styles.extensionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.extensionTitle}>⚡ Shift Ending in {Math.ceil(shiftTimeRemaining / 60)} Mins!</Text>
                <Text style={styles.extensionSub}>Want to keep working? Reserve the next shift slot now!</Text>
              </View>
              <TouchableOpacity onPress={() => setShiftModalVisible(true)} style={styles.extensionBtn}>
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12 }}>Reserve Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 4. POST-SHIFT REST TIMER */}
          {restTimeRemaining > 0 && !activeShift && (
            <View style={styles.restCard}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>☕</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.restTitle}>10-Minute Rest Window</Text>
                <Text style={styles.restSub}>Take a breather before your next slot ({formatTimer(restTimeRemaining)})</Text>
              </View>
              <TouchableOpacity onPress={() => setShiftModalVisible(true)} style={styles.restBtn}>
                <Text style={{ color: COLORS.blueText, fontWeight: '700', fontSize: 12 }}>Book Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 5. METRICS SUMMARY GRID */}
          <View style={styles.gridContainer}>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>💰 Today's Earnings</Text>
              <Text style={[styles.metricValue, { color: COLORS.emeraldGreen }]}>₹{rider?.earnings_today || 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>📦 Today's Orders</Text>
              <Text style={styles.metricValue}>{rider?.orders_completed || 0}</Text>
            </View>
          </View>

          <View style={styles.gridContainer}>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>💼 Lifetime Earnings</Text>
              <Text style={styles.metricValue}>₹{rider?.total_earnings || 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>⭐ Rating</Text>
              <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{averageRating} / 5.0</Text>
            </View>
          </View>

          {/* 6. CURRENT SHIFT CARD */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⏱️ Active Shift Status</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
              <View>
                <Text style={styles.metricLabel}>Shift Time Remaining</Text>
                <Text style={[styles.timerText, { color: shiftTimeRemaining > 0 ? COLORS.emeraldGreen : COLORS.jetBlack }]}>
                  {shiftTimeRemaining > 0 ? formatTimer(shiftTimeRemaining) : '00:00:00'}
                </Text>
              </View>

              {shiftTimeRemaining > 0 ? (
                <TouchableOpacity onPress={promptEndShiftConfirmation} style={[styles.actionBtn, { backgroundColor: COLORS.danger }]}>
                  <Text style={styles.actionBtnText}>End Shift</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setShiftModalVisible(true)} style={[styles.actionBtn, { backgroundColor: COLORS.emeraldGreen }]}>
                  <Text style={styles.actionBtnText}>Select / Reserve Shift</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 7. UPCOMING RESERVED SHIFTS */}
          {scheduledShifts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📅 Reserved Upcoming Shifts</Text>
              {scheduledShifts.map((s) => (
                <View key={s.id} style={styles.reservedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reservedShiftTime}>
                      {new Date(s.shift_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                      {new Date(s.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(s.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleCancelReservedShift(s.id)}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* 8. ASSIGNED VENDORS */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🏪 Assigned  Stores</Text>
            {vendors.length > 0 ? (
              vendors.map((vendor) => (
                <View key={vendor.id} style={styles.vendorRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vendorName}>{vendor.shop_name || 'Fulfillment Point'}</Text>
                    <Text style={styles.vendorStatusTag}>🟢 Open for Dispatch</Text>
                  </View>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>{vendor.pendingOrdersCount || 0} Orders</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 8 }}>No assigned stores currently active.</Text>
            )}
          </View>

          {/* 9. RECENT DELIVERIES */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📋 Recent Completed Deliveries</Text>
            {recentDeliveries.length > 0 ? (
              recentDeliveries.map((delivery) => (
                <View key={delivery.id} style={styles.deliveryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveryNumber}>#{delivery.order_number || delivery.id.substring(0, 8)}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{delivery.vendor?.shop_name}</Text>
                  </View>
                  <Text style={styles.deliveryAmount}>+₹{delivery.total_amount || 0}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 8 }}>No recent deliveries yet.</Text>
            )}
          </View>

          {/* 10. EMERGENCY SOS */}
          <View style={[styles.card, { borderColor: COLORS.danger }]}>
            <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>🚨 Emergency SOS Support</Text>
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginVertical: 8 }}>
              Quickly dispatch road blockages, vehicle breakdowns, or collision incidents to support.
            </Text>
            <TouchableOpacity onPress={handleSosOpen} style={[styles.actionBtn, { backgroundColor: COLORS.danger, alignItems: 'center' }]}>
              <Text style={styles.actionBtnText}>Open SOS Panel</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      {/* CALENDAR SHIFT RESERVATION MODAL */}
      <Modal animationType="slide" transparent={true} visible={shiftModalVisible} onRequestClose={() => setShiftModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShiftModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Reserve Shift Calendar</Text>
            <Text style={styles.modalSubtitle}>Book shifts up to 2 days in advance (4-hour slots).</Text>

            {/* 3-DAY SELECTOR TABS */}
            <View style={styles.dayTabContainer}>
              {[0, 1, 2].map((offset) => (
                <TouchableOpacity
                  key={offset}
                  onPress={() => setSelectedDayOffset(offset)}
                  style={[styles.dayTab, selectedDayOffset === offset && styles.dayTabActive]}
                >
                  <Text style={[styles.dayTabLabel, selectedDayOffset === offset && styles.dayTabLabelActive]}>
                    {getFormattedDayLabel(offset)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SLOT TEMPLATES LIST */}
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, marginVertical: 8 }}>
                {SHIFT_TEMPLATES.map((slot) => {
                  const isReserved = isSlotAlreadyReserved(slot, selectedDayOffset);
                  const isToday = selectedDayOffset === 0;

                  return (
                    <TouchableOpacity
                      key={slot.id}
                      disabled={isReserved}
                      onPress={() => handleReserveShiftSlot(slot, selectedDayOffset)}
                      style={[styles.shiftTemplateCard, isReserved && { opacity: 0.6 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shiftTemplateTitle}>{slot.name}</Text>
                        <Text style={styles.shiftTemplateSub}>{slot.subtitle}</Text>
                        <Text style={styles.shiftTimeRange}>
                          {slot.startHour.toString().padStart(2, '0')}:00 – {slot.endHour.toString().padStart(2, '0')}:00
                        </Text>
                      </View>
                      <View style={[styles.reserveBadge, isReserved && { backgroundColor: '#9CA3AF' }, isToday && !isReserved && { backgroundColor: COLORS.emeraldGreen }]}>
                        <Text style={styles.reserveBadgeText}>
                          {isReserved ? 'Reserved' : isToday ? 'Start Shift' : 'Reserve Slot'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SOS MODAL */}
      <Modal animationType="slide" transparent={true} visible={sosModalVisible} onRequestClose={() => setSosModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSosModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>🚨 Incident Emergency Support</Text>

            {sosModalView === 'SELECT_INCIDENT' && (
              <ScrollView style={{ maxHeight: 360 }}>
                <View style={{ gap: 10, marginTop: 12 }}>
                  {INCIDENT_TYPES.map((item) => (
                    <TouchableOpacity
                      key={item.type}
                      onPress={() => {
                        setSelectedSosOption(item);
                        setSosModalView('INCIDENT_FORM');
                      }}
                      style={styles.incidentRow}
                    >
                      <Text style={{ fontSize: 24, marginRight: 12 }}>{item.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14 }}>{item.title}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{item.desc}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {sosModalView === 'INCIDENT_FORM' && selectedSosOption && (
              <View style={{ paddingVertical: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8 }}>{selectedSosOption.icon} {selectedSosOption.title}</Text>
                <TextInput
                  style={styles.sosInput}
                  placeholder="Describe emergency details..."
                  placeholderTextColor={COLORS.textMuted}
                  value={customInputText}
                  onChangeText={setCustomInputText}
                  multiline
                />
                <TouchableOpacity onPress={pickImageAttachment} style={styles.photoPickerBtn}>
                  <Text style={{ fontWeight: '700', color: COLORS.jetBlack, fontSize: 12 }}>
                    {attachedPhotoUri ? '✅ Evidence Photo Attached' : '📷 Add Proof Photo'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSosModalVisible(false)}
                  style={[styles.actionBtn, { backgroundColor: COLORS.danger, marginTop: 12, alignItems: 'center' }]}
                >
                  <Text style={styles.actionBtnText}>Send SOS Alert</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.offWhite,
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    color: COLORS.emeraldGreen,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  riderName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.jetBlack,
  },
  riderSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.emeraldGreen,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.emeraldGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  bellContainer: {
    padding: 4,
    position: 'relative',
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
  statusLargePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusPillTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusPillSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  reservedAlertBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.blueBg,
    borderColor: COLORS.blueBorder,
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  reservedAlertTitle: {
    fontWeight: '800',
    fontSize: 14,
    color: COLORS.blueText,
  },
  reservedAlertSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  btnStartNow: {
    backgroundColor: COLORS.blueBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnCancelShift: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  extensionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.amberBgLight,
    borderColor: COLORS.amberBorderLight,
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  extensionTitle: {
    fontWeight: '800',
    fontSize: 13,
    color: COLORS.amberTextLight,
  },
  extensionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  extensionBtn: {
    backgroundColor: COLORS.amberBorderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  restCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blueBg,
    borderColor: COLORS.blueBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: 16,
    marginBottom: 14,
  },
  restTitle: {
    fontWeight: '800',
    fontSize: 13,
    color: COLORS.blueText,
  },
  restSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  restBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.jetBlack,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  timerText: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  actionBtn: {
    paddingHorizontal: 16,
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
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    color: COLORS.jetBlack,
  },
  reservedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  reservedShiftTime: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.jetBlack,
  },
  vendorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.jetBlack,
  },
  vendorStatusTag: {
    fontSize: 11,
    color: COLORS.emeraldGreen,
    fontWeight: '600',
    marginTop: 2,
  },
  orderBadge: {
    backgroundColor: COLORS.offWhite,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  deliveryNumber: {
    fontWeight: '700',
    fontSize: 14,
  },
  deliveryAmount: {
    fontWeight: '800',
    color: COLORS.emeraldGreen,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: height * 0.8,
  },
  modalIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.jetBlack,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  dayTabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dayTabActive: {
    backgroundColor: COLORS.emeraldGreen,
    borderColor: COLORS.emeraldGreen,
  },
  dayTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  dayTabLabelActive: {
    color: COLORS.white,
  },
  shiftTemplateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.offWhite,
  },
  shiftTemplateTitle: {
    fontWeight: '800',
    fontSize: 14,
    color: COLORS.jetBlack,
  },
  shiftTemplateSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  shiftTimeRange: {
    fontSize: 11,
    color: COLORS.emeraldGreen,
    fontWeight: '700',
    marginTop: 4,
  },
  reserveBadge: {
    backgroundColor: COLORS.blueBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reserveBadgeText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sosInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
  },
  photoPickerBtn: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    marginTop: 10,
  },
});