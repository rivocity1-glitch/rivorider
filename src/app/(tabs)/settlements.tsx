// src/app/(tabs)/settlements.tsx
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { COLORS, useTheme } from "../../context/ThemeContext";
import { supabase } from "../../lib/supabase";

interface Settlement {
  id: string;
  rider_id: string;
  amount: number;
  status: "AVAILABLE" | "REQUESTED" | "PAID" | "REJECTED";
  created_at: string;
  payment_method: string | null;
  utr_number: string | null;
  remarks: string | null;
  paid_at: string | null;
  delivery_count: number;
  order_ids?: string[] | null;
  order_count?: number | null;
}

interface Order {
  id: string;
  order_number: string | null;
  created_at: string;
  delivered_at: string | null;
  rider_earning: number | null;
  settled_rider: boolean | null;
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

export default function Settlements() {
  const { isDarkMode, theme } = useTheme();
  const [riderId, setRiderId] = useState<string | null>(null);
  const [stats, setStats] = useState<SummaryStats>({ availableBalance: 0, unsettledCount: 0, todayEarnings: 0, pendingSettlement: 0, totalPaid: 0, hasPendingSettlement: false, isDaysEligible: false });
  const [history, setHistory] = useState<Settlement[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const actionButtonScale = useRef(new Animated.Value(1)).current;

  const triggerEntranceAnimation = () => { fadeAnim.setValue(0); slideAnim.setValue(20); Animated.parallel([Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true })]).start(); };
  const formatDateTime = (dateString: string) => { if (!dateString) return { formattedDate: '', formattedTime: '' }; try { const d = new Date(dateString); const day = d.getDate().toString().padStart(2, '0'); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; let h = d.getHours(); const m = d.getMinutes().toString().padStart(2, '0'); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return { formattedDate: `${day} ${months[d.getMonth()]} ${d.getFullYear()}`, formattedTime: `${h.toString().padStart(2,'0')}:${m} ${ampm}` }; } catch { return { formattedDate: dateString, formattedTime: '' }; } };
  const getSettlementOrders = (settlement: Settlement) => { const ids = Array.isArray(settlement.order_ids) ? settlement.order_ids : []; return deliveredOrders.filter((o) => ids.includes(o.id)); };
  const getSettlementDateRange = (settlement: Settlement) => { const linked = getSettlementOrders(settlement); const times = linked.map((o) => new Date(o.delivered_at || o.created_at).getTime()).filter(Number.isFinite).sort((a,b)=>a-b); if (!times.length) return null; return { from: formatDateTime(new Date(times[0]).toISOString()).formattedDate, to: formatDateTime(new Date(times[times.length-1]).toISOString()).formattedDate }; };
  const handleShareStatement = async (settlement: Settlement) => { const linked = getSettlementOrders(settlement); const range = getSettlementDateRange(settlement); const period = range ? `${range.from} to ${range.to}` : 'Period unavailable'; const numbers = linked.map((o) => `#${o.order_number || o.id.slice(0,8)}`).join(', ') || 'Order list unavailable'; const text = ['RivoCity Rider Settlement Statement', `Settlement ID: ${settlement.id}`, `Status: ${settlement.status}`, `Amount: ₹${Number(settlement.amount || 0).toLocaleString('en-IN')}`, `Payment period: ${period}`, `Orders (${linked.length || settlement.order_count || settlement.delivery_count || 0}): ${numbers}`, settlement.utr_number ? `UTR: ${settlement.utr_number}` : '', settlement.remarks ? `Remarks: ${settlement.remarks}` : ''].filter(Boolean).join('\n'); try { await Share.share({ message: text }); } catch (error) { console.error(error); Alert.alert('Statement', 'Unable to open the sharing sheet.'); } };

