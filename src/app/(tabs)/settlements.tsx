// src/app/(tabs)/settlements.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../../lib/supabase";

// Define TypeScript interfaces based on DB schema
interface Settlement {
  id: string;
  rider_id: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  created_at: string;
  payment_method: string | null;
  utr_number: string | null;
  remarks: string | null;
  paid_at: string | null;
  delivery_count: number;
}

interface SummaryStats {
  availableBalance: number;
  unsettledCount: number;
  todayEarnings: number;
  pendingSettlement: number;
  totalPaid: number;
  hasPendingSettlement: boolean;
  isDaysEligible: boolean;
}

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

export default function Settlements() {
  const [riderId, setRiderId] = useState<string | null>(null);
  const [stats, setStats] = useState<SummaryStats>({
    availableBalance: 0,
    unsettledCount: 0,
    todayEarnings: 0,
    pendingSettlement: 0,
    totalPaid: 0,
    hasPendingSettlement: false,
    isDaysEligible: false,
  });
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Theme Sync System
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const themeToggleAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  // Layout Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Press feedback animations scale registry
  const actionButtonScale = useRef(new Animated.Value(1)).current;

  const theme = {
    bg: isDarkMode ? COLORS.jetBlack : COLORS.offWhite,
    cardBg: isDarkMode ? COLORS.darkCard : COLORS.white,
    text: isDarkMode ? COLORS.white : COLORS.jetBlack,
    textMuted: isDarkMode ? COLORS.darkMuted : COLORS.textMuted,
    border: isDarkMode ? COLORS.darkBorder : COLORS.borderLight,
    headerBg: isDarkMode ? COLORS.darkCard : COLORS.white,
  };

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

  const animateButtonPressIn = () => {
    Animated.timing(actionButtonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }).start();
  };

  const animateButtonPressOut = () => {
    Animated.timing(actionButtonScale, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  };

  const triggerEntranceAnimation = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // Safe Date & Time Formatter
  const formatDateTime = (dateString: string) => {
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
        formattedDate: `📅 ${day} ${month} ${year}`,
        formattedTime: `🕒 ${hourStr}:${minutes} ${ampm}`
      };
    } catch (e) {
      return { formattedDate: dateString, formattedTime: '' };
    }
  };

  // Core Data Fetching Function
  const fetchData = useCallback(async (currentRiderId: string, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      // 1. Fetch Orders to calculate Available Balance & Today's Earnings using order_status
      const { data: deliveredOrders, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at")
        .eq("rider_id", currentRiderId)
        .eq("order_status", "delivered")
        .order("created_at", { ascending: true }); // Ascending order ensures oldest orders come first

      if (ordersError) throw ordersError;

      // Fetch already settled delivery counts
      const { data: settledSum, error: settledSumError } = await supabase
        .from("rider_settlements")
        .select("delivery_count")
        .eq("rider_id", currentRiderId)
        .not("status", "eq", "rejected");

      if (settledSumError) throw settledSumError;

      const totalDeliveredCount = deliveredOrders?.length || 0;
      const totalSettledCount = (settledSum || []).reduce((acc, curr) => acc + (curr.delivery_count || 0), 0);
      
      const unsettledCount = Math.max(0, totalDeliveredCount - totalSettledCount);
      const availableBalance = unsettledCount * 20;

      // Find the oldest delivered order that hasn't been included in a settlement
      let isDaysEligible = false;
      if (deliveredOrders && totalDeliveredCount > totalSettledCount) {
        const oldestUnsettledOrder = deliveredOrders[totalSettledCount];
        if (oldestUnsettledOrder && oldestUnsettledOrder.created_at) {
          const oldestOrderTime = new Date(oldestUnsettledOrder.created_at).getTime();
          const currentTime = new Date().getTime();
          const daysDiff = (currentTime - oldestOrderTime) / (1000 * 60 * 60 * 24);
          if (daysDiff >= 7) {
            isDaysEligible = true;
          }
        }
      }

      // Calculate Today's Earnings
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrdersCount = (deliveredOrders || []).filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= todayStart;
      }).length;
      const todayEarnings = todayOrdersCount * 20;

      // 2. Fetch Settlement History & Calculate Aggregates
      const { data: settlements, error: settlementsError } = await supabase
        .from("rider_settlements")
        .select("*")
        .eq("rider_id", currentRiderId)
        .order("created_at", { ascending: false });

      if (settlementsError) throw settlementsError;

      const settlementList: Settlement[] = settlements || [];

      let pendingSettlement = 0;
      let totalPaid = 0;
      let hasPendingSettlement = false;

      settlementList.forEach((s) => {
        if (s.status === "pending") {
          pendingSettlement += s.amount;
          hasPendingSettlement = true;
        } else if (s.status === "paid") {
          totalPaid += s.amount;
        }
      });

      setStats({
        availableBalance,
        unsettledCount,
        todayEarnings,
        pendingSettlement,
        totalPaid,
        hasPendingSettlement,
        isDaysEligible,
      });
      setHistory(settlementList);
      triggerEntranceAnimation();
    } catch (error: any) {
      console.error("Error fetching settlement data:", error);
      Alert.alert("Error", error.message || "Failed to load settlement data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initialize Auth User and Fetch corresponding Rider profile
  useEffect(() => {
    async function initializeRider() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          Alert.alert("Authentication Required", "Please log in to view settlements.");
          setLoading(false);
          return;
        }

        const { data: riderData, error: riderError } = await supabase
          .from("riders")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();

        if (riderError) throw riderError;
        if (riderData) {
          setRiderId(riderData.id);
          fetchData(riderData.id);
        }
      } catch (error: any) {
        console.error("Error initializing rider profile:", error);
        Alert.alert("Profile Error", error.message || "Could not retrieve rider context profile.");
        setLoading(false);
      }
    }

    initializeRider();
  }, [fetchData]);

  // Set up Realtime Listeners once riderId is resolved
  useEffect(() => {
    if (!riderId) return;

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rider_settlements",
          filter: `rider_id=eq.${riderId}`,
        },
        () => {
          fetchData(riderId, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId, fetchData]);

  // Pull to Refresh Handler
  const handlePullToRefresh = () => {
    if (!riderId) return;
    setRefreshing(true);
    fetchData(riderId, true);
  };

  // Request Settlement Submission
  const handleRequestSettlement = async () => {
    if (!riderId || stats.availableBalance < 500 || !stats.isDaysEligible || stats.hasPendingSettlement) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("rider_settlements").insert([
        {
          rider_id: riderId,
          amount: stats.availableBalance,
          delivery_count: stats.unsettledCount,
          status: "pending",
          payment_method: null,
          utr_number: null,
          remarks: null,
          created_at: new Date().toISOString(),
          paid_at: null,
        },
      ]);

      if (error) throw error;

      Alert.alert("Success", "Settlement Request Submitted Successfully");
      fetchData(riderId, true);
    } catch (error: any) {
      console.error("Error submitting settlement request:", error);
      Alert.alert("Submission Failed", error.message || "Could not process request");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeConfig = (status: string) => {
    switch (status) {
      case "pending":
        return { bg: '#FFEFE6', text: '#FF7A00', label: '🟠 Requested' };
      case "paid":
        return { bg: '#E6F4EA', text: '#10B981', label: '🟢 Paid' };
      case "rejected":
        return { bg: '#FEE2E2', text: '#EF4444', label: '🔴 Rejected' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: status.toUpperCase() };
    }
  };

  // Dynamic status message logic
  const getStatusMessage = () => {
    if (stats.hasPendingSettlement) {
      return "Your withdrawal request is being processed.";
    }
    if (stats.availableBalance < 500) {
      return "Minimum ₹500 balance required to withdraw.";
    }
    if (!stats.isDaysEligible) {
      return "Withdrawals are available 7 days after completed deliveries.";
    }
    return "Your earnings are ready for withdrawal.";
  };

  const isActionDisabled = stats.availableBalance < 500 || !stats.isDaysEligible || stats.hasPendingSettlement || submitting || loading || !riderId;

  // Premium Skeleton Card component mapping
  const SkeletonCard = () => (
    <View style={[styles.orderCard, { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: 0.6 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ width: '40%', height: 16, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4 }} />
        <View style={{ width: '25%', height: 20, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 8 }} />
      </View>
      <View style={{ width: '70%', height: 14, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4, marginBottom: 6 }} />
      <View style={{ width: '50%', height: 14, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* PREMIUM STYLE HEADER */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>💰 Earnings & Settlements</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Track earnings and request payouts.</Text>
          </View>
          <TouchableOpacity activeOpacity={0.9} onPress={toggleTheme} style={[styles.switchTrack, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
            <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]}>
              <Text style={{ fontSize: 11, textAlign: 'center' }}>{isDarkMode ? '🌙' : '☀️'}</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={COLORS.emeraldGreen} colors={[COLORS.emeraldGreen]} />
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 10 }}>
            <View style={[styles.heroCardSkeleton, { backgroundColor: theme.cardBg, borderColor: theme.border }]} />
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1, height: 80, backgroundColor: theme.cardBg, borderRadius: 20, borderWidth: 1, borderColor: theme.border }} />
              <View style={{ flex: 1, height: 80, backgroundColor: theme.cardBg, borderRadius: 20, borderWidth: 1, borderColor: theme.border }} />
            </View>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            {/* HERO CARD */}
            <View style={[styles.balanceCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>AVAILABLE BALANCE</Text>
              <Text style={[styles.balanceValue, { color: theme.text }]}>₹{stats.availableBalance.toLocaleString("en-IN")}</Text>
              
              <View style={[styles.badgeContainerStatus, { backgroundColor: theme.bg }]}>
                <View style={[styles.statusIndicatorDot, { backgroundColor: stats.hasPendingSettlement ? '#FF7A00' : COLORS.emeraldGreen }]} />
                <Text style={[styles.balanceSubtext, { color: theme.text }]}>
                  {stats.hasPendingSettlement ? 'Settlement in progress' : 'Ready for settlement'}
                </Text>
              </View>
            </View>

            {/* STATISTICS GRID */}
            <View style={styles.gridRow}>
              <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.iconStatWrapper}><Text style={{ fontSize: 16 }}>📈</Text></View>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>TODAY'S EARNINGS</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>₹{stats.todayEarnings.toLocaleString("en-IN")}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.iconStatWrapper}><Text style={{ fontSize: 16 }}>💰</Text></View>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>AVAILABLE BALANCE</Text>
                <Text style={[styles.statValue, { color: COLORS.emeraldGreen }]}>₹{stats.availableBalance.toLocaleString("en-IN")}</Text>
              </View>
            </View>

            <View style={styles.gridRow}>
              <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.iconStatWrapper}><Text style={{ fontSize: 16 }}>⏳</Text></View>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>PENDING SETTLEMENT</Text>
                <Text style={[styles.statValue, { color: '#FF7A00' }]}>₹{stats.pendingSettlement.toLocaleString("en-IN")}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.iconStatWrapper}><Text style={{ fontSize: 16 }}>✅</Text></View>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>TOTAL PAID</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>₹{stats.totalPaid.toLocaleString("en-IN")}</Text>
              </View>
            </View>

            {/* ACTION SETTLEMENT PANEL */}
            <View style={[styles.actionPanel, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>
                {getStatusMessage()}
              </Text>
              
              <Animated.View style={{ transform: [{ scale: actionButtonScale }], marginTop: 14 }}>
                <TouchableOpacity
                  onPressIn={animateButtonPressIn}
                  onPressOut={animateButtonPressOut}
                  onPress={handleRequestSettlement}
                  disabled={isActionDisabled}
                  style={[
                    styles.button, 
                    isActionDisabled ? styles.buttonDisabled : { backgroundColor: COLORS.emeraldGreen }
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={[styles.buttonText, isActionDisabled && styles.buttonTextDisabled]}>
                      Withdraw Earnings
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {stats.hasPendingSettlement && (
                <Text style={styles.approvalWaitSubtext}>Waiting for Admin Approval</Text>
              )}
            </View>

            {/* HISTORY RECORD SECTIONS */}
            <View style={styles.historySection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Settlement History</Text>

              {history.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>💰</Text>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No settlements yet</Text>
                  <Text style={[styles.emptyStateDesc, { color: theme.textMuted }]}>
                    Your completed payouts will appear here.
                  </Text>
                </View>
              ) : (
                history.map((item) => {
                  const badgeCfg = getStatusBadgeConfig(item.status);
                  const createdTimeInfo = formatDateTime(item.created_at);
                  const paidTimeInfo = item.paid_at ? formatDateTime(item.paid_at) : null;

                  return (
                    <View key={item.id} style={[styles.orderCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={[styles.historyCardTitleText, { color: theme.text }]}>Settlement</Text>
                          <Text style={[styles.cardAmount, { color: theme.text }]}>₹{item.amount.toLocaleString("en-IN")}</Text>
                        </View>
                        
                        <View style={[styles.statusBadge, { backgroundColor: badgeCfg.bg }]}>
                          <Text style={[styles.statusText, { color: badgeCfg.text }]}>
                            {badgeCfg.label}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

                      <View style={styles.cardDetailsRow}>
                        <View>
                          <Text style={[styles.detailsLabel, { color: theme.textMuted }]}>DELIVERIES</Text>
                          <Text style={[styles.detailsValue, { color: theme.text }]}>{item.delivery_count} Orders</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.detailsLabel, { color: theme.textMuted }]}>REQUESTED ON</Text>
                          <Text style={[styles.detailsValue, { color: theme.text }]}>{createdTimeInfo.formattedDate} {createdTimeInfo.formattedTime}</Text>
                        </View>
                      </View>

                      {/* Metadata Conditional Rendering */}
                      {item.status === "paid" && (
                        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                          <View style={styles.cardDetailsRow}>
                            <View>
                              <Text style={[styles.detailsLabel, { color: theme.textMuted }]}>UTR NUMBER</Text>
                              <Text style={[styles.detailsValueMono, { color: theme.text }]}>{item.utr_number || "N/A"}</Text>
                            </View>
                            {paidTimeInfo && (
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.detailsLabel, { color: theme.textMuted }]}>PAID DATE</Text>
                                <Text style={[styles.detailsValue, { color: theme.text }]}>{paidTimeInfo.formattedDate} {paidTimeInfo.formattedTime}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {item.status === "rejected" && item.remarks && (
                        <View style={[styles.cardFooterRejected, { backgroundColor: theme.bg }]}>
                          <Text style={styles.detailsLabelRejected}>REJECTION REASON</Text>
                          <Text style={[styles.detailsValueRejected, { color: theme.text }]}>"{item.remarks}"</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerSubtitle: {
    fontSize: 13,
    marginTop: 3,
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
  scrollContainer: {
    padding: 16,
  },
  balanceCard: {
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
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  badgeContainerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  balanceSubtext: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroCardSkeleton: {
    height: 120,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
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
  iconStatWrapper: {
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  actionPanel: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  approvalWaitSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7A00',
    textAlign: 'center',
    marginTop: 8,
  },
  historySection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyStateDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  orderCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyCardTitleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  cardDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
  },
  detailsLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  detailsValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  detailsValueMono: {
    fontSize: 13,
    fontWeight: "700",
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cardFooterRejected: {
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  detailsLabelRejected: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.danger,
    marginBottom: 2,
  },
  detailsValueRejected: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: '500',
  },
});