// src/app/(tabs)/deliveries.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from "react-native-qrcode-svg";
import { COLORS, useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  payment_status?: string;
  created_at: string;
  delivered_at?: string | null;
  vendor_id: string;
  customer_id?: string;
  rider_id: string | null;
  vendor_earning: number;
  rider_earning: number;
  vendor_commission: number;
  rivo_delivery_margin: number;
  delivery_fee: number;
  delivery_distance_km: number;
  collection_method?: string | null;
  cash_received?: number | null;
  change_returned?: number | null;
  customer: { customer_name: string; phone?: string | null } | null;
  vendor: { shop_name: string; phone?: string | null } | null;
  customer_addresses: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    pin_code: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export default function DeliveriesScreen() {
  const { isDarkMode, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [currentRiderId, setCurrentRiderId] = useState<string | null>(null);

  const currentRiderIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  // Modal Workflow State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success Toast state mechanics
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastFadeAnim = useRef(new Animated.Value(0)).current;

  // OTP Verification States
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [fetchingOtp, setFetchingOtp] = useState(false);
  const [dbDeliveryCode, setDbDeliveryCode] = useState('');

  const otpInputsRef = useRef<TextInput[]>([]);

  const triggerNewOrderNotificationAlert = async (orderId?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      let soundAsset: any = null;
      try {
        soundAsset = require('../../../assets/sounds/new-order.mp3');
      } catch (assetErr) {
        return;
      }

      let AudioModule: any = null;
      try {
        AudioModule = require('expo-audio');
      } catch (e) {}

      if (AudioModule?.createAudioPlayer && soundAsset) {
        const player = AudioModule.createAudioPlayer(soundAsset);
        player.play();
        return;
      }
    } catch (err) {
      console.error('[Audio] Error playing order assigned alert sound:', err);
    }
  };

  useEffect(() => {
    fetchRiderOrders();
  }, []);

  useEffect(() => {
    if (!currentRiderId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`public:orders:rider:${currentRiderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          try {
            const newRiderId = payload.new ? (payload.new as any).rider_id : null;
            const oldRiderId = payload.old ? (payload.old as any).rider_id : null;
            const orderId = payload.new ? (payload.new as any).id : (payload.old as any)?.id;
            const activeRiderId = currentRiderIdRef.current;

            const isNewlyAssignedToCurrentRider =
              newRiderId === activeRiderId && oldRiderId !== activeRiderId;

            if (isNewlyAssignedToCurrentRider && orderId) {
              if (!notifiedOrderIdsRef.current.has(orderId)) {
                notifiedOrderIdsRef.current.add(orderId);
                triggerNewOrderNotificationAlert(orderId);
              }
            }

            if (
              (newRiderId && newRiderId === activeRiderId) ||
              (oldRiderId && oldRiderId === activeRiderId)
            ) {
              fetchRiderOrders();
            }
          } catch (err) {
            console.error('[Realtime] Error processing realtime payload:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchRiderOrders();
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentRiderId]);

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(toastFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setToastVisible(false);
        });
      }, 2500);
    });
  };

  const formatOrderTimestamp = (dateString: string) => {
    if (!dateString) return { date: '', time: '' };
    try {
      const dateObj = new Date(dateString);
      const day = dateObj.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      let hours = dateObj.getHours();
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const hourStr = hours.toString().padStart(2, '0');

      return {
        date: `${day} ${month} ${year}`,
        time: `${hourStr}:${minutes} ${ampm}`,
      };
    } catch (e) {
      return { date: dateString, time: '' };
    }
  };

  const fetchRiderOrders = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      const user = session.user;

      const { data: rider, error: riderError } = await supabase
        .from('riders')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (riderError) throw riderError;

      if (!rider) {
        setCurrentRiderId(null);
        currentRiderIdRef.current = null;
        setOrders([]);
        setLoading(false);
        return;
      }

      setCurrentRiderId(rider.id);
      currentRiderIdRef.current = rider.id;

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          payment_method,
          payment_status,
          order_status,
          created_at,
          delivered_at,
          vendor_id,
          customer_id,
          rider_id,
          vendor_earning,
          rider_earning,
          vendor_commission,
          rivo_delivery_margin,
          delivery_fee,
          delivery_distance_km,
          collection_method,
          cash_received,
          change_returned,
          customer:customer_id ( customer_name, phone ),
          vendor:vendor_id ( shop_name, phone ),
          customer_addresses:customer_address_id (
            address_line1,
            address_line2,
            city,
            state,
            pin_code,
            latitude,
            longitude
          )
        `)
        .eq('rider_id', rider.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const parsedOrders = (ordersData || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        payment_status: order.payment_status || 'pending',
        order_status: order.order_status,
        created_at: order.created_at,
        delivered_at: order.delivered_at || null,
        vendor_id: order.vendor_id,
        customer_id: order.customer_id,
        rider_id: order.rider_id,
        vendor_earning: order.vendor_earning || 0,
        rider_earning: order.rider_earning || 0,
        vendor_commission: order.vendor_commission || 0,
        rivo_delivery_margin: order.rivo_delivery_margin || 0,
        delivery_fee: order.delivery_fee || 0,
        delivery_distance_km: order.delivery_distance_km || 0,
        collection_method: order.collection_method || null,
        cash_received: order.cash_received !== undefined ? order.cash_received : null,
        change_returned: order.change_returned !== undefined ? order.change_returned : null,
        customer: Array.isArray(order.customer) ? order.customer[0] : order.customer,
        vendor: Array.isArray(order.vendor) ? order.vendor[0] : order.vendor,
        customer_addresses: Array.isArray(order.customer_addresses) ? order.customer_addresses[0] : order.customer_addresses,
      }));

      setOrders(parsedOrders);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallContact = (type: 'vendor' | 'customer', order: Order) => {
    const isVendor = type === 'vendor';
    const name = isVendor ? order.vendor?.shop_name : order.customer?.customer_name;
    const phone = isVendor ? order.vendor?.phone : order.customer?.phone;
    const cleanPhone = phone ? phone.trim() : '';

    if (!cleanPhone || cleanPhone.length < 5) {
      Alert.alert(
        'Phone Number Unavailable',
        `${isVendor ? 'Vendor' : 'Customer'} phone number unavailable.`
      );
      return;
    }

    Alert.alert(
      `Call ${isVendor ? 'Vendor' : 'Customer'}?`,
      `${name || (isVendor ? 'Vendor' : 'Customer')}\n${cleanPhone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${cleanPhone}`).catch(() => {
              Alert.alert('Error', 'Unable to open the phone dialer on this device.');
            });
          },
        },
      ]
    );
  };

  const updateOrderStatusDirectly = async (orderId: string, nextStatus: string) => {
    try {
      setSubmitting(true);
      const nowIso = new Date().toISOString();

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ order_status: nextStatus })
        .eq('id', orderId);

      if (orderUpdateError) throw orderUpdateError;

      await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: nextStatus,
        remarks: `Status updated to ${nextStatus.toUpperCase()}`,
        created_at: nowIso,
      });

      if (nextStatus === 'picked_up') {
        showSuccessToast('Pickup Accepted Successfully');
      } else if (nextStatus === 'out_for_delivery') {
        showSuccessToast('Order Is Out For Delivery');
      } else {
        showSuccessToast(`Status updated to ${nextStatus.replace('_', ' ')}`);
      }

      fetchRiderOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update delivery stage. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startOtpVerificationWorkflow = async (order: Order) => {
    try {
      setSelectedOrder(order);
      setOtpValues(['', '', '', '', '', '']);
      setOtpAttempts(0);
      setOtpError('');
      setOtpSuccess(false);
      setFetchingOtp(true);
      setOtpModalVisible(true);

      const { data, error } = await supabase
        .from('orders')
        .select('delivery_code')
        .eq('id', order.id)
        .single();

      if (error) throw error;
      setDbDeliveryCode(data?.delivery_code || '');
    } catch (err) {
      console.error('Error fetching order delivery code metadata:', err);
      Alert.alert('Error', 'Failed to initialize delivery verification process.');
      setOtpModalVisible(false);
    } finally {
      setFetchingOtp(false);
    }
  };

  const handleOtpInputChange = (text: string, index: number) => {
    if (text.length > 1) {
      const cleanDigits = text.replace(/[^0-9]/g, '').slice(0, 6);
      const updatedOtp = [...otpValues];
      for (let i = 0; i < 6; i++) {
        updatedOtp[i] = cleanDigits[i] || '';
      }
      setOtpValues(updatedOtp);
      const nextFocusIndex = Math.min(cleanDigits.length, 5);
      otpInputsRef.current[nextFocusIndex]?.focus();
      return;
    }

    const cleanVal = text.replace(/[^0-9]/g, '');
    const updatedOtp = [...otpValues];
    updatedOtp[index] = cleanVal;
    setOtpValues(updatedOtp);

    if (cleanVal !== '' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && otpValues[index] === '' && index > 0) {
      const updatedOtp = [...otpValues];
      updatedOtp[index - 1] = '';
      setOtpValues(updatedOtp);
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const verifyDeliveryOtpCode = () => {
    const enteredOtp = otpValues.join('');
    if (enteredOtp.length !== 6) {
      setOtpError('Please enter the full 6-digit OTP.');
      return;
    }

    if (enteredOtp === dbDeliveryCode) {
      setOtpSuccess(true);
      setOtpError('');
      setTimeout(() => {
        setOtpModalVisible(false);
        if (selectedOrder) openCompletionModal(selectedOrder);
      }, 1200);
    } else {
      const advancedAttemptsCount = otpAttempts + 1;
      setOtpAttempts(advancedAttemptsCount);
      if (advancedAttemptsCount >= 3) {
        setOtpError('Maximum verification attempts reached.\nPlease contact support.');
      } else {
        setOtpError('Incorrect OTP\nPlease ask the customer for the correct Delivery OTP.');
      }
    }
  };

  const openCompletionModal = (order: Order) => {
    setSelectedOrder(order);
    setPaymentMethod('cash');
    setAmountReceived('');
    setTransactionRef('');
    setModalVisible(true);
  };

  const handleCompleteDelivery = async () => {
    if (!selectedOrder || !currentRiderId) return;

    const totalAmount = selectedOrder.total_amount;
    const nowIso = new Date().toISOString();
    let cashReceivedNum = 0;
    let changeReturnedNum = 0;

    if (paymentMethod === 'cash') {
      cashReceivedNum = parseFloat(amountReceived);
      if (isNaN(cashReceivedNum) || cashReceivedNum < totalAmount) {
        Alert.alert('Invalid Amount', 'Amount received must be greater than or equal to the order total.');
        return;
      }
      changeReturnedNum = cashReceivedNum - totalAmount;
    }

    try {
      setSubmitting(true);

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          order_status: 'delivered',
          payment_status: 'paid',
          collection_method: paymentMethod,
          cash_received: paymentMethod === 'cash' ? cashReceivedNum : null,
          change_returned: paymentMethod === 'cash' ? changeReturnedNum : null,
          collected_by_rider: currentRiderId,
          delivered_at: nowIso,
        })
        .eq('id', selectedOrder.id);

      if (orderUpdateError) throw orderUpdateError;

      const { error: collectionError } = await supabase
        .from('rider_collections')
        .insert({
          order_id: selectedOrder.id,
          rider_id: currentRiderId,
          status: 'waiting_return',
          transaction_reference: paymentMethod === 'upi' ? transactionRef : null,
          created_at: nowIso,
        });

      if (collectionError) {
        console.warn('Rider collections entry warning:', collectionError);
      }

      setModalVisible(false);
      showSuccessToast('Delivery Completed Successfully');
      fetchRiderOrders();
      Alert.alert('Success', 'Delivery Completed Successfully');
    } catch (error) {
      console.error('Error completing delivery:', error);
      Alert.alert('Error', 'Failed to complete delivery. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    let matchesTab = false;
    const currentStatus = order.order_status?.toLowerCase();

    if (activeTab === 'active') {
      matchesTab = ['packed', 'picked_up', 'out_for_delivery'].includes(currentStatus);
    } else if (activeTab === 'completed') {
      matchesTab = currentStatus === 'delivered';
    } else if (activeTab === 'cancelled') {
      matchesTab = currentStatus === 'cancelled';
    }

    const customerName = order.customer?.customer_name?.toLowerCase() || '';
    const orderNum = order.order_number?.toLowerCase() || '';
    const matchesSearch = customerName.includes(searchQuery.toLowerCase()) || orderNum.includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'packed': return isDarkMode ? '#4C1D95' : '#F3E8FF';
      case 'picked_up': return isDarkMode ? '#881337' : '#FFE4E6';
      case 'out_for_delivery': return isDarkMode ? '#164E63' : '#E0F7FA';
      case 'delivered': return isDarkMode ? '#064E3B' : '#DCFCE7';
      default: return isDarkMode ? '#262626' : '#E0E0E0';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'packed': return isDarkMode ? '#E9D5FF' : '#9333EA';
      case 'picked_up': return isDarkMode ? '#FECDD3' : '#E11D48';
      case 'out_for_delivery': return isDarkMode ? '#A5F3FC' : '#00838F';
      case 'delivered': return isDarkMode ? '#A7F3D0' : '#16A34A';
      default: return isDarkMode ? '#A3A3A3' : '#666666';
    }
  };

  const getOrderPaymentTypeLabel = (order: Order) => {
    const rawMethod = (order.payment_method || '').toLowerCase();
    const collectionMethod = (order.collection_method || '').toLowerCase();

    if (rawMethod === 'cod' || rawMethod === 'cash') {
      if (collectionMethod === 'upi') {
        return 'COD (Paid via UPI)';
      }
      return 'COD (Cash on Delivery)';
    } else if (rawMethod === 'upi' || rawMethod === 'online' || rawMethod === 'prepaid') {
      return 'Prepaid (UPI)';
    }

    return order.payment_method?.toUpperCase() || 'Prepaid';
  };

  const calculatedChange = () => {
    const received = parseFloat(amountReceived);
    if (isNaN(received) || !selectedOrder) return 0;
    const change = received - selectedOrder.total_amount;
    return change > 0 ? change : 0;
  };

  const receivedInputValid = () => {
    if (!amountReceived) return false;
    const val = parseFloat(amountReceived);
    if (isNaN(val) || !selectedOrder) return false;
    return val >= selectedOrder.total_amount;
  };

  const formatAddress = (addr: Order['customer_addresses']) => {
    if (!addr) return 'No Address Provided';
    const parts = [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pin_code].map((p) => p?.trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No Address Provided';
  };

  const isSubmitDisabled = paymentMethod === 'cash' && !receivedInputValid();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Deliveries</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search Order ID or Customer"
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.input, { color: theme.text }]}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['active', 'completed', 'cancelled'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 },
              activeTab === tab && { backgroundColor: COLORS.emeraldGreen, borderColor: COLORS.emeraldGreen },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: theme.textMuted }, activeTab === tab && { color: COLORS.white }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Scroll View */}
      {loading ? (
        <View style={styles.centerLayout}>
          <ActivityIndicator size="large" color={COLORS.emeraldGreen} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          {filteredOrders.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Ionicons name="cube-outline" size={48} color={theme.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No assigned deliveries</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>There are no deliveries matching this status section currently.</Text>
            </View>
          ) : (
            filteredOrders.map((item) => {
              const createdTimestamp = formatOrderTimestamp(item.created_at);
              const deliveredTimestamp = item.delivered_at ? formatOrderTimestamp(item.delivered_at) : null;
              const isDelivered = item.order_status?.toLowerCase() === 'delivered';
              const isPacked = item.order_status?.toLowerCase() === 'packed';
              const isPickedUp = item.order_status?.toLowerCase() === 'picked_up';
              const isOutForDelivery = item.order_status?.toLowerCase() === 'out_for_delivery';

              return (
                <View key={item.id} style={[styles.orderCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={[styles.orderNumberText, { color: theme.text }]}>Order #{item.order_number}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>{createdTimestamp.date}</Text>
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>{createdTimestamp.time}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.order_status) }]}>
                      <Text style={[styles.statusText, { color: getStatusTextColor(item.order_status) }]}>
                        {item.order_status?.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Ionicons name="business-outline" size={18} color={theme.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.bodyLabel, { color: theme.textMuted }]}>Vendor Name: </Text>
                      <Text style={[styles.bodyValue, { color: theme.text }]}>{item.vendor?.shop_name || 'N/A'}</Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Ionicons name="person-circle-outline" size={18} color={theme.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.bodyLabel, { color: theme.textMuted }]}>Customer Name: </Text>
                      <Text style={[styles.bodyValue, { color: theme.text }]}>{item.customer?.customer_name || 'N/A'}</Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={18} color={theme.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.bodyLabel, { color: theme.textMuted }]}>Customer Address: </Text>
                      <Text style={[styles.bodyValue, { color: theme.text, flex: 1 }]} numberOfLines={2}>
                        {formatAddress(item.customer_addresses)}
                      </Text>
                    </View>

                    {/* FINANCIAL BREAKDOWN SECTION FOR COMPLETED DELIVERIES */}
                    {isDelivered && (
                      <View style={[styles.completedFinancialBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={[styles.completedFinancialHeaderTitle, { color: theme.text }]}>
                          Payment & Settlement Breakdown
                        </Text>
                        
                        <View style={styles.financialRowItem}>
                          <Text style={[styles.financialRowLabel, { color: theme.textMuted }]}>Payment Method:</Text>
                          <View style={[styles.paymentMethodTag, { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
                            <Text style={[styles.paymentMethodTagText, { color: isDarkMode ? '#F1F5F9' : '#334155' }]}>{getOrderPaymentTypeLabel(item)}</Text>
                          </View>
                        </View>

                        {item.collection_method === 'cash' || item.cash_received ? (
                          <>
                            <View style={styles.financialRowItem}>
                              <Text style={[styles.financialRowLabel, { color: theme.textMuted }]}>Cash Received from Customer:</Text>
                              <Text style={[styles.financialRowValue, { color: COLORS.emeraldGreen }]}>
                                ₹{item.cash_received ?? item.total_amount}
                              </Text>
                            </View>

                            <View style={styles.financialRowItem}>
                              <Text style={[styles.financialRowLabel, { color: theme.textMuted }]}>Change Given to Customer:</Text>
                              <Text style={[styles.financialRowValue, { color: COLORS.danger }]}>
                                ₹{item.change_returned ?? 0}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <View style={styles.financialRowItem}>
                            <Text style={[styles.financialRowLabel, { color: theme.textMuted }]}>Amount Collected:</Text>
                            <Text style={[styles.financialRowValue, { color: COLORS.emeraldGreen }]}>
                              ₹{item.total_amount} (Online/UPI)
                            </Text>
                          </View>
                        )}

                        {deliveredTimestamp && (
                          <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>
                              Delivered on: {deliveredTimestamp.date} at {deliveredTimestamp.time}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.cardFooter}>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 10 }}>
                      <View>
                        <Text style={[styles.amountLabel, { color: theme.textMuted, fontSize: 12 }]}>Total Order</Text>
                        <Text style={[styles.amountValue, { color: theme.text, fontSize: 18 }]}>₹{item.total_amount}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.amountLabel, { color: COLORS.emeraldGreen, fontWeight: '700', fontSize: 12 }]}>Your Earnings</Text>
                        <Text style={[styles.amountValue, { color: COLORS.emeraldGreen, fontSize: 20, fontWeight: '900' }]}>₹{item.rider_earning || 0}</Text>
                      </View>
                    </View>

                    <View style={styles.actionsContainer}>
                      {isPacked && (
                        <>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.callButton, { borderColor: theme.border, backgroundColor: theme.bg }]}
                            onPress={() => handleCallContact('vendor', item)}
                          >
                            <Text style={[styles.callButtonText, { color: theme.text }]}>📞 Call Vendor</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.completeButton, { backgroundColor: COLORS.emeraldGreen }]}
                            disabled={submitting}
                            onPress={() => updateOrderStatusDirectly(item.id, 'picked_up')}
                          >
                            <Text style={styles.completeButtonText}>Accept Pickup</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {isPickedUp && (
                        <>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.callButton, { borderColor: theme.border, backgroundColor: theme.bg }]}
                            onPress={() => handleCallContact('customer', item)}
                          >
                            <Text style={[styles.callButtonText, { color: theme.text }]}>📞 Call Customer</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.completeButton, { backgroundColor: '#3498DB' }]}
                            disabled={submitting}
                            onPress={() => updateOrderStatusDirectly(item.id, 'out_for_delivery')}
                          >
                            <Text style={styles.completeButtonText}>Out For Delivery</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {isOutForDelivery && (
                        <>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.callButton, { borderColor: theme.border, backgroundColor: theme.bg }]}
                            onPress={() => handleCallContact('customer', item)}
                          >
                            <Text style={[styles.callButtonText, { color: theme.text }]}>📞 Call Customer</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.completeButton, { backgroundColor: COLORS.emeraldGreen }]}
                            onPress={() => startOtpVerificationWorkflow(item)}
                          >
                            <Text style={styles.completeButtonText}>Delivered</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* OTP Modal */}
      <Modal animationType="slide" transparent={true} visible={otpModalVisible} onRequestClose={() => setOtpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setOtpModalVisible(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalKnob, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delivery Verification</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Ask the customer for the 6-digit Delivery OTP.</Text>

            {fetchingOtp ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.emeraldGreen} />
              </View>
            ) : (
              <View style={{ marginBottom: 24 }}>
                <View style={styles.otpInputsWrapperRow}>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <TextInput
                      key={idx}
                      ref={(ref) => {
                        if (ref) otpInputsRef.current[idx] = ref;
                      }}
                      style={[
                        styles.otpSingleBoxField,
                        { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                        otpValues[idx] !== '' && { borderColor: COLORS.emeraldGreen },
                      ]}
                      maxLength={6}
                      keyboardType="numeric"
                      autoFocus={idx === 0}
                      value={otpValues[idx]}
                      onChangeText={(text) => handleOtpInputChange(text, idx)}
                      onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {otpError !== '' && <Text style={[styles.otpFeedbackMessageText, { color: COLORS.danger }]}>{otpError}</Text>}

                {otpSuccess && (
                  <View style={styles.otpSuccessContainer}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.emeraldGreen} />
                    <Text style={[styles.otpFeedbackMessageText, { color: COLORS.emeraldGreen, marginTop: 0 }]}>OTP Verified</Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.submitButton,
                    { backgroundColor: COLORS.emeraldGreen, marginTop: 24 },
                    (otpAttempts >= 3 || otpSuccess) && { backgroundColor: '#CCCCCC', opacity: 0.6 },
                  ]}
                  disabled={otpAttempts >= 3 || otpSuccess}
                  onPress={verifyDeliveryOtpCode}
                >
                  <Text style={styles.submitButtonText}>Verify OTP</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Completion Bottom Sheet */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.bottomSheetContainer, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalKnob, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Complete Delivery</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Order #{selectedOrder?.order_number}</Text>

            <View style={[styles.modalSummaryRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[styles.modalSummaryLabel, { color: theme.textMuted }]}>Order Total</Text>
              <Text style={[styles.modalSummaryValue, { color: COLORS.emeraldGreen }]}>₹{selectedOrder?.total_amount}</Text>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.text }]}>Payment Collected Via</Text>
            <View style={styles.methodSelector}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.methodTab,
                  { borderColor: theme.border, backgroundColor: theme.cardBg },
                  paymentMethod === 'cash' && { backgroundColor: COLORS.jetBlack, borderColor: COLORS.jetBlack },
                ]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Ionicons name="cash-outline" size={18} color={paymentMethod === 'cash' ? COLORS.white : theme.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.methodTabText, { color: theme.textMuted }, paymentMethod === 'cash' && { color: COLORS.white }]}>Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.methodTab,
                  { borderColor: theme.border, backgroundColor: theme.cardBg },
                  paymentMethod === 'upi' && { backgroundColor: COLORS.jetBlack, borderColor: COLORS.jetBlack },
                ]}
                onPress={() => setPaymentMethod('upi')}
              >
                <Ionicons name="qr-code-outline" size={18} color={paymentMethod === 'upi' ? COLORS.white : theme.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.methodTabText, { color: theme.textMuted }, paymentMethod === 'upi' && { color: COLORS.white }]}>UPI</Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'cash' ? (
              <View style={styles.formContainer}>
                <View style={[styles.summaryMetricCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <View style={styles.summaryMetricItem}>
                    <Text style={[styles.summaryMetricLabelText, { color: theme.textMuted }]}>Order Total</Text>
                    <Text style={[styles.summaryMetricValueText, { color: theme.text }]}>₹{selectedOrder?.total_amount || 0}</Text>
                  </View>
                  <View style={styles.summaryMetricItem}>
                    <Text style={[styles.summaryMetricLabelText, { color: theme.textMuted }]}>Received</Text>
                    <Text style={[styles.summaryMetricValueText, { color: COLORS.emeraldGreen }]}>
                      ₹{amountReceived ? parseFloat(amountReceived) || 0 : 0}
                    </Text>
                  </View>
                  <View style={styles.summaryMetricItem}>
                    <Text style={[styles.summaryMetricLabelText, { color: theme.textMuted }]}>Change</Text>
                    <Text style={[styles.summaryMetricValueText, { color: COLORS.danger }]}>₹{calculatedChange().toFixed(0)}</Text>
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: theme.text }]}>Amount Received (₹)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  keyboardType="numeric"
                  placeholder="Enter cash given by customer"
                  placeholderTextColor={theme.textMuted}
                  value={amountReceived}
                  onChangeText={(val) => setAmountReceived(val)}
                />

                {amountReceived !== '' && !receivedInputValid() && (
                  <Text style={styles.validationErrorBannerText}>
                    Received cash amount cannot be less than the total order billing rate.
                  </Text>
                )}

                <View style={styles.actionChipRowContainer}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.exactAmountOptionBtn, { backgroundColor: COLORS.emeraldGreen }]}
                    onPress={() => {
                      if (selectedOrder) setAmountReceived(selectedOrder.total_amount.toString());
                    }}
                  >
                    <Text style={styles.exactAmountOptionBtnText}>Customer Gave Exact Amount</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <View style={[styles.upiScreenContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[styles.upiAmountLabel, { color: theme.textMuted }]}>Amount To Collect</Text>
                  <Text style={[styles.upiAmountValue, { color: COLORS.emeraldGreen }]}>₹{selectedOrder?.total_amount}</Text>

                  <View style={[styles.qrContainerBox, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
                    <QRCode
                      value={`upi://pay?pa=YOUR_UPI_ID_HERE&pn=Rivo%20City&am=${selectedOrder?.total_amount}&cu=INR&tn=Order%20${selectedOrder?.order_number}`}
                      size={220}
                    />
                  </View>

                  <View style={styles.upiDetailsMetaBox}>
                    <View style={styles.upiMetaRowItem}>
                      <Text style={[styles.upiMetaLabelText, { color: theme.textMuted }]}>Receiver</Text>
                      <Text style={[styles.upiMetaValueText, { color: theme.text }]}>Rivo City</Text>
                    </View>
                    <View style={styles.upiMetaRowItem}>
                      <Text style={[styles.upiMetaLabelText, { color: theme.textMuted }]}>UPI ID</Text>
                      <Text style={[styles.upiMetaValueText, { color: theme.text }]}>YOUR_UPI_ID_HERE</Text>
                    </View>
                  </View>

                  <Text style={[styles.upiHelperNoteText, { color: theme.textMuted }]}>
                    "Ask the customer to scan this QR using any UPI app."
                  </Text>
                </View>

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 16 }]}>Transaction Reference (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  placeholder="Enter transaction reference number"
                  placeholderTextColor={theme.textMuted}
                  value={transactionRef}
                  onChangeText={setTransactionRef}
                />
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.submitButton,
                { backgroundColor: COLORS.emeraldGreen },
                isSubmitDisabled && { backgroundColor: COLORS.emeraldGreen, opacity: 0.4 },
              ]}
              disabled={submitting || isSubmitDisabled}
              onPress={handleCompleteDelivery}
            >
              {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.submitButtonText}>Confirm & Complete</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastFadeAnim }]}>
          <View style={styles.toastContent}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: -16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    justifyContent: 'space-between',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 99,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  centerLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollList: {
    padding: 16,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  orderCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    marginVertical: 16,
  },
  cardBody: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bodyLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  bodyValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  completedFinancialBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  completedFinancialHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  financialRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialRowLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  financialRowValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  paymentMethodTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paymentMethodTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  amountLabel: {
    fontSize: 14,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  completeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
  },
  modalKnob: {
    width: 40,
    height: 4,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 1,
  },
  modalSummaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalSummaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  methodSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  formContainer: {
    marginBottom: 28,
  },
  summaryMetricCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryMetricLabelText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryMetricValueText: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalInput: {
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    borderRadius: 16,
  },
  validationErrorBannerText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  actionChipRowContainer: {
    marginTop: 16,
    gap: 12,
  },
  exactAmountOptionBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  exactAmountOptionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    height: 52,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 99,
  },
  toastText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  otpInputsWrapperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 6,
  },
  otpSingleBoxField: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  otpFeedbackMessageText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  otpSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  upiScreenContainer: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 4,
  },
  upiAmountLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upiAmountValue: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 20,
  },
  qrContainerBox: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  upiDetailsMetaBox: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  upiMetaRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upiMetaLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  upiMetaValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  upiHelperNoteText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 12,
    lineHeight: 16,
  },
});