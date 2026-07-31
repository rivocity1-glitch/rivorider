// src/app/notifications.tsx
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
  View,
} from 'react-native';
import { COLORS, useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  RiderNotification as Notification,
  subscribeToNotifications,
} from '../services/notifications';

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

// --- Configuration Maps (Using Standard Expo Ionicons) ---
const typeConfigs: Record<
  NotificationType | 'unknown',
  { iconName: keyof typeof Ionicons.glyphMap; category: 'Orders' | 'Finance' | 'SOS' | 'KYC' | 'Announcements' | 'System' }
> = {
  new_order: { iconName: 'cube-outline', category: 'Orders' },
  order_ready: { iconName: 'cube-outline', category: 'Orders' },
  pickup_started: { iconName: 'bicycle-outline', category: 'Orders' },
  out_for_delivery: { iconName: 'navigate-outline', category: 'Orders' },
  delivery_completed: { iconName: 'checkmark-circle-outline', category: 'Orders' },
  order_cancelled: { iconName: 'close-circle-outline', category: 'Orders' },
  settlement_requested: { iconName: 'cash-outline', category: 'Finance' },
  settlement_approved: { iconName: 'wallet-outline', category: 'Finance' },
  settlement_rejected: { iconName: 'alert-circle-outline', category: 'Finance' },
  payment_received: { iconName: 'cash-outline', category: 'Finance' },
  kyc_under_review: { iconName: 'time-outline', category: 'KYC' },
  kyc_verified: { iconName: 'shield-checkmark-outline', category: 'KYC' },
  kyc_rejected: { iconName: 'document-text-outline', category: 'KYC' },
  profile_updated: { iconName: 'person-outline', category: 'System' },
  announcement: { iconName: 'megaphone-outline', category: 'Announcements' },
  system_update: { iconName: 'settings-outline', category: 'System' },
  sos_sent: { iconName: 'warning-outline', category: 'SOS' },
  sos_accepted: { iconName: 'medical-outline', category: 'SOS' },
  sos_closed: { iconName: 'checkmark-done-circle-outline', category: 'SOS' },
  unknown: { iconName: 'notifications-outline', category: 'System' },
};

