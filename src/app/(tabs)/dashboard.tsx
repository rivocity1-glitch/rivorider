// src/app/(tabs)/dashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
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

// Shift Schedule Definitions
interface ScheduleShift {
  id: string;
  name: string;
  timeLabel: string;
  startHour: number;
  endHour: number;
  durationHours: number;
}

const SHIFT_SCHEDULE: ScheduleShift[] = [
  { id: '1', name: 'Morning', timeLabel: '06:00 AM - 12:00 PM', startHour: 6, endHour: 12, durationHours: 6 },
  { id: '2', name: 'Afternoon', timeLabel: '12:00 PM - 06:00 PM', startHour: 12, endHour: 18, durationHours: 6 },
  { id: '3', name: 'Evening', timeLabel: '06:00 PM - 12:00 AM', startHour: 18, endHour: 24, durationHours: 6 },
];

type ShiftStatus = 'Upcoming' | 'Available Now' | 'Completed';

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

// Essential Emergency Helplines for Direct Calling
const EMERGENCY_HELPLINES = [
  { label: 'National Emergency', number: '112', icon: '🚨', subtitle: 'All-in-one Response' },
  { label: 'Ambulance & Medical', number: '108', icon: '🚑', subtitle: 'Medical Emergency' },
  { label: 'Police Control', number: '100', icon: '👮', subtitle: 'Immediate Assistance' },
  { label: 'Fire Department', number: '101', icon: '🔥', subtitle: 'Fire Emergency' },
  { label: 'Women Helpline', number: '181', icon: '👮', subtitle: 'Immediate Assistance' },
];

// Dropdown Constants
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric'];

const BREAKDOWN_TYPES = [
  "Engine won't start",
  'Tyre puncture',
  'Chain issue',
  'Clutch issue',
  'Brake issue',
  'Battery issue',
  'Overheating',
  'Bike suddenly stopped',
  'Other',
];

const ASSISTANCE_TYPES = [
  'Medical assistance',
  'Police assistance',
  'Vehicle towing',
  'Flat tyre help',
  'Battery jump start',
  'Fuel delivery',
  'Need another rider',
  'Other',
];