  const fetchData = useCallback(async (currentRiderId: string, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const { data: deliveredOrders, error: ordersError } = await supabase.from("orders").select("id, order_number, created_at, delivered_at, rider_earning, settled_rider").eq("rider_id", currentRiderId).eq("order_status", "delivered").order("created_at", { ascending: true });
      if (ordersError) throw ordersError;
      const allDelivered: Order[] = deliveredOrders || [];
      setDeliveredOrders(allDelivered);
      const unsettledOrders = allDelivered.filter((o) => !o.settled_rider);
      const availableBalance = unsettledOrders.reduce((acc, curr) => acc + (Number(curr.rider_earning) || 0), 0);
      let isDaysEligible = false;
      const eligibleOrder = unsettledOrders.find(o => o.delivered_at !== null);
      if (eligibleOrder?.delivered_at) isDaysEligible = (Date.now() - new Date(eligibleOrder.delivered_at).getTime()) / 86400000 >= 7;
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEarnings = allDelivered.filter((o) => o.delivered_at && new Date(o.delivered_at) >= todayStart).reduce((acc,curr)=>acc+(Number(curr.rider_earning)||0),0);
      const { data: settlements, error: settlementsError } = await supabase.from("rider_settlements").select("*").eq("rider_id", currentRiderId).order("created_at", { ascending: false });
      if (settlementsError) throw settlementsError;
      const settlementList: Settlement[] = settlements || [];
      let pendingSettlement = 0; let totalPaid = 0; let hasPendingSettlement = false;
      settlementList.forEach((s) => { if (s.status === "REQUESTED") { pendingSettlement += Number(s.amount)||0; hasPendingSettlement = true; } else if (s.status === "PAID") totalPaid += Number(s.amount)||0; });
      setStats({ availableBalance, unsettledCount: unsettledOrders.length, todayEarnings, pendingSettlement, totalPaid, hasPendingSettlement, isDaysEligible });
      setHistory(settlementList); triggerEntranceAnimation();
    } catch (error: any) { console.error("Error fetching settlement data:", error); Alert.alert("Error", error.message || "Failed to load settlement data"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { async function initializeRider() { try { const { data: { user }, error: authError } = await supabase.auth.getUser(); if (authError) throw authError; if (!user) { Alert.alert("Authentication Required", "Please log in to view settlements."); setLoading(false); return; } const { data: riderData, error: riderError } = await supabase.from("riders").select("id").eq("auth_user_id", user.id).single(); if (riderError) throw riderError; if (riderData) { setRiderId(riderData.id); fetchData(riderData.id); } } catch (error:any) { console.error(error); Alert.alert("Profile Error", error.message || "Could not retrieve rider context profile."); setLoading(false); } } initializeRider(); }, [fetchData]);
  useEffect(() => { if (!riderId) return; const channel = supabase.channel("schema-db-changes").on("postgres_changes", { event: "*", schema: "public", table: "rider_settlements", filter: `rider_id=eq.${riderId}` }, () => fetchData(riderId, true)).subscribe(); return () => { supabase.removeChannel(channel); }; }, [riderId, fetchData]);
  const handlePullToRefresh = () => { if (!riderId) return; setRefreshing(true); fetchData(riderId, true); };
  const getStatusBadgeConfig = (status: string) => { switch (status) { case 'REQUESTED': return { bg: isDarkMode ? '#451A03':'#FFEFE6', text:'#FF7A00', label:'Processing' }; case 'PAID': return { bg:isDarkMode?'#064E3B':'#DCFCE7', text:'#16A34A', label:'Paid' }; case 'REJECTED': return { bg:isDarkMode?'#450A0A':'#FEE2E2', text:'#DC2626', label:'Rejected' }; case 'AVAILABLE': return { bg:isDarkMode?'#1E3A8A':'#DBEAFE', text:'#2563EB', label:'Available' }; default: return { bg:isDarkMode?'#262626':'#F3F4F6', text:'#888888', label:status.toUpperCase() }; } };
  const getStatusMessage = () => { if (stats.hasPendingSettlement) return 'Auto withdrawal is being processed.'; if (stats.availableBalance < 500) return 'Auto withdrawal will be sent on your next withdrawal date.'; if (!stats.isDaysEligible) return 'Auto withdrawal is sent every 7 days from your joining date.'; return 'Auto withdrawal will be sent on your next withdrawal date.'; };
  const SkeletonCard = () => <View style={[styles.orderCard,{backgroundColor:theme.cardBg,borderColor:theme.border,opacity:0.6}]}><View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:12}}><View style={{width:'40%',height:16,backgroundColor:'#E2E8F0',borderRadius:4}}/><View style={{width:'25%',height:20,backgroundColor:'#E2E8F0',borderRadius:8}}/></View><View style={{width:'70%',height:14,backgroundColor:'#E2E8F0',borderRadius:4,marginBottom:6}}/><View style={{width:'50%',height:14,backgroundColor:'#E2E8F0',borderRadius:4}}/></View>;

