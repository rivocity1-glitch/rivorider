import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';

// --- Types & Interfaces ---
export type NotificationType =
  | 'new_order'
  | 'order_ready'
  | 'pickup_started'
  | 'out_for_delivery'
  | 'delivery_completed'
  | 'order_cancelled'
  | 'settlement_requested'
  | 'settlement_approved'
  | 'settlement_rejected'
  | 'payment_received'
  | 'kyc_under_review'
  | 'kyc_verified'
  | 'kyc_rejected'
  | 'profile_updated'
  | 'announcement'
  | 'system_update'
  | 'sos_sent'
  | 'sos_accepted'
  | 'sos_closed';

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: NotificationType;
  recipient_type: 'rider';
  reference_id: string | null;
  metadata: Record<string, any> | null;
}

// --- Configuration Maps ---
const typeConfigs: Record<NotificationType | 'unknown', { icon: string; category: 'Orders' | 'Finance' | 'SOS' | 'KYC' | 'Announcements' | 'System' } > = {
  new_order: { icon: '🆕', category: 'Orders' },
  order_ready: { icon: '📦', category: 'Orders' },
  pickup_started: { icon: '🚚', category: 'Orders' },
  out_for_delivery: { icon: '🚛', category: 'Orders' },
  delivery_completed: { icon: '✅', category: 'Orders' },
  order_cancelled: { icon: '❌', category: 'Orders' },
  settlement_requested: { icon: '💰', category: 'Finance' },
  settlement_approved: { icon: '💸', category: 'Finance' },
  settlement_rejected: { icon: '⚠️', category: 'Finance' },
  payment_received: { icon: '💵', category: 'Finance' },
  kyc_under_review: { icon: '🛡️', category: 'KYC' },
  kyc_verified: { icon: '✅', category: 'KYC' },
  kyc_rejected: { icon: '📄', category: 'KYC' },
  profile_updated: { icon: '👤', category: 'System' },
  announcement: { icon: '📢', category: 'Announcements' },
  system_update: { icon: '⚙️', category: 'System' },
  sos_sent: { icon: '🚨', category: 'SOS' },
  sos_accepted: { icon: '🚑', category: 'SOS' },
  sos_closed: { icon: '✅', category: 'SOS' },
  unknown: { icon: '🔔', category: 'System' },
};

const categoryColors = {
  Orders: { light: '#E3F2FD', dark: '#1565C0', textLight: '#0D47A1', textDark: '#90CAF9' },
  Finance: { light: '#E8F5E9', dark: '#2E7D32', textLight: '#1B5E20', textDark: '#A5D6A7' },
  SOS: { light: '#FFEBEE', dark: '#C62828', textLight: '#B71C1C', textDark: '#EF9A9A' },
  KYC: { light: '#FFF3E0', dark: '#EF6C00', textLight: '#E65100', textDark: '#FFCC80' },
  Announcements: { light: '#F3E5F5', dark: '#6A1B9A', textLight: '#4A148C', textDark: '#CE93D8' },
  System: { light: '#ECEFF1', dark: '#37474F', textLight: '#263238', textDark: '#CFD8DC' },
};

// --- Utility Helpers ---
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(now.getDate() - 2);
  if (date.toDateString() === twoDaysAgo.toDateString()) return '2 days ago';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getGroupSection(dateString: string): 'Today' | 'Yesterday' | 'Earlier' {
  const now = new Date();
  const date = new Date(dateString);
  if (date.toDateString() === now.toDateString()) return 'Today';
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return 'Earlier';
}

// --- Skeleton Component ---
const SkeletonCard = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight, { opacity: 0.85 }]}>
      <View style={styles.cardHeader}>
        <Animated.View style={[styles.skeletonIcon, { opacity, backgroundColor: isDark ? '#444' : '#E0E0E0' }]} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Animated.View style={[styles.skeletonText, { width: '60%', height: 16, opacity, backgroundColor: isDark ? '#444' : '#E0E0E0' }]} />
          <Animated.View style={[styles.skeletonText, { width: '40%', height: 12, marginTop: 6, opacity, backgroundColor: isDark ? '#444' : '#E0E0E0' }]} />
        </View>
      </View>
      <Animated.View style={[styles.skeletonText, { width: '90%', height: 14, marginTop: 12, opacity, backgroundColor: isDark ? '#444' : '#E0E0E0' }]} />
    </View>
  );
};