const categoryColors = {
  Orders: { bg: '#E3F2FD', text: '#0D47A1' },
  Finance: { bg: '#E8F5E9', text: '#1B5E20' },
  SOS: { bg: '#FFEBEE', text: '#B71C1C' },
  KYC: { bg: '#FFF3E0', text: '#E65100' },
  Announcements: { bg: '#F3E5F5', text: '#4A148C' },
  System: { bg: '#ECEFF1', text: '#263238' },
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
const SkeletonCard = ({ theme }: { theme: any }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <View style={[styles.skeletonCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Animated.View style={[styles.skeletonText, { width: '60%', height: 16, opacity }]} />
          <Animated.View style={[styles.skeletonText, { width: '40%', height: 12, marginTop: 6, opacity }]} />
        </View>
      </View>
      <Animated.View style={[styles.skeletonText, { width: '90%', height: 14, marginTop: 12, opacity }]} />
    </View>
  );
};

// --- Main Component ---
export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riderId, setRiderId] = useState<string | null>(null);

  // Modal State
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [longPressedNotification, setLongPressedNotification] = useState<Notification | null>(null);

  const resolveRiderId = async (): Promise<string | null> => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) return null;

      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (riderError || !riderData?.id) return null;

      return riderData.id;
    } catch (err) {
      console.error('Error resolving rider ID:', err);
      return null;
    }
  };

  const fetchNotifications = async (showTriggerLoading = false) => {
    if (showTriggerLoading) setLoading(true);
    try {
      const rId = riderId || (await resolveRiderId());

      if (!rId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setRiderId(rId);

      const data = await getNotifications(rId);
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  useEffect(() => {
    if (!riderId) return;

    const unsubscribe = subscribeToNotifications(riderId, () => {
      fetchNotifications(false);
    });

    return () => {
      unsubscribe();
    };
  }, [riderId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(false);
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const handleNotificationTap = async (item: Notification) => {
    if (!item.is_read && riderId) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );

      await markNotificationAsRead(item.id);
    }

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
    if (!riderId) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setLongPressedNotification(null);

    await markNotificationAsRead(id);
  };

  const handleMarkAllRead = async () => {
    if (!riderId) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    await markAllNotificationsAsRead(riderId);
  };

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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header View */}
      <View style={[styles.headerContainer, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllHeaderBtn}>
              <Text style={styles.markAllHeaderText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Stay updated with deliveries, settlements and important announcements.
        </Text>
      </View>

      {/* Search Input Layout */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search notifications"
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Content Scroller Area */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <SkeletonCard theme={theme} />
          <SkeletonCard theme={theme} />
          <SkeletonCard theme={theme} />
        </ScrollView>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.emeraldGreen} />}
        >
          <Ionicons name="notifications-off-outline" size={48} color={theme.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications yet</Text>
          <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
            Updates about deliveries, settlements and announcements will appear here automatically.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.emeraldGreen} />}
        >
          {(['Today', 'Yesterday', 'Earlier'] as const).map((groupKey) => {
            const items = groupedNotifications[groupKey];
            if (items.length === 0) return null;

            return (
              <View key={groupKey} style={styles.sectionContainer}>
                <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>{groupKey}</Text>
                {items.map((item) => {
                  const config = typeConfigs[item.type as NotificationType] || typeConfigs.unknown;
                  const colors = categoryColors[config.category];

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
                        { backgroundColor: theme.cardBg, borderColor: theme.border },
                        !item.is_read && styles.unreadCardBorder,
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.iconWrapper, { backgroundColor: colors.bg }]}>
                          <Ionicons name={config.iconName} size={18} color={colors.text} />
                        </View>
                        <View style={styles.titleWrapper}>
                          <Text
                            style={[styles.cardTitle, { color: theme.text }, !item.is_read && styles.boldText]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text style={[styles.timeText, { color: theme.textMuted }]}>
                            {formatRelativeTime(item.created_at)}
                          </Text>
                        </View>
                        {!item.is_read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={[styles.cardMessage, { color: theme.textMuted }]} numberOfLines={3}>
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

      {/* Options Drawer Modal Sheet */}
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
          <View style={[styles.actionSheetContainer, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={1}>
              {longPressedNotification?.title}
            </Text>
            <TouchableOpacity
              style={[styles.sheetButton, { backgroundColor: theme.bg }]}
              onPress={() => longPressedNotification && handleMarkAsRead(longPressedNotification.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.emeraldGreen} />
              <Text style={[styles.sheetButtonText, { color: COLORS.emeraldGreen }]}>Mark as Read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetCancelBtn]}
              onPress={() => setLongPressedNotification(null)}
            >
              <Text style={[styles.sheetCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Broadcast Detail Modal */}
      <Modal
        visible={selectedNotification !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>
                {selectedNotification?.type === 'announcement' ? 'Announcement' : 'System Update'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedNotification(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitleText, { color: theme.text }]}>
                {selectedNotification?.title}
              </Text>
              <Text style={[styles.modalDateText, { color: theme.textMuted }]}>
                {selectedNotification?.created_at ? new Date(selectedNotification.created_at).toLocaleString('en-GB') : ''}
              </Text>
              <View style={[styles.modalDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.modalMessageText, { color: theme.text }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  badgeContainer: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllHeaderBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 99,
  },
  markAllHeaderText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  unreadCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.emeraldGreen,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: COLORS.emeraldGreen,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 99,
    marginBottom: 12,
  },
  sheetButtonText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
  sheetCancelBtn: {
    backgroundColor: 'transparent',
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalContent: {
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
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
  modalMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalCloseButton: {
    backgroundColor: COLORS.emeraldGreen,
    height: 52,
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  skeletonCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  skeletonText: {
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
});