type SosModalView = 'SELECT_INCIDENT' | 'INCIDENT_FORM' | 'ACTIVE_SOS' | 'HISTORY_LIST' | 'HISTORY_DETAIL';

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
  const [shiftTimeRemaining, setShiftTimeRemaining] = useState<number>(0);
  const [showExtensionModal, setShowExtensionModal] = useState<boolean>(false);
  const [hasExtendedCurrentShift, setHasExtendedCurrentShift] = useState<boolean>(false);

  // --- SOS MODAL INTERNAL STATE MANAGEMENT ---
  const [sosModalVisible, setSosModalVisible] = useState<boolean>(false);
  const [sosModalView, setSosModalView] = useState<SosModalView>('SELECT_INCIDENT');
  const [selectedSosOption, setSelectedSosOption] = useState<IncidentCard | null>(null);
  const [attachedPhotoUri, setAttachedPhotoUri] = useState<string | null>(null);
  const [uploadingSos, setUploadingSos] = useState<boolean>(false);
  const [sosSuccess, setSosSuccess] = useState<boolean>(false);

  // Extended SOS Form Field States
  const [accidentTarget, setAccidentTarget] = useState<'I had an accident' | 'Someone else had an accident' | null>(null);
  const [fuelType, setFuelType] = useState<string | null>(null);
  const [breakdownType, setBreakdownType] = useState<string | null>(null);
  const [assistanceType, setAssistanceType] = useState<string | null>(null);
  const [customInputText, setCustomInputText] = useState<string>('');

  // Active Unresolved SOS Report Data
  const [activeSosReport, setActiveSosReport] = useState<any>(null);

  // SOS History States
  const [sosHistoryList, setSosHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<any | null>(null);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);

  const [currentGps, setCurrentGps] = useState<{
    latitude: number;
    longitude: number;
    location_accuracy: number | null;
    timestamp: string;
  } | null>(null);
  const [activeOrderContext, setActiveOrderContext] = useState<any>(null);

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

  // Realtime & Debounce references
  const riderRef = useRef<any>(null);
  const dashboardChannelRef = useRef<any>(null);
  const sosChannelRef = useRef<any>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    riderRef.current = rider;
  }, [rider]);

  const theme = {
    bg: isDarkMode ? COLORS.jetBlack : COLORS.offWhite,
    cardBg: isDarkMode ? COLORS.darkCard : COLORS.white,
    text: isDarkMode ? COLORS.white : COLORS.jetBlack,
    textMuted: isDarkMode ? COLORS.darkMuted : COLORS.textMuted,
    border: isDarkMode ? COLORS.darkBorder : COLORS.borderLight,
    headerBg: isDarkMode ? COLORS.darkCard : COLORS.white,
  };

  const getShiftStatus = (shift: ScheduleShift): ShiftStatus => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    if (currentHour < shift.startHour) {
      return 'Upcoming';
    } else if (currentHour >= shift.startHour && currentHour < shift.endHour) {
      return 'Available Now';
    } else {
      return 'Completed';
    }
  };

  const debouncedReloadDashboard = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchUnreadCount();
      loadDashboardData(true);
    }, 400);
  }, []);

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

  const makeEmergencyCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      alert(`Unable to make call to ${phoneNumber}. Please dial manually.`);
    });
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

  // Dashboard Realtime Subscriptions
  useEffect(() => {
    if (!rider?.id) return;

    const riderId = rider.id;

    if (dashboardChannelRef.current) {
      supabase.removeChannel(dashboardChannelRef.current);
      dashboardChannelRef.current = null;
    }

    const channel = supabase
      .channel(`public:dashboard:rider:${riderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          try {
            const newRiderId = payload.new ? (payload.new as any).rider_id : null;
            const oldRiderId = payload.old ? (payload.old as any).rider_id : null;
            const activeId = riderRef.current?.id;

            if (newRiderId === activeId || oldRiderId === activeId) {
              debouncedReloadDashboard();
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rider_shifts' },
        (payload) => {
          try {
            const shiftRiderId = payload.new
              ? (payload.new as any).rider_id
              : payload.old
              ? (payload.old as any).rider_id
              : null;
            const activeId = riderRef.current?.id;

            if (shiftRiderId === activeId) {
              debouncedReloadDashboard();
            }
          } catch (e) {
            console.error(e);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          debouncedReloadDashboard();
        }
      )
      .subscribe();

    dashboardChannelRef.current = channel;

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (dashboardChannelRef.current) {
        supabase.removeChannel(dashboardChannelRef.current);
        dashboardChannelRef.current = null;
      }
    };
  }, [rider?.id, debouncedReloadDashboard]);

  // SOS Realtime Subscription
  useEffect(() => {
    if (!rider?.id) return;

    const riderId = rider.id;

    if (sosChannelRef.current) {
      supabase.removeChannel(sosChannelRef.current);
      sosChannelRef.current = null;
    }

    const channel = supabase
      .channel(`public:rider_emergency_reports:rider:${riderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rider_emergency_reports',
          filter: `rider_id=eq.${riderId}`,
        },
        (payload) => {
          const updatedReport = payload.new as any;
          if (!updatedReport) return;

          if (
            !updatedReport.resolved_at &&
            !['completed', 'resolved', 'cancelled'].includes(updatedReport.status?.toLowerCase())
          ) {
            setActiveSosReport(updatedReport);
          } else {
            setActiveSosReport((prev: any) => (prev?.id === updatedReport.id ? null : prev));
          }

          setSosHistoryList((prevList) => {
            const exists = prevList.some((r) => r.id === updatedReport.id);
            if (exists) {
              return prevList.map((r) => (r.id === updatedReport.id ? updatedReport : r));
            }
            return [updatedReport, ...prevList];
          });

          setSelectedHistoryReport((prevSelected: any) => {
            if (prevSelected && prevSelected.id === updatedReport.id) {
              return updatedReport;
            }
            return prevSelected;
          });
        }
      )
      .subscribe();

    sosChannelRef.current = channel;

    return () => {
      if (sosChannelRef.current) {
        supabase.removeChannel(sosChannelRef.current);
        sosChannelRef.current = null;
      }
    };
  }, [rider?.id]);

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
        console.error(err);
      }
    }
    setRider(profileData);
  };

  async function checkActiveUnresolvedSos(riderId: string) {
    try {
      const { data, error } = await supabase
        .from('rider_emergency_reports')
        .select('*')
        .eq('rider_id', riderId)
        .is('resolved_at', null)
        .not('status', 'in', '("completed","resolved","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking active unresolved SOS:', error);
        return null;
      }

      if (data && data.length > 0) {
        return data[0];
      }
      return null;
    } catch (e) {
      console.error('Unexpected error checking SOS:', e);
      return null;
    }
  }

  async function fetchSosHistory(riderId: string) {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from('rider_emergency_reports')
        .select('*')
        .eq('rider_id', riderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSosHistoryList(data || []);
    } catch (err: any) {
      console.error('Failed to load SOS history:', err);
      setHistoryError(err.message || 'Unable to load SOS history.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function resolveSignedPhotoUrl(photoPath: string | null) {
    if (!photoPath) {
      setSignedPhotoUrl(null);
      return;
    }

    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      setSignedPhotoUrl(photoPath);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('rider-sos')
        .createSignedUrl(photoPath, 3600);

      if (error) throw error;
      setSignedPhotoUrl(data?.signedUrl || null);
    } catch (err) {
      console.error('Error generating signed URL:', err);
      setSignedPhotoUrl(null);
    }
  }

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
        .select('rider_earning, updated_at, created_at')
        .eq('rider_id', profileData.id)
        .ilike('order_status', 'delivered')
        .gte('created_at', startOfDay.toISOString());

      const earningsToday = (todayOrders || []).reduce((sum, o) => sum + (Number(o.rider_earning) || 0), 0);
      const ordersCompletedToday = todayOrders?.length || 0;

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

      const isRiderOnline = profileData.availability_status?.toLowerCase() === 'available';
      const isFullyEligible = isRiderOnline && !!currentActiveShift;

      const vendorsData = await getAssignedVendors();
      const enhancedVendors = await Promise.all(
        (vendorsData || []).map(async (v: any) => {
          if (!isFullyEligible) {
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

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, order_number, vendor_id, vendors(shop_name)')
        .eq('rider_id', profileData.id)
        .not('order_status', 'ilike', 'delivered')
        .not('order_status', 'ilike', 'cancel%')
        .limit(1);

      if (activeOrders && activeOrders.length > 0) {
        setActiveOrderContext(activeOrders[0]);
      } else {
        setActiveOrderContext(null);
      }

      const unresolvedReport = await checkActiveUnresolvedSos(profileData.id);
      setActiveSosReport(unresolvedReport);

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

  async function handleSelectShift(shift: ScheduleShift) {
    if (rider?.kyc_status !== 'verified') {
      alert('Complete your KYC verification first.');
      return;
    }

    if (activeShift) {
      alert('You already have an active shift.');
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
          created_at: now.toISOString(),
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
      console.error(error);
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
      alert('Camera permissions are required for emergency evidence verification.');
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

  async function captureGpsLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Location permission is strictly required to send emergency support to your exact coordinates.');
      return null;
    }
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
      console.error('Error fetching GPS coordinates:', err);
      alert('Could not capture current GPS location. Please ensure location services are enabled on your device.');
      return null;
    }
  }

  async function handleSosOpen() {
    if (!rider?.id) return;

    setSosModalVisible(true);

    const unresolved = await checkActiveUnresolvedSos(rider.id);
    setActiveSosReport(unresolved);

    if (unresolved) {
      setSosModalView('ACTIVE_SOS');
    } else {
      setSosModalView('SELECT_INCIDENT');
      captureGpsLocation();
    }
  }

  const isSosFormValid = (): boolean => {
    if (!selectedSosOption) return false;

    switch (selectedSosOption.type) {
      case 'Accident':
        if (!accidentTarget) return false;
        if (accidentTarget === 'Someone else had an accident' && !customInputText.trim()) return false;
        if (!attachedPhotoUri) return false;
        break;
      case 'Road Block':
        if (!attachedPhotoUri) return false;
        break;
      case 'Out of Fuel':
        if (!fuelType) return false;
        break;
      case 'Vehicle Breakdown':
        if (!breakdownType) return false;
        if (breakdownType === 'Other' && !customInputText.trim()) return false;
        break;
      case 'Need Assistance':
        if (!assistanceType) return false;
        if (assistanceType === 'Other' && !customInputText.trim()) return false;
        break;
      case 'Other':
        if (!customInputText.trim()) return false;
        break;
      default:
        break;
    }

    return true;
  };

  async function submitSosReport() {
    if (!selectedSosOption) return;

    if (!isSosFormValid()) {
      alert('Please complete all required fields and upload evidence photo if mandatory.');
      return;
    }

    let gpsCoords = currentGps;
    if (!gpsCoords) {
      gpsCoords = await captureGpsLocation();
      if (!gpsCoords) return;
    }

    setUploadingSos(true);
    try {
      let uploadedStoragePath = '';
      if (attachedPhotoUri) {
        try {
          const response = await fetch(attachedPhotoUri);
          const blob = await response.blob();

          const fileExt = attachedPhotoUri.split('.').pop() || 'jpg';
          const fileName = `${rider.id}/${Date.now()}.${fileExt}`;

          const { data: storageData, error: storageErr } = await supabase.storage
            .from('rider-sos')
            .upload(fileName, blob, {
              contentType: `image/${fileExt}`,
              upsert: true,
            });

          if (storageErr) throw storageErr;
          if (storageData) {
            uploadedStoragePath = storageData.path;
          }
        } catch (uploadErr) {
          console.error('Error uploading photo proof to rider-sos bucket:', uploadErr);
          throw new Error('Failed to upload evidence photo. Please try again.');
        }
      }

      const payload: Record<string, any> = {
        rider_id: rider.id,
        issue_type: selectedSosOption.type,
        description: customInputText.trim() || selectedSosOption.desc,
        photo_url: uploadedStoragePath || null,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        location_accuracy: gpsCoords.location_accuracy,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vendor_id: activeOrderContext?.vendor_id || null,
        vendor_name: activeOrderContext?.vendors?.shop_name || null,
        order_id: activeOrderContext?.id || null,
        order_number: activeOrderContext?.order_number || null,
      };

      if (accidentTarget) payload.accident_target = accidentTarget;
      if (fuelType) payload.fuel_type = fuelType;
      if (breakdownType) payload.breakdown_type = breakdownType;
      if (assistanceType) payload.assistance_type = assistanceType;
      if (customInputText.trim()) payload.custom_description = customInputText.trim();

      const { data: insertedReport, error: insertErr } = await supabase
        .from('rider_emergency_reports')
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setUploadingSos(false);
      setSosSuccess(true);
      setActiveSosReport(insertedReport);

      setTimeout(() => {
        setSosSuccess(false);
        setSosModalView('ACTIVE_SOS');
      }, 2500);
    } catch (e: any) {
      console.error('[SOS Submission Error]:', e);
      alert(e.message || 'Failed to send emergency alert. Please try again or contact dispatch.');
      setUploadingSos(false);
    }
  }

  function resetSosModalState() {
    setSosModalVisible(false);
    setSosModalView('SELECT_INCIDENT');
    setSelectedSosOption(null);
    setAttachedPhotoUri(null);
    setAccidentTarget(null);
    setFuelType(null);
    setBreakdownType(null);
    setAssistanceType(null);
    setCustomInputText('');
    setUploadingSos(false);
    setSosSuccess(false);
    setSelectedHistoryReport(null);
    setSignedPhotoUrl(null);
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

  const getIncidentIcon = (type: string) => {
    const found = INCIDENT_TYPES.find((i) => i.type.toLowerCase() === type?.toLowerCase());
    return found ? found.icon : '🚨';
  };

  const getStatusBadgeStyle = (status: string) => {
    const st = (status || 'pending').toLowerCase();
    switch (st) {
      case 'acknowledged':
        return {
          bg: '#DBEAFE',
          text: '#1E40AF',
          label: 'Acknowledged',
        };
      case 'resolved':
      case 'completed':
        return {
          bg: '#D1FAE5',
          text: '#065F46',
          label: 'Resolved',
        };
      case 'cancelled':
        return {
          bg: '#FEE2E2',
          text: '#991B1B',
          label: 'Cancelled',
        };
      case 'pending':
      default:
        return {
          bg: '#FEF3C7',
          text: '#92400E',
          label: 'Pending',
        };
    }
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
  const hasShift = !!activeShift;
  const isFullyEligible = isAvailable && hasShift;

  const averageRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : rider?.rating || '5.0';

  const tutorialSteps = [
    { title: 'Dashboard V2', desc: 'Monitor metrics, stores, and active shift timers smoothly.' },
    { title: 'Fulfillment Nodes', desc: 'Track live store locations and total assigned pending count.' },
    { title: 'Operational Status', desc: 'Securely switch online or offline to manage incoming dispatches.' },
    { title: 'SOS Emergency Support', desc: 'Report vehicle logs or road barriers instantly to active support.' },
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
                  Animated.timing(bellScale, { toValue: 1, duration: 80, useNativeDriver: true }),
                ]).start(() => {
                  router.push('/notifications');
                });
              }}
            >
              <Animated.View style={[styles.bellContainer, { transform: [{ scale: bellScale }] }]}>
                <Ionicons name="notifications-outline" size={24} color={theme.text} />
                {unreadNotificationsCount > 0 && <View style={styles.badgeIndicator} />}
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Animated.sequence([
                  Animated.timing(avatarScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
                  Animated.timing(avatarScale, { toValue: 1, duration: 80, useNativeDriver: true }),
                ]).start(() => {
                  router.push('/profile');
                });
              }}
            >
              <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
                {!loading &&
                  (rider?.profile_photo_url ? (
                    <Image source={{ uri: rider.profile_photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{getAvatarFallback(rider?.rider_name || '')}</Text>
                    </View>
                  ))}
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
            {/* KYC Alerts */}
            {rider?.kyc_status === 'pending' && (
              <View style={[styles.kycAlertCard, { backgroundColor: isDarkMode ? COLORS.amberBgDark : COLORS.amberBgLight, borderLeftColor: isDarkMode ? COLORS.amberBorderDark : COLORS.amberBorderLight }]}>
                <Text style={[styles.kycAlertTitle, { color: isDarkMode ? COLORS.amberTextDark : COLORS.amberTextLight }]}>🛡️ Verification in Progress</Text>
                <Text style={[styles.kycAlertDesc, { color: isDarkMode ? COLORS.darkMuted : COLORS.textMuted }]}>
                  Your KYC documents are currently under review. You'll be able to receive deliveries once verified.
                </Text>
              </View>
            )}

            {rider?.kyc_status === 'rejected' && (
              <View style={[styles.kycAlertCard, { backgroundColor: isDarkMode ? COLORS.redBgDark : COLORS.redBgLight, borderLeftColor: isDarkMode ? COLORS.redBorderDark : COLORS.redBorderLight }]}>
                <Text style={[styles.kycAlertTitle, { color: isDarkMode ? COLORS.redTextDark : COLORS.redTextLight }]}>❌ Verification Required</Text>
                <Text style={[styles.kycAlertDesc, { color: isDarkMode ? COLORS.darkMuted : COLORS.textMuted, marginBottom: 12 }]}>
                  Your KYC verification was rejected. Please update documents in your Profile.
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

            {/* 1. STATUS CARD */}
            <Animated.View style={{ transform: [{ scale: onlineBtnScale }], marginBottom: 14 }}>
              <TouchableOpacity
                activeOpacity={rider?.kyc_status === 'verified' ? 0.9 : 1}
                onPress={toggleAvailability}
                style={[
                  styles.statusLargePill,
                  {
                    backgroundColor: isFullyEligible
                      ? '#E6F4EA'
                      : isAvailable
                      ? isDarkMode
                        ? '#372C15'
                        : '#FEF3C7'
                      : isDarkMode
                      ? '#2D3748'
                      : '#F3F4F6',
                    borderColor: isFullyEligible
                      ? '#A3E635'
                      : isAvailable
                      ? '#F59E0B'
                      : theme.border,
                    opacity: rider?.kyc_status === 'verified' ? 1 : 0.6,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusIndicatorDot,
                    { backgroundColor: isFullyEligible ? COLORS.emeraldGreen : isAvailable ? '#F59E0B' : '#9CA3AF' },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.statusPillTitle,
                      { color: isFullyEligible ? '#137333' : isAvailable ? '#92400E' : theme.text },
                    ]}
                  >
                    {isFullyEligible
                      ? '🟢 Online — Shift Active'
                      : isAvailable
                      ? '🟡 Online — No Active Shift'
                      : '⚫ Offline'}
                  </Text>
                  <Text
                    style={[
                      styles.statusPillSubtitle,
                      { color: isFullyEligible ? '#137333' : isAvailable ? '#B45309' : theme.textMuted },
                    ]}
                  >
                    {isFullyEligible
                      ? 'Receiving Delivery Requests'
                      : isAvailable
                      ? 'Not Receiving Orders — Select Shift'
                      : 'Tap to go Online'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* WARNING CARD */}
            {isAvailable && !hasShift && (
              <View style={[styles.warningShiftCard, { backgroundColor: isDarkMode ? '#2B1D0C' : '#FFFBEB', borderColor: isDarkMode ? '#B45309' : '#F59E0B' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#FDE68A' : '#92400E' }}>You are online but no shift is active.</Text>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#D97706' : '#B45309', marginTop: 2 }}>Select a shift to begin receiving delivery requests.</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShiftModalVisible(true)}
                    style={{ backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12 }}>Select Shift</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
                      <Text style={[styles.deliveryNumber, { color: theme.text }]}>#{delivery.order_number || delivery.id.substring(0, 8)}</Text>
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
                {activeSosReport
                  ? 'Emergency request active. Support has been notified.'
                  : 'Report road barriers or collisions to live emergency support.'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSosOpen}
                style={[styles.actionBtn, { backgroundColor: activeSosReport ? '#9CA3AF' : COLORS.danger, alignItems: 'center', borderRadius: 12 }]}
              >
                <Text style={styles.actionBtnText}>{activeSosReport ? 'View Active SOS' : 'Open SOS'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      )}

      {/* SHIFT EXTENSION POPUP MODAL */}
      <Modal animationType="fade" transparent={true} visible={showExtensionModal} onRequestClose={() => setShowExtensionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderRadius: 24, padding: 24 }]}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>⏰</Text>

            <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>Shift Ending Soon!</Text>

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
                style={{ backgroundColor: COLORS.emeraldGreen, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 16 }}>Yes, Extend Shift</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={async () => {
                  setShowExtensionModal(false);
                  await handleEndShiftEarly();
                }}
                style={{ backgroundColor: theme.border, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>No, End Shift Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SCHEDULE-BASED SHIFT SELECT MODAL */}
      <Modal animationType="slide" transparent={true} visible={shiftModalVisible} onRequestClose={() => setShiftModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShiftModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Shift Schedule</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Select an available shift below based on current time.</Text>

            <View style={{ gap: 12, marginVertical: 10 }}>
              {SHIFT_SCHEDULE.map((shift) => {
                const status = getShiftStatus(shift);
                const isAvailableSlot = status === 'Available Now';

                let badgeBg = '#E5E7EB';
                let badgeText = '#6B7280';

                if (status === 'Available Now') {
                  badgeBg = '#D1FAE5';
                  badgeText = '#065F46';
                } else if (status === 'Upcoming') {
                  badgeBg = '#FEF3C7';
                  badgeText = '#92400E';
                } else if (status === 'Completed') {
                  badgeBg = isDarkMode ? '#374151' : '#E5E7EB';
                  badgeText = isDarkMode ? '#9CA3AF' : '#6B7280';
                }

                return (
                  <TouchableOpacity
                    key={shift.id}
                    disabled={!isAvailableSlot}
                    onPress={() => handleSelectShift(shift)}
                    style={[
                      styles.shiftSelectorCard,
                      {
                        backgroundColor: theme.bg,
                        borderColor: isAvailableSlot ? COLORS.emeraldGreen : theme.border,
                        borderRadius: 16,
                        opacity: isAvailableSlot ? 1 : 0.5,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.shiftSelectorText, { color: theme.text }]}>{shift.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{shift.timeLabel}</Text>
                    </View>
                    <View style={[styles.shiftBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.shiftBadgeText, { color: badgeText }]}>{status}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* MULTI-VIEW INTERNAL EMERGENCY SOS MODAL */}
      <Modal animationType="slide" transparent={true} visible={sosModalVisible} onRequestClose={() => resetSosModalState()}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => resetSosModalState()} />
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />

            {/* HEADER NAVIGATION BUTTONS INSIDE SOS MODAL */}
            <View style={styles.modalHeaderRow}>
              {sosModalView === 'HISTORY_DETAIL' ? (
                <TouchableOpacity
                  style={styles.modalBackBtn}
                  onPress={() => {
                    setSelectedHistoryReport(null);
                    setSignedPhotoUrl(null);
                    setSosModalView('HISTORY_LIST');
                  }}
                >
                  <Ionicons name="arrow-back" size={18} color={theme.text} />
                  <Text style={[styles.modalBackBtnText, { color: theme.text }]}>Back</Text>
                </TouchableOpacity>
              ) : sosModalView === 'HISTORY_LIST' ? (
                <TouchableOpacity
                  style={styles.modalBackBtn}
                  onPress={() => {
                    if (activeSosReport) {
                      setSosModalView('ACTIVE_SOS');
                    } else {
                      setSosModalView('SELECT_INCIDENT');
                    }
                  }}
                >
                  <Ionicons name="arrow-back" size={18} color={theme.text} />
                  <Text style={[styles.modalBackBtnText, { color: theme.text }]}>Back</Text>
                </TouchableOpacity>
              ) : sosModalView === 'INCIDENT_FORM' ? (
                <TouchableOpacity
                  style={styles.modalBackBtn}
                  onPress={() => {
                    setSelectedSosOption(null);
                    setSosModalView('SELECT_INCIDENT');
                  }}
                >
                  <Ionicons name="arrow-back" size={18} color={theme.text} />
                  <Text style={[styles.modalBackBtnText, { color: theme.text }]}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              <TouchableOpacity onPress={() => resetSosModalState()} style={styles.closeIconButton}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {/* VIEW 1: ACTIVE SOS VIEW */}
            {sosModalView === 'ACTIVE_SOS' && activeSosReport && (
              <ScrollView style={{ maxHeight: height * 0.7 }} showsVerticalScrollIndicator={false}>
                <View style={{ paddingVertical: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 28 }}>🚨</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalTitle, { color: COLORS.danger }]}>Emergency Request Active</Text>
                      <Text style={[styles.modalSubtitle, { color: theme.textMuted, marginTop: 2, marginBottom: 0 }]}>
                        Support has been notified and is reviewing your report.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.summaryCard, { backgroundColor: theme.bg, borderColor: theme.border, marginVertical: 12 }]}>
                    <View style={styles.sosMetaRow}>
                      <Text style={[styles.sosMetaLabel, { color: theme.textMuted }]}>Issue Type</Text>
                      <Text style={[styles.sosMetaValue, { color: theme.text }]}>{activeSosReport.issue_type}</Text>
                    </View>
                    <View style={styles.sosMetaRow}>
                      <Text style={[styles.sosMetaLabel, { color: theme.textMuted }]}>Submitted At</Text>
                      <Text style={[styles.sosMetaValue, { color: theme.text }]}>
                        {new Date(activeSosReport.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.sosMetaRow}>
                      <Text style={[styles.sosMetaLabel, { color: theme.textMuted }]}>Status</Text>
                      {(() => {
                        const b = getStatusBadgeStyle(activeSosReport.status);
                        return (
                          <View style={{ backgroundColor: b.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: b.text, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                              {b.label}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', marginVertical: 8 }}>
                    Please remain in a safe location until dispatch contacts you or resolves the issue.
                  </Text>

                  {/* DIRECT EMERGENCY HELPLINE CALL SECTION */}
                  <View style={[styles.helplineSection, { backgroundColor: theme.bg, borderColor: theme.border, marginVertical: 12 }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 8 }}>📞 Direct Emergency Helplines</Text>
                    <View style={{ gap: 8 }}>
                      {EMERGENCY_HELPLINES.map((h) => (
                        <TouchableOpacity
                          key={h.number}
                          activeOpacity={0.8}
                          onPress={() => makeEmergencyCall(h.number)}
                          style={[styles.helplineCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                        >
                          <Text style={{ fontSize: 20, marginRight: 10 }}>{h.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{h.label}</Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>{h.subtitle}</Text>
                          </View>
                          <View style={styles.callPill}>
                            <Ionicons name="call" size={12} color={COLORS.white} style={{ marginRight: 4 }} />
                            <Text style={styles.callPillText}>{h.number}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* BOTTOM PAST REQUESTS LINK */}
                  <View style={[styles.pastRequestsBanner, { backgroundColor: theme.bg, borderColor: theme.border, marginTop: 8 }]}>
                    <Text style={{ fontSize: 18, marginBottom: 4 }}>📜 Past Requests</Text>
                    <Text style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12, lineHeight: 16 }}>
                      View your previous emergency requests, track their status and read admin updates.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={async () => {
                        setSosModalView('HISTORY_LIST');
                        if (rider?.id) fetchSosHistory(rider.id);
                      }}
                      style={[styles.historyActionBtn, { backgroundColor: COLORS.emeraldGreen }]}
                    >
                      <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>View History</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* VIEW 2: INCIDENT SELECTION CARDS VIEW */}
            {sosModalView === 'SELECT_INCIDENT' && (
              <ScrollView style={{ maxHeight: height * 0.7 }} showsVerticalScrollIndicator={false}>
                <View style={{ paddingBottom: 10 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Emergency Assistance</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Select the incident template that matches your emergency.</Text>

                  {!currentGps && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <ActivityIndicator size="small" color={COLORS.emeraldGreen} />
                      <Text style={{ fontSize: 12, color: theme.textMuted }}>Acquiring GPS location in background...</Text>
                    </View>
                  )}

                  <View style={styles.sosCardsContainer}>
                    {INCIDENT_TYPES.map((item) => (
                      <TouchableOpacity
                        key={item.type}
                        onPress={() => {
                          setSelectedSosOption(item);
                          setSosModalView('INCIDENT_FORM');
                        }}
                        style={[styles.incidentCardItem, { backgroundColor: theme.bg, borderColor: theme.border }]}
                      >
                        <Text style={{ fontSize: 26, marginRight: 12 }}>{item.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.incidentCardTitle, { color: theme.text }]}>{item.title}</Text>
                          <Text style={[styles.incidentCardSub, { color: theme.textMuted }]}>{item.desc}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* DIRECT EMERGENCY HELPLINES CALL QUICK ACTIONS */}
                  <View style={[styles.helplineSection, { backgroundColor: theme.bg, borderColor: theme.border, marginTop: 16 }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 8 }}>📞 Quick Call Emergency Helplines</Text>
                    <View style={{ gap: 8 }}>
                      {EMERGENCY_HELPLINES.map((h) => (
                        <TouchableOpacity
                          key={h.number}
                          activeOpacity={0.8}
                          onPress={() => makeEmergencyCall(h.number)}
                          style={[styles.helplineCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                        >
                          <Text style={{ fontSize: 20, marginRight: 10 }}>{h.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{h.label}</Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>{h.subtitle}</Text>
                          </View>
                          <View style={styles.callPill}>
                            <Ionicons name="call" size={12} color={COLORS.white} style={{ marginRight: 4 }} />
                            <Text style={styles.callPillText}>{h.number}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* BOTTOM PAST REQUESTS SECTION */}
                  <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 }}>📜 Past Requests</Text>
                    <Text style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12, lineHeight: 16 }}>
                      View your previous emergency requests, track their status and read admin updates.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={async () => {
                        setSosModalView('HISTORY_LIST');
                        if (rider?.id) fetchSosHistory(rider.id);
                      }}
                      style={[styles.historyActionBtn, { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border }]}
                    >
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>View History</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* VIEW 3: INCIDENT FORM VIEW */}
            {sosModalView === 'INCIDENT_FORM' && selectedSosOption && (
              <ScrollView style={{ maxHeight: height * 0.7 }} showsVerticalScrollIndicator={false}>
                {sosSuccess ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 52, marginBottom: 10 }}>✅</Text>
                    <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>SOS Sent</Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }]}>
                      Your location and evidence have been shared.{'\n'}Support has been notified.{'\n'}Remain in a safe location if possible.
                    </Text>
                  </View>
                ) : uploadingSos ? (
                  <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.danger} style={{ marginBottom: 16 }} />
                    <Text style={[styles.modalTitle, { color: theme.text, fontSize: 18 }]}>Sending Emergency Alert...</Text>
                    <View style={{ marginTop: 10, gap: 4, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: theme.textMuted }}>Uploading photo proof...</Text>
                      <Text style={{ fontSize: 13, color: theme.textMuted }}>Sharing live GPS coordinates...</Text>
                      <Text style={{ fontSize: 13, color: theme.textMuted }}>Notifying support dispatch...</Text>
                      <Text style={{ fontSize: 12, color: COLORS.danger, fontWeight: '700', marginTop: 6 }}>Please wait...</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ paddingVertical: 6 }}>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      {selectedSosOption.icon} {selectedSosOption.title}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Provide details regarding this incident.</Text>

                    {/* ACCIDENT */}
                    {selectedSosOption.type === 'Accident' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Who had the accident? (*)</Text>
                        <View style={{ gap: 8, marginTop: 8 }}>
                          {(['I had an accident', 'Someone else had an accident'] as const).map((opt) => (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => setAccidentTarget(opt)}
                              style={[
                                styles.optionSelectorBtn,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: accidentTarget === opt ? COLORS.emeraldGreen : theme.border,
                                },
                              ]}
                            >
                              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>
                                {accidentTarget === opt ? '🔘 ' : '⚪ '} {opt}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {accidentTarget === 'Someone else had an accident' && (
                          <View style={{ marginTop: 14 }}>
                            <Text style={[styles.inputLabel, { color: theme.text }]}>Describe what happened (*)</Text>
                            <TextInput
                              style={[
                                styles.formTextInput,
                                { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, marginTop: 6 },
                              ]}
                              placeholder="Provide details about the incident..."
                              placeholderTextColor={theme.textMuted}
                              value={customInputText}
                              onChangeText={setCustomInputText}
                              multiline
                            />
                          </View>
                        )}
                      </View>
                    )}

                    {/* ROAD BLOCK */}
                    {selectedSosOption.type === 'Road Block' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, color: theme.textMuted }}>
                          Automatic GPS capturing enabled. Proof photo is mandatory.
                        </Text>
                      </View>
                    )}

                    {/* OUT OF FUEL */}
                    {selectedSosOption.type === 'Out of Fuel' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Fuel Type (*)</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          {FUEL_TYPES.map((type) => (
                            <TouchableOpacity
                              key={type}
                              onPress={() => setFuelType(type)}
                              style={[
                                styles.chipBtn,
                                {
                                  backgroundColor: fuelType === type ? COLORS.emeraldGreen : theme.bg,
                                  borderColor: fuelType === type ? COLORS.emeraldGreen : theme.border,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: fuelType === type ? COLORS.white : theme.text,
                                  fontWeight: '700',
                                  fontSize: 12,
                                }}
                              >
                                {type}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={[styles.inputLabel, { color: theme.text, marginTop: 14 }]}>Optional Notes</Text>
                        <TextInput
                          style={[
                            styles.formTextInput,
                            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, marginTop: 6 },
                          ]}
                          placeholder="Additional details (e.g., nearest landmark)..."
                          placeholderTextColor={theme.textMuted}
                          value={customInputText}
                          onChangeText={setCustomInputText}
                          multiline
                        />
                      </View>
                    )}

                    {/* VEHICLE BREAKDOWN */}
                    {selectedSosOption.type === 'Vehicle Breakdown' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Breakdown Issue (*)</Text>
                        <View style={{ gap: 8, marginTop: 8 }}>
                          {BREAKDOWN_TYPES.map((item) => (
                            <TouchableOpacity
                              key={item}
                              onPress={() => setBreakdownType(item)}
                              style={[
                                styles.optionSelectorBtn,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: breakdownType === item ? COLORS.emeraldGreen : theme.border,
                                },
                              ]}
                            >
                              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>
                                {breakdownType === item ? '🔘 ' : '⚪ '} {item}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {breakdownType === 'Other' && (
                          <View style={{ marginTop: 14 }}>
                            <Text style={[styles.inputLabel, { color: theme.text }]}>Describe the problem (*)</Text>
                            <TextInput
                              style={[
                                styles.formTextInput,
                                { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, marginTop: 6 },
                              ]}
                              placeholder="Specify mechanical breakdown details..."
                              placeholderTextColor={theme.textMuted}
                              value={customInputText}
                              onChangeText={setCustomInputText}
                              multiline
                            />
                          </View>
                        )}
                      </View>
                    )}

                    {/* NEED ASSISTANCE */}
                    {selectedSosOption.type === 'Need Assistance' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Assistance Type (*)</Text>
                        <View style={{ gap: 8, marginTop: 8 }}>
                          {ASSISTANCE_TYPES.map((item) => (
                            <TouchableOpacity
                              key={item}
                              onPress={() => setAssistanceType(item)}
                              style={[
                                styles.optionSelectorBtn,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: assistanceType === item ? COLORS.emeraldGreen : theme.border,
                                },
                              ]}
                            >
                              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>
                                {assistanceType === item ? '🔘 ' : '⚪ '} {item}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {assistanceType === 'Other' && (
                          <View style={{ marginTop: 14 }}>
                            <Text style={[styles.inputLabel, { color: theme.text }]}>Describe assistance required (*)</Text>
                            <TextInput
                              style={[
                                styles.formTextInput,
                                { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, marginTop: 6 },
                              ]}
                              placeholder="Detail what assistance you need..."
                              placeholderTextColor={theme.textMuted}
                              value={customInputText}
                              onChangeText={setCustomInputText}
                              multiline
                            />
                          </View>
                        )}
                      </View>
                    )}

                    {/* OTHER ISSUE */}
                    {selectedSosOption.type === 'Other' && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { color: theme.text }]}>Describe emergency issue (*)</Text>
                        <TextInput
                          style={[
                            styles.formTextInput,
                            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, marginTop: 6 },
                          ]}
                          placeholder="Detail the emergency situation..."
                          placeholderTextColor={theme.textMuted}
                          value={customInputText}
                          onChangeText={setCustomInputText}
                          multiline
                        />
                      </View>
                    )}

                    <View style={[styles.summaryCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 12, color: currentGps ? COLORS.emeraldGreen : COLORS.danger, fontWeight: '600' }}>
                          {currentGps
                            ? `📍 GPS Captured (${currentGps.latitude.toFixed(4)}, ${currentGps.longitude.toFixed(4)})`
                            : '⏳ Fetching GPS location...'}
                        </Text>

                        {selectedSosOption.type === 'Accident' || selectedSosOption.type === 'Road Block' ? (
                          <Text style={{ fontSize: 12, color: attachedPhotoUri ? COLORS.emeraldGreen : COLORS.danger, fontWeight: '600' }}>
                            {attachedPhotoUri ? '📷 Proof Photo Attached' : '⚠️ Proof Photo Required (*)'}
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: attachedPhotoUri ? COLORS.emeraldGreen : theme.textMuted, fontWeight: '600' }}>
                            {attachedPhotoUri ? '📷 Proof Photo Attached' : '📷 Proof Photo Optional'}
                          </Text>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={pickImageAttachment}
                      style={[
                        styles.photoPickerBtn,
                        {
                          backgroundColor: theme.bg,
                          borderColor:
                            selectedSosOption.type === 'Accident' || selectedSosOption.type === 'Road Block'
                              ? attachedPhotoUri
                                ? COLORS.emeraldGreen
                                : COLORS.danger
                              : attachedPhotoUri
                              ? COLORS.emeraldGreen
                              : theme.border,
                          borderRadius: 14,
                          marginVertical: 12,
                        },
                      ]}
                    >
                      <Text style={{ fontWeight: '700', color: attachedPhotoUri ? COLORS.emeraldGreen : theme.text, fontSize: 13 }}>
                        {attachedPhotoUri ? '✅ Photo Attached (Tap to retake)' : '📷 Capture Evidence Photo'}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedSosOption(null);
                          setSosModalView('SELECT_INCIDENT');
                        }}
                        style={[styles.closeModalBtn, { flex: 1, marginTop: 0, backgroundColor: theme.border, borderRadius: 14 }]}
                      >
                        <Text style={{ fontWeight: '700', color: theme.text }}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        disabled={!isSosFormValid()}
                        onPress={submitSosReport}
                        style={[
                          styles.actionBtn,
                          {
                            flex: 1.5,
                            backgroundColor: isSosFormValid() ? COLORS.danger : '#9CA3AF',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 14,
                          },
                        ]}
                      >
                        <Text style={styles.actionBtnText}>Submit SOS Alert</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            {/* VIEW 4: PAST REQUESTS HISTORY LIST */}
            {sosModalView === 'HISTORY_LIST' && (
              <ScrollView style={{ maxHeight: height * 0.7 }} showsVerticalScrollIndicator={false}>
                <View style={{ paddingBottom: 10 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>📜 Past Emergency Requests</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                    Track your reported incidents, status changes, and admin updates.
                  </Text>

                  {loadingHistory ? (
                    <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={COLORS.emeraldGreen} />
                      <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 10 }}>Loading request logs...</Text>
                    </View>
                  ) : historyError ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: COLORS.danger, textAlign: 'center' }}>{historyError}</Text>
                      <TouchableOpacity
                        onPress={() => rider?.id && fetchSosHistory(rider.id)}
                        style={{ marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.bg, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}
                      >
                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : sosHistoryList.length === 0 ? (
                    <View style={styles.emptyHistoryContainer}>
                      <Text style={{ fontSize: 40, marginBottom: 8 }}>🛡️</Text>
                      <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No emergency requests yet.</Text>
                      <Text style={[styles.emptyStateDesc, { color: theme.textMuted }]}>
                        When you submit an SOS alert, it will be saved here for tracking.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10, marginTop: 6 }}>
                      {sosHistoryList.map((item) => {
                        const icon = getIncidentIcon(item.issue_type);
                        const badge = getStatusBadgeStyle(item.status);
                        const createdDate = new Date(item.created_at);

                        return (
                          <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.8}
                            onPress={() => {
                              setSelectedHistoryReport(item);
                              resolveSignedPhotoUrl(item.photo_url);
                              setSosModalView('HISTORY_DETAIL');
                            }}
                            style={[styles.historyCardItem, { backgroundColor: theme.bg, borderColor: theme.border }]}
                          >
                            <Text style={{ fontSize: 24, marginRight: 12 }}>{icon}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.historyCardTitle, { color: theme.text }]}>{item.issue_type}</Text>
                              <Text style={[styles.historyCardTime, { color: theme.textMuted }]}>
                                {createdDate.toLocaleDateString()} at {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <View style={[styles.historyStatusBadge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.historyStatusText, { color: badge.text }]}>{badge.label}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* VIEW 5: REQUEST DETAIL VIEW */}
            {sosModalView === 'HISTORY_DETAIL' && selectedHistoryReport && (
              <ScrollView style={{ maxHeight: height * 0.7 }} showsVerticalScrollIndicator={false}>
                <View style={{ paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Text style={{ fontSize: 28 }}>{getIncidentIcon(selectedHistoryReport.issue_type)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalTitle, { color: theme.text, fontSize: 18 }]}>{selectedHistoryReport.issue_type}</Text>
                        <Text style={{ fontSize: 11, color: theme.textMuted }}>
                          Submitted: {new Date(selectedHistoryReport.created_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    {(() => {
                      const badge = getStatusBadgeStyle(selectedHistoryReport.status);
                      return (
                        <View style={[styles.historyStatusBadge, { backgroundColor: badge.bg, paddingHorizontal: 10, paddingVertical: 4 }]}>
                          <Text style={[styles.historyStatusText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      );
                    })()}
                  </View>

                  {/* STATUS TIMELINE */}
                  <View style={[styles.timelineCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 12 }}>Status Timeline</Text>
                    <View style={styles.timelineRow}>
                      {/* Step 1: Submitted */}
                      <View style={styles.timelineStep}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.emeraldGreen }]} />
                        <Text style={[styles.timelineLabel, { color: theme.text }]}>Submitted</Text>
                        <Text style={[styles.timelineTime, { color: theme.textMuted }]}>
                          {new Date(selectedHistoryReport.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>

                      {/* Step 2: Acknowledged */}
                      {selectedHistoryReport.acknowledged_at && (
                        <>
                          <View style={[styles.timelineConnector, { backgroundColor: COLORS.emeraldGreen }]} />
                          <View style={styles.timelineStep}>
                            <View style={[styles.timelineDot, { backgroundColor: COLORS.emeraldGreen }]} />
                            <Text style={[styles.timelineLabel, { color: theme.text }]}>Acknowledged</Text>
                            <Text style={[styles.timelineTime, { color: theme.textMuted }]}>
                              {new Date(selectedHistoryReport.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </>
                      )}

                      {/* Step 3: Resolved */}
                      {selectedHistoryReport.resolved_at && (
                        <>
                          <View style={[styles.timelineConnector, { backgroundColor: COLORS.emeraldGreen }]} />
                          <View style={styles.timelineStep}>
                            <View style={[styles.timelineDot, { backgroundColor: COLORS.emeraldGreen }]} />
                            <Text style={[styles.timelineLabel, { color: theme.text }]}>Resolved</Text>
                            <Text style={[styles.timelineTime, { color: theme.textMuted }]}>
                              {new Date(selectedHistoryReport.resolved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>

                  {/* DETAILS CARD */}
                  <View style={[styles.detailCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    {selectedHistoryReport.vendor_name && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Vendor</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{selectedHistoryReport.vendor_name}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.order_number && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Order Number</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>#{selectedHistoryReport.order_number}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.accident_target && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Accident Target</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{selectedHistoryReport.accident_target}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.fuel_type && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Fuel Type</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{selectedHistoryReport.fuel_type}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.breakdown_type && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Breakdown Type</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{selectedHistoryReport.breakdown_type}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.assistance_type && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Assistance Type</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{selectedHistoryReport.assistance_type}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.latitude && selectedHistoryReport.longitude && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>GPS Location</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>
                          {selectedHistoryReport.latitude.toFixed(4)}, {selectedHistoryReport.longitude.toFixed(4)}
                        </Text>
                      </View>
                    )}

                    {selectedHistoryReport.description && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Description</Text>
                        <Text style={[styles.detailValueText, { color: theme.text }]}>{selectedHistoryReport.description}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.custom_description && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Notes</Text>
                        <Text style={[styles.detailValueText, { color: theme.text }]}>{selectedHistoryReport.custom_description}</Text>
                      </View>
                    )}

                    {selectedHistoryReport.resolution_notes && (
                      <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border }}>
                        <Text style={[styles.detailLabel, { color: COLORS.emeraldGreen, fontWeight: '700' }]}>Admin Resolution Notes</Text>
                        <Text style={[styles.detailValueText, { color: theme.text, marginTop: 2 }]}>{selectedHistoryReport.resolution_notes}</Text>
                      </View>
                    )}
                  </View>

                  {/* EVIDENCE PHOTO DISPLAY */}
                  {signedPhotoUrl ? (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.detailLabel, { color: theme.textMuted, marginBottom: 6 }]}>Evidence Photo</Text>
                      <Image source={{ uri: signedPhotoUrl }} style={styles.fullEvidenceImage} resizeMode="cover" />
                    </View>
                  ) : selectedHistoryReport.photo_url ? (
                    <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.bg, borderRadius: 12, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={COLORS.emeraldGreen} />
                      <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Loading photo proof...</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
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
                <TouchableOpacity onPress={() => setTutorialStep((p) => p - 1)} style={styles.tutorialBackBtn}>
                  <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              <TouchableOpacity
                onPress={() => {
                  if (tutorialStep < 3) {
                    setTutorialStep((p) => p + 1);
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
    marginBottom: 16,
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
    borderWidth: 1.5,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 16,
  },
  statusPillTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusPillSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  warningShiftCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: height * 0.85,
  },
  modalIndicator: {
    width: 36,
    height: 4,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  modalBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeIconButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  shiftSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
  },
  shiftSelectorText: {
    fontWeight: '700',
    fontSize: 15,
  },
  shiftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sosCardsContainer: {
    gap: 10,
  },
  incidentCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  incidentCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  incidentCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
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
    borderRadius: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionSelectorBtn: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  closeModalBtn: {
    padding: 16,
    alignItems: 'center',
  },
  sosMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sosMetaLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sosMetaValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pastRequestsBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  historyActionBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  historyCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  historyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyCardTime: {
    fontSize: 11,
    marginTop: 2,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timelineCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  timelineConnector: {
    height: 2,
    flex: 1,
    marginBottom: 14,
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineTime: {
    fontSize: 9,
    marginTop: 2,
  },
  detailCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailValueText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  fullEvidenceImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  helplineSection: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  helplineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  callPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  callPillText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 12,
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