// --- Main Component ---
export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riderId, setRiderId] = useState<string | null>(null);
  
  // Modal State
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  // Action sheet / context option states
  const [longPressedNotification, setLongPressedNotification] = useState<Notification | null>(null);

  // Fetch Notifications Logic
  const fetchNotifications = async (showTriggerLoading = false) => {
    if (showTriggerLoading) setLoading(true);
    try {
      // Step 1: Get the authenticated user.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("AUTH USER:", user);

      if (authError || !user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Step 2: Query the riders table using auth_user_id.
      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      console.log("RIDER:", riderData);

      if (riderError || !riderData) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Step 3: Store the returned riders.id in state.
      setRiderId(riderData.id);

      // Step 4 & 6: Fetch notifications using riderData.id
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_type', 'rider')
        .eq('recipient_id', riderData.id)
        .order('created_at', { ascending: false });

      console.log("NOTIFICATION ERROR:", error);
      console.log("NOTIFICATIONS:", data);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Setup initial fetching and Dynamic Realtime Sync channel bindings
  useEffect(() => {
    fetchNotifications(true);
  }, []);

  useEffect(() => {
    if (!riderId) return;

    const channel = supabase
      .channel('realtime-rider-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_type=eq.rider`,
        },
        (payload) => {
          console.log("INSERT PAYLOAD:", payload);
          const newNotif = payload.new as Notification;
          // Step 5: Use riderId state filter inside realtime block matching.
          if (newNotif.recipient_id === riderId) {
            setNotifications((prev) => [newNotif, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_type=eq.rider`,
        },
        (payload) => {
          console.log("UPDATE PAYLOAD:", payload);
          const updatedNotif = payload.new as Notification;
          // Step 5: Use riderId state filter inside realtime block matching.
          if (updatedNotif.recipient_id === riderId) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            );
          }
        }
      )
      .subscribe((status) => {
          console.log("NOTIFICATION STATUS:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(false);
  };

  // Exposing dynamic calculated unread value cleanly for internal metrics/tab updates
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Handle Tap updates & navigations
  const handleNotificationTap = async (item: Notification) => {
    if (!item.is_read) {
      // Optimistic state updates
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      
      // Persist state to remote database
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.id);
    }

    // Direct routing actions based on configurations matrix
    switch (item.type) {
      case 'new_order':
      case 'order_ready':
      case 'pickup_started':
      case 'out_for_delivery':
      case 'delivery_completed':
      case 'order_cancelled':
        router.push('/(tabs)/deliveries');
        break;
      case 'settlement_requested':
      case 'settlement_approved':
      case 'settlement_rejected':
      case 'payment_received':
        router.push('/(tabs)/settlements');
        break;
      case 'kyc_under_review':
      case 'kyc_verified':
      case 'kyc_rejected':
      case 'profile_updated':
        router.push('/(tabs)/profile');
        break;
      case 'sos_sent':
      case 'sos_accepted':
      case 'sos_closed':
        router.push('/(tabs)/dashboard');
        break;
      case 'announcement':
      case 'system_update':
        setSelectedNotification(item);
        break;
      default:
        break;
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setLongPressedNotification(null);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  };

  // Filtered and Grouped Notifications Computation
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const matchQuery = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(matchQuery) ||
        n.message.toLowerCase().includes(matchQuery)
      );
    });
  }, [notifications, searchQuery]);

  const groupedNotifications = useMemo(() => {
    const groups: { Today: Notification[]; Yesterday: Notification[]; Earlier: Notification[] } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredNotifications.forEach((n) => {
      const targetGroup = getGroupSection(n.created_at);
      groups[targetGroup].push(n);
    });

    return groups;
  }, [filteredNotifications]);

  const activeThemeStyles = isDark ? darkTheme : lightTheme;

  return (
    <View style={[styles.container, activeThemeStyles.bg]}>
      {/* Header Context View Block */}
      <View style={[styles.headerContainer, activeThemeStyles.borderBottom]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, activeThemeStyles.textMain]}>🔔 Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.headerSubtitle, activeThemeStyles.textSecondary]}>
          Stay updated with deliveries, settlements and important announcements.
        </Text>
      </View>

      {/* Search Input Layout */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isDark ? styles.searchBarDark : styles.searchBarLight]}>
          <Ionicons name="search-outline" size={18} color={isDark ? '#AAA' : '#666'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, activeThemeStyles.textMain]}
            placeholder="Search notifications"
            placeholderTextColor={isDark ? '#777' : '#999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Content Scroller Area */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDark ? '#FFF' : '#000'} />}
        >
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={[styles.emptyTitle, activeThemeStyles.textMain]}>No notifications yet</Text>
          <Text style={[styles.emptyDesc, activeThemeStyles.textSecondary]}>
            Updates about deliveries, settlements and announcements will appear here automatically.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDark ? '#FFF' : '#000'} />}
        >
          {(['Today', 'Yesterday', 'Earlier'] as const).map((groupKey) => {
            const items = groupedNotifications[groupKey];
            if (items.length === 0) return null;

            return (
              <View key={groupKey} style={styles.sectionContainer}>
                <Text style={[styles.sectionHeader, activeThemeStyles.textSecondary]}>{groupKey}</Text>
                {items.map((item) => {
                  const config = typeConfigs[item.type] || typeConfigs.unknown;
                  const colors = categoryColors[config.category];
                  const iconBackground = isDark ? colors.dark : colors.light;
                  const iconTextColor = isDark ? colors.textDark : colors.textLight;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => handleNotificationTap(item)}
                      onLongPress={() => {
                        if (!item.is_read) setLongPressedNotification(item);
                      }}
                      style={[
                        styles.card,
                        isDark ? styles.cardDark : styles.cardLight,
                        !item.is_read && styles.unreadCardBorder,
                        !item.is_read && (isDark ? styles.cardElevatedDark : styles.cardElevatedLight),
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.iconWrapper, { backgroundColor: iconBackground }]}>
                          <Text style={[styles.iconText, { color: iconTextColor }]}>{config.icon}</Text>
                        </View>
                        <View style={styles.titleWrapper}>
                          <Text
                            style={[
                              styles.cardTitle,
                              activeThemeStyles.textMain,
                              !item.is_read && styles.boldText,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text style={[styles.timeText, activeThemeStyles.textSecondary]}>
                            {formatRelativeTime(item.created_at)}
                          </Text>
                        </View>
                        {!item.is_read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={[styles.cardMessage, activeThemeStyles.textSecondary]} numberOfLines={3}>
                        {item.message}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Long Press Detail Options Drawer Modal Sheet */}
      <Modal
        visible={longPressedNotification !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLongPressedNotification(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setLongPressedNotification(null)}
        >
          <View style={[styles.actionSheetContainer, isDark ? styles.sheetDark : styles.sheetLight]}>
            <Text style={[styles.sheetTitle, activeThemeStyles.textMain]} numberOfLines={1}>
              {longPressedNotification?.title}
            </Text>
            <TouchableOpacity
              style={[styles.sheetButton, isDark ? styles.sheetBtnBorderDark : styles.sheetBtnBorderLight]}
              onPress={() => longPressedNotification && handleMarkAsRead(longPressedNotification.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#2E7D32" />
              <Text style={[styles.sheetButtonText, { color: '#2E7D32', marginLeft: 10 }]}>Mark as Read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetCancelBtn]}
              onPress={() => setLongPressedNotification(null)}
            >
              <Text style={[styles.sheetButtonText, activeThemeStyles.textMain]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail Modal Component for Broadcast Elements */}
      <Modal
        visible={selectedNotification !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark ? styles.modalContentDark : styles.modalContentLight]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalHeaderTitle, activeThemeStyles.textMain]}>
                {selectedNotification?.type === 'announcement' ? '📢 Announcement' : '⚙️ System Update'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedNotification(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitleText, activeThemeStyles.textMain]}>
                {selectedNotification?.title}
              </Text>
              <Text style={[styles.modalDateText, activeThemeStyles.textSecondary]}>
                {selectedNotification?.created_at ? new Date(selectedNotification.created_at).toLocaleString('en-GB') : ''}
              </Text>
              <View style={[styles.modalDivider, isDark ? styles.dividerDark : styles.dividerLight]} />
              <Text style={[styles.modalMessageText, activeThemeStyles.textMain]}>
                {selectedNotification?.message}
              </Text>
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setSelectedNotification(null)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Dynamic Styling Definitions ---
const lightTheme = StyleSheet.create({
  bg: { backgroundColor: '#F8F9FA' },
  textMain: { color: '#1A1A1A' },
  textSecondary: { color: '#666666' },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
});

const darkTheme = StyleSheet.create({
  bg: { backgroundColor: '#121212' },
  textMain: { color: '#FFFFFF' },
  textSecondary: { color: '#AAAAAA' },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#222222' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  badgeContainer: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchBarLight: {
    backgroundColor: '#EEEEEE',
  },
  searchBarDark: {
    backgroundColor: '#1E1E1E',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionContainer: {
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#1E1E1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  cardElevatedLight: {
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardElevatedDark: {
    backgroundColor: '#252525',
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  titleWrapper: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 48,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionSheetContainer: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetLight: { backgroundColor: '#FFF' },
  sheetDark: { backgroundColor: '#1C1C1E' },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    marginBottom: 12,
  },
  sheetBtnBorderLight: { backgroundColor: '#F5F5F5' },
  sheetBtnBorderDark: { backgroundColor: '#2C2C2E' },
  sheetCancelBtn: { backgroundColor: 'transparent' },
  sheetButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalContent: {
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalContentLight: { backgroundColor: '#FFFFFF' },
  modalContentDark: { backgroundColor: '#1E1E1E' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeIconBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalTitleText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 6,
  },
  modalDateText: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  dividerLight: { backgroundColor: '#EEEEEE' },
  dividerDark: { backgroundColor: '#2C2C2E' },
  modalMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalCloseButton: {
    backgroundColor: '#000000',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  skeletonText: {
    borderRadius: 4,
  },
});