  return <View style={{flex:1,backgroundColor:theme.bg}}><View style={[styles.header,{backgroundColor:theme.headerBg,borderColor:theme.border}]}><View style={styles.headerTopRow}><View style={{flex:1}}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="wallet-outline" size={22} color={theme.text}/><Text style={[styles.headerTitle,{color:theme.text}]}>Earnings</Text></View><Text style={[styles.headerSubtitle,{color:theme.textMuted}]}>Auto withdrawal is sent to your registered bank account every 7 days.</Text></View></View></View><ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={COLORS.emeraldGreen} colors={[COLORS.emeraldGreen]}/>}>
    {loading ? <View style={{paddingVertical:10}}><View style={[styles.heroCardSkeleton,{backgroundColor:theme.cardBg,borderColor:theme.border}]}/><View style={{flexDirection:'row',gap:12,marginBottom:12}}><View style={{flex:1,height:80,backgroundColor:theme.cardBg,borderRadius:20,borderWidth:1,borderColor:theme.border}}/><View style={{flex:1,height:80,backgroundColor:theme.cardBg,borderRadius:20,borderWidth:1,borderColor:theme.border}}/></View><SkeletonCard/><SkeletonCard/></View> : <Animated.View style={{opacity:fadeAnim,transform:[{translateY:slideAnim}]}}><View style={[styles.balanceCard,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><Text style={[styles.balanceLabel,{color:theme.textMuted}]}>AVAILABLE EARNINGS</Text><Text style={[styles.balanceValue,{color:theme.text}]}>₹{stats.availableBalance.toLocaleString('en-IN')}</Text><View style={[styles.badgeContainerStatus,{backgroundColor:theme.bg}]}><View style={[styles.statusIndicatorDot,{backgroundColor:stats.hasPendingSettlement?'#FF7A00':COLORS.emeraldGreen}]}/><Text style={[styles.balanceSubtext,{color:theme.text}]}>{stats.hasPendingSettlement?'Auto withdrawal processing':'Auto withdrawal scheduled'}</Text></View></View>
      <View style={styles.gridRow}><View style={[styles.statCard,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><Ionicons name="trending-up-outline" size={18} color={COLORS.emeraldGreen}/><Text style={[styles.statLabel,{color:theme.textMuted}]}>TODAY'S EARNINGS</Text><Text style={[styles.statValue,{color:theme.text}]}>₹{stats.todayEarnings.toLocaleString('en-IN')}</Text></View><View style={[styles.statCard,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><Ionicons name="card-outline" size={18} color={COLORS.emeraldGreen}/><Text style={[styles.statLabel,{color:theme.textMuted}]}>AVAILABLE EARNINGS</Text><Text style={[styles.statValue,{color:COLORS.emeraldGreen}]}>₹{stats.availableBalance.toLocaleString('en-IN')}</Text></View></View>
      <View style={styles.gridRow}><View style={[styles.statCard,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><Ionicons name="time-outline" size={18} color="#FF7A00"/><Text style={[styles.statLabel,{color:theme.textMuted}]}>PENDING AUTO WITHDRAWAL</Text><Text style={[styles.statValue,{color:'#FF7A00'}]}>₹{stats.pendingSettlement.toLocaleString('en-IN')}</Text></View><View style={[styles.statCard,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><Ionicons name="checkmark-circle-outline" size={18} color={theme.text}/><Text style={[styles.statLabel,{color:theme.textMuted}]}>TOTAL PAID</Text><Text style={[styles.statValue,{color:theme.text}]}>₹{stats.totalPaid.toLocaleString('en-IN')}</Text></View></View>
      <View style={[styles.actionPanel,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><Text style={[styles.actionTitle,{color:theme.text}]}>{getStatusMessage()}</Text><View style={[styles.autoPayoutCard,{backgroundColor:theme.bg,borderColor:theme.border}]}><View style={styles.autoPayoutIcon}><Ionicons name="calendar-outline" size={21} color={COLORS.emeraldGreen}/></View><View style={{flex:1}}><Text style={[styles.autoPayoutTitle,{color:theme.text}]}>Auto Withdrawal</Text><Text style={[styles.autoPayoutText,{color:theme.textMuted}]}>Auto withdrawal is sent every 7 days based on your joining date. It may take a few working days to reach your bank account.</Text></View></View>{stats.hasPendingSettlement&&<Text style={styles.approvalWaitSubtext}>Auto withdrawal processing</Text>}</View>
      <View style={styles.historySection}><Text style={[styles.sectionTitle,{color:theme.text}]}>Auto Withdrawal History</Text>{history.length===0?<View style={styles.emptyStateContainer}><Ionicons name="receipt-outline" size={48} color={theme.textMuted} style={{marginBottom:8}}/><Text style={[styles.emptyStateTitle,{color:theme.text}]}>No auto withdrawals yet</Text><Text style={[styles.emptyStateDesc,{color:theme.textMuted}]}>Sent auto withdrawals will appear here.</Text></View>:history.map((item)=>{const badgeCfg=getStatusBadgeConfig(item.status);const created=formatDateTime(item.created_at);const paid=item.paid_at?formatDateTime(item.paid_at):null;const linked=getSettlementOrders(item);const range=getSettlementDateRange(item);return <View key={item.id} style={[styles.orderCard,{backgroundColor:theme.cardBg,borderColor:theme.border}]}><View style={styles.cardHeader}><View><Text style={[styles.cardAmount,{color:theme.text}]}>₹{Number(item.amount||0).toLocaleString('en-IN')}</Text><Text style={[styles.smallMetaText,{color:theme.textMuted}]}>Request sent: {created.formattedDate} {created.formattedTime}</Text></View><View style={[styles.statusBadge,{backgroundColor:badgeCfg.bg}]}><Text style={[styles.statusText,{color:badgeCfg.text}]}>{badgeCfg.label}</Text></View></View><View style={[styles.cardDivider,{backgroundColor:theme.border}]}/><View style={styles.detailStack}><View style={styles.cardDetailsRow}><Text style={[styles.detailsLabel,{color:theme.textMuted}]}>ORDERS INCLUDED</Text><Text style={[styles.detailsValue,{color:theme.text}]}>{linked.length||item.order_count||item.delivery_count||0}</Text></View><View style={styles.cardDetailsRow}><Text style={[styles.detailsLabel,{color:theme.textMuted}]}>PAYMENT PERIOD</Text><Text style={[styles.detailsValue,{color:theme.text,flex:1,textAlign:'right'}]}>{range?`${range.from} → ${range.to}`:'Not available'}</Text></View><View style={{marginTop:4}}><Text style={[styles.detailsLabel,{color:theme.textMuted}]}>ORDER NUMBERS</Text><Text style={[styles.detailsValueMono,{color:theme.text}]}>{linked.length?linked.map((o)=>`#${o.order_number||o.id.slice(0,8)}`).join(', '):'Order list unavailable'}</Text></View></View>{item.status==='PAID'&&<View style={[styles.cardFooter,{borderTopColor:theme.border}]}><View style={styles.cardDetailsRow}><View><Text style={[styles.detailsLabel,{color:theme.textMuted}]}>UTR NUMBER</Text><Text style={[styles.detailsValueMono,{color:theme.text}]}>{item.utr_number||'N/A'}</Text></View>{paid&&<View style={{alignItems:'flex-end'}}><Text style={[styles.detailsLabel,{color:theme.textMuted}]}>PAID DATE</Text><Text style={[styles.detailsValue,{color:theme.text}]}>{paid.formattedDate} {paid.formattedTime}</Text></View>}</View></View>}{item.status==='REJECTED'&&item.remarks&&<View style={[styles.cardFooterRejected,{backgroundColor:theme.bg}]}><Text style={styles.detailsLabelRejected}>REJECTION REASON</Text><Text style={[styles.detailsValueRejected,{color:theme.text}]}>{item.remarks}</Text></View>}<TouchableOpacity onPress={()=>handleShareStatement(item)} style={[styles.statementButton,{backgroundColor:theme.bg,borderColor:theme.border}]}><Ionicons name="share-social-outline" size={16} color={COLORS.emeraldGreen}/><Text style={[styles.statementButtonText,{color:theme.text}]}>Share Statement</Text></TouchableOpacity></View>;})}</View>
    </Animated.View>}
  </ScrollView></View>;
}

const styles=StyleSheet.create({header:{paddingTop:Platform.OS==='ios'?64:44,paddingBottom:24,paddingHorizontal:20,borderBottomWidth:1,borderBottomLeftRadius:32,borderBottomRightRadius:32},headerTopRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},headerTitle:{fontSize:26,fontWeight:'700'},headerSubtitle:{fontSize:12,marginTop:2},scrollContainer:{padding:16},balanceCard:{borderRadius:24,padding:20,marginBottom:16,borderWidth:1},balanceLabel:{fontSize:11,fontWeight:'700',letterSpacing:0.5},balanceValue:{fontSize:34,fontWeight:'900',marginTop:6,letterSpacing:-0.5},badgeContainerStatus:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:6,borderRadius:10,marginTop:12},statusIndicatorDot:{width:8,height:8,borderRadius:4,marginRight:8},balanceSubtext:{fontSize:12,fontWeight:'600'},heroCardSkeleton:{height:120,borderRadius:24,borderWidth:1,marginBottom:16},gridRow:{flexDirection:'row',gap:12,marginBottom:12},statCard:{flex:1,borderRadius:24,padding:20,borderWidth:1},iconStatWrapper:{marginBottom:8},statLabel:{fontSize:10,fontWeight:'700',letterSpacing:0.3},statValue:{fontSize:20,fontWeight:'800',marginTop:4,letterSpacing:-0.3},actionPanel:{borderRadius:24,padding:20,marginBottom:20,borderWidth:1},actionTitle:{fontSize:14,fontWeight:'600',lineHeight:20,textAlign:'center'},autoPayoutCard:{flexDirection:'row',alignItems:'flex-start',borderRadius:16,borderWidth:1,padding:14,marginTop:12},autoPayoutIcon:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:COLORS.emeraldGreen+'18',marginRight:11},autoPayoutTitle:{fontSize:13,fontWeight:'800',marginBottom:3},autoPayoutText:{fontSize:11,lineHeight:16},approvalWaitSubtext:{fontSize:12,fontWeight:'600',color:'#FF7A00',textAlign:'center',marginTop:8},historySection:{marginTop:4},sectionTitle:{fontSize:16,fontWeight:'700',marginBottom:12,letterSpacing:-0.3},emptyStateContainer:{alignItems:'center',justifyContent:'center',paddingVertical:48},emptyStateTitle:{fontSize:15,fontWeight:'700'},emptyStateDesc:{fontSize:12,marginTop:2},orderCard:{borderRadius:24,padding:20,marginBottom:16,borderWidth:1},cardHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},cardAmount:{fontSize:20,fontWeight:'800',marginTop:2,letterSpacing:-0.3},smallMetaText:{fontSize:11,marginTop:2},statusBadge:{paddingHorizontal:12,paddingVertical:6,borderRadius:12},statusText:{fontSize:11,fontWeight:'800'},cardDivider:{height:1,marginVertical:14},detailStack:{gap:8},cardDetailsRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},detailsLabel:{fontSize:10,fontWeight:'700',marginBottom:2},detailsValue:{fontSize:13,fontWeight:'700'},detailsValueMono:{fontSize:12,fontWeight:'700',lineHeight:18},cardFooter:{marginTop:14,paddingTop:14,borderTopWidth:1},cardFooterRejected:{padding:12,borderRadius:12,marginTop:14},detailsLabelRejected:{fontSize:10,fontWeight:'800',color:COLORS.danger,marginBottom:4},detailsValueRejected:{fontSize:13,fontStyle:'italic',fontWeight:'500',lineHeight:18},statementButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:11,borderRadius:12,borderWidth:1,marginTop:14},statementButtonText:{fontSize:12,fontWeight:'700'}});