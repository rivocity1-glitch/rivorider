// src/app/(tabs)/deliveries.tsx
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

// Verified Brand Palette from file_0000000032c87208b7bbf1192d41c9b6.png
const COLORS = {
  emeraldGreen: '#2ECC71',
  limeGreen: '#A8E63A',
  jetBlack: '#0D0D0D',
  white: '#FFFFFF',
  offWhite: '#F9F9F9',
  borderLight: '#EFEFEF',
  textMuted: '#888888',
  danger: '#FF3B30',
  cardBg: '#FFFFFF',
  border: '#EAEAEA',
  // Dark theme properties
  darkCard: '#1A1A1A',
  darkBorder: '#2A2A2A',
  darkMuted: '#A0A0A0',
};

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
  customer: {
    customer_name: string;
  } | null;
  vendor: {
    shop_name: string;
  } | null;
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [currentRiderId, setCurrentRiderId] = useState<string | null>(null);

  // Use refs to prevent stale closures and duplicate subscriptions
  const currentRiderIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

  // Sound and Notification Alert References
  const soundRef = useRef<Audio.Sound | null>(null);
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  // Theme Sync System
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const themeToggleAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

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

  // OTP input reference array for managing autofocus and auto-move workflow
  const otpInputsRef = useRef<TextInput[]>([]);

  const theme = {
    bg: isDarkMode ? COLORS.jetBlack : COLORS.offWhite,
    cardBg: isDarkMode ? COLORS.darkCard : COLORS.white,
    text: isDarkMode ? COLORS.white : COLORS.jetBlack,
    textMuted: isDarkMode ? COLORS.darkMuted : COLORS.textMuted,
    border: isDarkMode ? COLORS.darkBorder : COLORS.borderLight,
    headerBg: isDarkMode ? COLORS.darkCard : COLORS.white,
  };

  // Load Sound Object Lifecycle Setup
  useEffect(() => {
    let isMounted = true;

    async function prepareAudioSound() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('../../../assets/sounds/new-order.mp3')
        );

        if (isMounted) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error('[Audio Initialization] Error loading sound asset:', error);
      }
    }

    prepareAudioSound();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err: unknown) => {
          console.error('[Audio Cleanup] Error unloading sound:', err);
        });
        soundRef.current = null;
      }
    };
  }, []);

  // Helper function to play sound and trigger short vibration
  const triggerNewOrderNotificationAlert = async (orderId?: string) => {
    try {
      // Short vibration feedback (100–200ms feel)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (err) {
      console.error('[Audio Notification] Failed to play new order sound:', err);
    }
  };

  useEffect(() => {
    fetchRiderOrders();
  }, []);

  // Supabase Realtime Subscription Management Loop
  useEffect(() => {
    if (!currentRiderId) return;

    // Log rider ID transition
    console.log(
      `[Deliveries Realtime] Subscribing. Current Rider ID: ${currentRiderId}, Previous Rider ID Ref: ${currentRiderIdRef.current}`
    );

    // Prevent duplicate subscriptions
    if (channelRef.current) {
      console.log('[Deliveries Realtime] Cleaning up previous subscription before subscribing...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`public:orders:rider:${currentRiderId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          try {
            console.log('[Deliveries Realtime] Received payload:', JSON.stringify(payload));
            const newRiderId = payload.new ? (payload.new as any).rider_id : null;
            const oldRiderId = payload.old ? (payload.old as any).rider_id : null;
            const orderId = payload.new ? (payload.new as any).id : (payload.old as any)?.id;
            const activeRiderId = currentRiderIdRef.current;

            console.log(
              `[Deliveries Realtime] Event check -> Active Rider: ${activeRiderId}, New Rider: ${newRiderId}, Old Rider: ${oldRiderId}`
            );

            // Check if this event represents a BRAND NEW assignment to the current rider
            const isNewlyAssignedToCurrentRider =
              newRiderId === activeRiderId && oldRiderId !== activeRiderId;

            if (isNewlyAssignedToCurrentRider && orderId) {
              if (!notifiedOrderIdsRef.current.has(orderId)) {
                notifiedOrderIdsRef.current.add(orderId);
                triggerNewOrderNotificationAlert(orderId);
              }
            }

            // Trigger refresh if an order was assigned, updated, or removed for this rider
            if (
              (newRiderId && newRiderId === activeRiderId) ||
              (oldRiderId && oldRiderId === activeRiderId)
            ) {
              console.log('[Deliveries Realtime] Relevant event detected. Refreshing rider orders...');
              fetchRiderOrders();
            }
          } catch (err) {
            console.error('[Deliveries Realtime] Error handling realtime payload:', err);
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[Deliveries Realtime] Subscription status: ${status}`);
        if (err) {
          console.error('[Deliveries Realtime] Subscription error:', err);
        }
        // Automatically refresh on reconnect
        if (status === 'SUBSCRIBED') {
          console.log('[Deliveries Realtime] Channel connected/reconnected. Refreshing orders...');
          fetchRiderOrders();
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[Deliveries Realtime] Cleaning up subscription on unmount / ID change...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentRiderId]);

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
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const hourStr = hours.toString().padStart(2, '0');

      return {
        date: `${day} ${month} ${year}`,
        time: `${hourStr}:${minutes} ${ampm}`
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
        console.log(`[Deliveries] No rider found. Previous rider ID was: ${currentRiderIdRef.current}`);
        setCurrentRiderId(null);
        currentRiderIdRef.current = null;
        setOrders([]);
        setLoading(false);
        return;
      }

      if (currentRiderIdRef.current !== rider.id) {
        console.log(
          `[Deliveries] Rider ID changed from ${currentRiderIdRef.current} to ${rider.id}`
        );
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
          customer:customer_id (
            customer_name
          ),
          vendor:vendor_id (
            shop_name
          ),
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

  const updateOrderStatusDirectly = async (orderId: string, nextStatus: string) => {
    try {
      setSubmitting(true);
      const nowIso = new Date().toISOString();

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          order_status: nextStatus,
        })
        .eq('id', orderId);

      if (orderUpdateError) throw orderUpdateError;
      
      const { error: trackingInsertError } = await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          status: nextStatus,
          remarks: `Status updated to ${nextStatus.toUpperCase()}`,
          created_at: nowIso,
        });

      if (trackingInsertError) {
        console.warn('Tracking append failed, proceeding:', trackingInsertError);
      }

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
    if (e.nativeEvent.key === 'Backspace') {
      if (otpValues[index] === '' && index > 0) {
        const updatedOtp = [...otpValues];
        updatedOtp[index - 1] = '';
        setOtpValues(updatedOtp);
        otpInputsRef.current[index - 1]?.focus();
      }
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
        if (selectedOrder) {
          openCompletionModal(selectedOrder);
        }
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
        .from("orders")
        .update({
          order_status: "delivered",
          payment_status: "paid",
          collection_method: paymentMethod,
          cash_received: paymentMethod === "cash" ? cashReceivedNum : null,
          change_returned: paymentMethod === "cash" ? changeReturnedNum : null,
          collected_by_rider: currentRiderId,
          delivered_at: nowIso,
        })
        .eq("id", selectedOrder.id);

      if (orderUpdateError) throw orderUpdateError;

      try {
        const { data: existingInvoice, error: invoiceCheckError } = await supabase
          .from('invoices')
          .select('id')
          .eq('order_id', selectedOrder.id)
          .maybeSingle();

        if (!invoiceCheckError && !existingInvoice) {
          const now = new Date();
          const yearStr = now.getFullYear().toString();
          const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
          const dayStr = now.getDate().toString().padStart(2, '0');
          const suffixRand = Math.floor(100000 + Math.random() * 900000).toString();
          const uniqueInvoiceNo = `RIVO-${yearStr}${monthStr}${dayStr}-${suffixRand}`;

          await supabase
            .from("invoices")
            .insert({
              order_id: selectedOrder.id,
              vendor_id: selectedOrder.vendor_id,
              customer_id: selectedOrder.customer_id,
              invoice_number: uniqueInvoiceNo,
              status: "generated",
              created_at: nowIso,
              invoice_url: null
            });
        }
      } catch (invoiceWorkflowError) {
        console.error("INVOICE FLOW EXCEPTION:", invoiceWorkflowError);
      }

      await supabase
        .from("payments")
        .update({
          payment_status: "paid",
          paid_at: nowIso,
        })
        .eq("order_id", selectedOrder.id);

      const collectionPayload = {
        order_id: selectedOrder.id,
        rider_id: currentRiderId,
        collection_method: paymentMethod,
        order_amount: totalAmount,
        amount_received: paymentMethod === 'cash' ? cashReceivedNum : totalAmount,
        change_returned: paymentMethod === 'cash' ? changeReturnedNum : 0,
        transaction_reference: paymentMethod === 'upi' ? transactionRef : null,
        status: 'waiting_return',
        created_at: new Date().toISOString(),
      };

      await supabase
        .from('rider_collections')
        .insert(collectionPayload);

      try {
        const { data: freshOrder, error: fetchOrderError } = await supabase
          .from('orders')
          .select('settled_vendor, settled_rider, vendor_id, rider_id, vendor_earning, rider_earning, rivo_delivery_margin, order_number')
          .eq('id', selectedOrder.id)
          .single();

        if (!fetchOrderError && freshOrder && !freshOrder.settled_vendor && !freshOrder.settled_rider) {
          const { data: existingLedger } = await supabase
            .from('financial_ledger')
            .select('id')
            .eq('reference_id', selectedOrder.id);

          if (!existingLedger || existingLedger.length === 0) {
            const ledgerEntries = [
              {
                entity_type: 'vendor',
                entity_id: freshOrder.vendor_id,
                transaction_type: 'order_credit',
                entry_type: 'credit',
                amount: freshOrder.vendor_earning,
                reference_id: selectedOrder.id,
                remarks: `Order ${freshOrder.order_number} vendor earnings`
              },
              {
                entity_type: 'rider',
                entity_id: freshOrder.rider_id,
                transaction_type: 'delivery_credit',
                entry_type: 'credit',
                amount: freshOrder.rider_earning,
                reference_id: selectedOrder.id,
                remarks: `Order ${freshOrder.order_number} rider earnings`
              },
              {
                entity_type: 'platform',
                entity_id: null,
                transaction_type: 'commission_income',
                entry_type: 'credit',
                amount: selectedOrder.vendor_commission,
                reference_id: selectedOrder.id,
                remarks: `Order ${freshOrder.order_number} platform commission`
              }
            ];

            if (freshOrder.rivo_delivery_margin && freshOrder.rivo_delivery_margin !== 0) {
              ledgerEntries.push({
                entity_type: 'platform',
                entity_id: null,
                transaction_type: 'delivery_margin',
                entry_type: 'credit',
                amount: freshOrder.rivo_delivery_margin,
                reference_id: selectedOrder.id,
                remarks: `Order ${freshOrder.order_number} delivery margin`
              });
            }

            await supabase
              .from('financial_ledger')
              .insert(ledgerEntries);
          }
        }
      } catch (financeError) {
        console.error("Finance Workflow Error:", financeError);
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

  const filteredOrders = orders.filter(order => {
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
      case 'packed': return '#F3E8FF';
      case 'picked_up': return '#FFE4E6';
      case 'out_for_delivery': return '#E0F7FA';
      case 'delivered': return '#DCFCE7';
      default: return '#E0E0E0';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'packed': return '#9333EA';
      case 'picked_up': return '#E11D48';
      case 'out_for_delivery': return '#00838F';
      case 'delivered': return '#16A34A';
      default: return '#666666';
    }
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
    const parts = [
      addr.address_line1,
      addr.address_line2,
      addr.city,
      addr.state,
      addr.pin_code
    ].map(p => p?.trim()).filter(p => !!p);
    return parts.length > 0 ? parts.join(', ') : 'No Address Provided';
  };

  const isSubmitDisabled = paymentMethod === 'cash' && !receivedInputValid();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header Layout */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Deliveries</Text>
          <TouchableOpacity activeOpacity={0.9} onPress={toggleTheme} style={[styles.switchTrack, { backgroundColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
            <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]}>
              <Text style={{ fontSize: 11, textAlign: 'center' }}>{isDarkMode ? '🌙' : '☀️'}</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Container */}
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

      {/* Section Tab Segments */}
      <View style={styles.tabContainer}>
        {(['active', 'completed', 'cancelled'] as const).map((tab) => (
          <TouchableOpacity 
            key={tab}
            style={[
              styles.tab, 
              { backgroundColor: isDarkMode ? COLORS.darkCard : '#EAEAEA' },
              activeTab === tab && { backgroundColor: COLORS.emeraldGreen },
            ]} 
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText, 
              { color: isDarkMode ? COLORS.darkMuted : '#666666' },
              activeTab === tab && { color: COLORS.white },
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Core Scroll View Render Loop */}
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
              
              return (
                <View key={item.id} style={[styles.orderCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={[styles.orderNumberText, { color: theme.text }]}>Order #{item.order_number}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>📅 {createdTimestamp.date}</Text>
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>🕒 {createdTimestamp.time}</Text>
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
                      <Text style={[styles.bodyValue, { color: theme.text, flex: 1 }]} numberOfLines={2}>{formatAddress(item.customer_addresses)}</Text>
                    </View>

                    <View style={{ marginTop: 4, gap: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>PAYMENT INFO</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {item.payment_method?.toLowerCase() === 'cash' ? (
                          <View style={[styles.premiumBadge, { backgroundColor: '#FFEFE6' }]}>
                            <Text style={[styles.premiumBadgeText, { color: '#FF7A00' }]}>🟧 COD</Text>
                          </View>
                        ) : item.payment_method?.toLowerCase() === 'upi' ? (
                          <View style={[styles.premiumBadge, { backgroundColor: '#F5F3FF' }]}>
                            <Text style={[styles.premiumBadgeText, { color: '#7C3AED' }]}>🟣 PREPAID</Text>
                          </View>
                        ) : (
                          <View style={[styles.premiumBadge, { backgroundColor: '#E5E7EB' }]}>
                            <Text style={[styles.premiumBadgeText, { color: '#4B5563' }]}>💳 {item.payment_method?.toUpperCase() || 'UNKNOWN'}</Text>
                          </View>
                        )}

                        {isDelivered && item.collection_method && item.payment_method?.toLowerCase() !== 'upi' && (
                          item.collection_method.toLowerCase() === 'cash' ? (
                            <View style={[styles.premiumBadge, { backgroundColor: '#E6F4EA' }]}>
                              <Text style={[styles.premiumBadgeText, { color: '#137333' }]}>💵 Collected via Cash</Text>
                            </View>
                          ) : item.collection_method.toLowerCase() === 'upi' ? (
                            <View style={[styles.premiumBadge, { backgroundColor: '#EBF5FF' }]}>
                              <Text style={[styles.premiumBadgeText, { color: '#1E40AF' }]}>📱 Collected via UPI</Text>
                            </View>
                          ) : null
                        )}

                        {item.payment_status?.toLowerCase() === 'paid' ? (
                          <View style={[styles.premiumBadge, { backgroundColor: '#E6F4EA' }]}>
                            <Text style={[styles.premiumBadgeText, { color: '#137333' }]}>🟢 Paid</Text>
                          </View>
                        ) : (
                          <View style={[styles.premiumBadge, { backgroundColor: '#FFEFE6' }]}>
                            <Text style={[styles.premiumBadgeText, { color: '#FF7A00' }]}>🟠 Pending</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {isDelivered && deliveredTimestamp && (
                      <View style={{ backgroundColor: theme.bg, padding: 12, borderRadius: 16, marginTop: 4, borderWidth: 1, borderColor: theme.border }}>
                        <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '700', marginBottom: 4 }}>DELIVERED TIMELOG</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>📅 {deliveredTimestamp.date}</Text>
                          <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>🕒 {deliveredTimestamp.time}</Text>
                        </View>
                      </View>
                    )}

                    {isDelivered && item.collection_method === 'cash' && item.cash_received !== null && (
                      <View style={{ backgroundColor: theme.bg, padding: 12, borderRadius: 16, gap: 4, borderWidth: 1, borderColor: theme.border }}>
                        <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '700' }}>💰 CASH BREAKDOWN</Text>
                        <Text style={{ fontSize: 13, color: theme.text, fontWeight: '500' }}>
                          Received from Customer: <Text style={{ fontWeight: '700' }}>₹{item.cash_received}</Text>
                        </Text>
                        {item.change_returned !== null && item.change_returned !== undefined && item.change_returned > 0 ? (
                          <Text style={{ fontSize: 13, color: COLORS.danger, fontWeight: '500' }}>
                            Change Returned: <Text style={{ fontWeight: '700' }}>₹{item.change_returned}</Text>
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 13, color: COLORS.emeraldGreen, fontWeight: '600' }}>✓ Exact Cash Collected</Text>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.cardFooter}>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 10 }}>
                      <View>
                        <Text style={[styles.amountLabel, { color: theme.textMuted, fontSize: 12 }]}>💰 Total Order</Text>
                        <Text style={[styles.amountValue, { color: theme.text, fontSize: 18 }]}>₹{item.total_amount}</Text>
                      </View>
                      
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.amountLabel, { color: COLORS.emeraldGreen, fontWeight: '700', fontSize: 12 }]}>🪙 Your Earnings</Text>
                        <Text style={[styles.amountValue, { color: COLORS.emeraldGreen, fontSize: 20, fontWeight: '900' }]}>₹{item.rider_earning || 0}</Text>
                      </View>
                    </View>

                    {item.order_status?.toLowerCase() === 'packed' && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.completeButton, { backgroundColor: COLORS.emeraldGreen }]}
                        disabled={submitting}
                        onPress={() => updateOrderStatusDirectly(item.id, 'picked_up')}
                      >
                        <Text style={styles.completeButtonText}>Accept Pickup</Text>
                      </TouchableOpacity>
                    )}

                    {item.order_status?.toLowerCase() === 'picked_up' && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.completeButton, { backgroundColor: '#3498DB' }]}
                        disabled={submitting}
                        onPress={() => updateOrderStatusDirectly(item.id, 'out_for_delivery')}
                      >
                        <Text style={styles.completeButtonText}>Out For Delivery</Text>
                      </TouchableOpacity>
                    )}

                    {item.order_status?.toLowerCase() === 'out_for_delivery' && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.completeButton, { backgroundColor: COLORS.emeraldGreen }]}
                        onPress={() => startOtpVerificationWorkflow(item)}
                      >
                        <Text style={styles.completeButtonText}>Delivered</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* OTP Verification Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={otpModalVisible}
        onRequestClose={() => setOtpModalVisible(false)}
      >
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
                        otpValues[idx] !== '' && { borderColor: COLORS.emeraldGreen }
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

                {otpError !== '' && (
                  <Text style={[styles.otpFeedbackMessageText, { color: COLORS.danger }]}>{otpError}</Text>
                )}

                {otpSuccess && (
                  <View style={styles.otpSuccessContainer}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.emeraldGreen} />
                    <Text style={[styles.otpFeedbackMessageText, { color: COLORS.emeraldGreen, marginTop: 0 }]}>
                      OTP Verified
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.submitButton,
                    { backgroundColor: COLORS.emeraldGreen, marginTop: 24 },
                    (otpAttempts >= 3 || otpSuccess) && { backgroundColor: '#CCCCCC', opacity: 0.6 }
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

      {/* Completion Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
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
                    ⚠️ Received cash amount cannot be less than the total order billing rate.
                  </Text>
                )}

                <View style={styles.actionChipRowContainer}>
                  <TouchableOpacity 
                    activeOpacity={0.8} 
                    style={[styles.exactAmountOptionBtn, { backgroundColor: COLORS.emeraldGreen }]}
                    onPress={() => {
                      if(selectedOrder) setAmountReceived(selectedOrder.total_amount.toString());
                    }}
                  >
                    <Text style={styles.exactAmountOptionBtnText}>Customer Gave Exact Amount</Text>
                  </TouchableOpacity>

                  <View style={styles.denomChipsGridInline}>
                    {[500, 1000, 2000].map((denom) => (
                      <TouchableOpacity 
                        key={denom} 
                        activeOpacity={0.8}
                        style={[styles.denomChipSelectorBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
                        onPress={() => setAmountReceived(denom.toString())}
                      >
                        <Text style={[styles.denomChipSelectorText, { color: theme.text }]}>₹{denom}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.formContainer}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>UTR / Transaction Reference (Optional)</Text>
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
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Confirm & Complete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
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
  premiumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
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
  denomChipsGridInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  denomChipSelectorBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denomChipSelectorText: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
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
});