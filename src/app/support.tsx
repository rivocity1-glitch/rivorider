import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'high' | 'medium' | 'low';
  issue_type: string | null;
  created_at: string;
};

const statusLabel: Record<Ticket['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SupportScreen() {
  const router = useRouter();
  const [riderId, setRiderId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [problemTitle, setProblemTitle] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets(showSpinner = true) {
    try {
      if (showSpinner) setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/(auth)/login' as any);
        return;
      }

      const { data: rider, error: riderError } = await supabase
        .from('riders')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (riderError) throw riderError;
      if (!rider) throw new Error('Rider profile could not be found.');

      setRiderId(rider.id);

      const { data, error } = await supabase
        .from('rider_support_tickets')
        .select('id,title,description,status,priority,issue_type,created_at')
        .eq('rider_id', rider.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (error: any) {
      console.error('Rider support tickets load failed:', error);
      Alert.alert(
        'Unable to load support',
        error?.message || 'Please try again later.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function submitProblem() {
    if (!riderId || submitting) return;

    if (!problemTitle.trim()) {
      Alert.alert('Title required', 'Please enter a short problem title.');
      return;
    }

    if (problemDescription.trim().length < 5) {
      Alert.alert('Description required', 'Please describe the problem.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('rider_support_tickets')
        .insert({
          rider_id: riderId,
          title: problemTitle.trim(),
          description: problemDescription.trim(),
          status: 'open',
          priority: 'medium',
          issue_type: 'problem',
          unread_for_admin: true,
        });

      if (error) throw error;

      setProblemTitle('');
      setProblemDescription('');
      setShowProblemForm(false);

      await loadTickets(false);

      Alert.alert(
        'Problem reported',
        'Your report has been sent to the Rivo support team.'
      );
    } catch (error: any) {
      console.error('Rider problem report failed:', error);
      Alert.alert(
        'Unable to report problem',
        error?.message || 'Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const openContact = async () => {
    const emailUrl = 'mailto:support@rivocity.com';

    try {
      const supported = await Linking.canOpenURL(emailUrl);
      if (!supported) {
        Alert.alert('Contact Support', 'Email support@rivocity.com');
        return;
      }

      await Linking.openURL(emailUrl);
    } catch {
      Alert.alert('Contact Support', 'Email support@rivocity.com');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="headset-outline" size={24} color="#A8E63A" />
          </View>
          <Text style={styles.heroTitle}>Rivo Rider Support</Text>
          <Text style={styles.heroText}>
            Send feedback, report a problem, or contact the Rivo support team.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push('/feedback' as any)}
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="star-outline" size={22} color="#A8E63A" />
            </View>
            <Text style={styles.actionTitle}>Send Feedback</Text>
            <Text style={styles.actionText}>
              Rate your Rider app experience.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowProblemForm((value) => !value)}
            style={styles.actionCard}
          >
            <View style={styles.problemIcon}>
              <Ionicons name="flag-outline" size={22} color="#F87171" />
            </View>
            <Text style={styles.actionTitle}>Report a Problem</Text>
            <Text style={styles.actionText}>
              Tell us about an issue.
            </Text>
          </Pressable>
        </View>

        {showProblemForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Report a Problem</Text>

            <TextInput
              value={problemTitle}
              onChangeText={setProblemTitle}
              placeholder="Problem title"
              placeholderTextColor="#737373"
              style={styles.input}
            />

            <TextInput
              value={problemDescription}
              onChangeText={setProblemDescription}
              placeholder="Describe the problem..."
              placeholderTextColor="#737373"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />

            <View style={styles.formActions}>
              <Pressable
                onPress={() => setShowProblemForm(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitProblem}
                disabled={submitting}
                style={[styles.submitButton, submitting && styles.disabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#0D0D0D" size="small" />
                ) : (
                  <Ionicons name="send-outline" size={17} color="#0D0D0D" />
                )}
                <Text style={styles.submitText}>
                  {submitting ? 'Sending...' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          onPress={openContact}
          style={styles.contactCard}
        >
          <View style={styles.contactIcon}>
            <Ionicons name="mail-outline" size={20} color="#A8E63A" />
          </View>

          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Contact Us</Text>
            <Text style={styles.contactValue}>support@rivocity.com</Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={19}
            color="#737373"
          />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Support Requests</Text>
          <Text style={styles.sectionCount}>{tickets.length}</Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#A8E63A" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="documents-outline"
              size={30}
              color="#525252"
            />
            <Text style={styles.emptyTitle}>No support requests</Text>
            <Text style={styles.emptyText}>
              Problem reports you submit will appear here.
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <View
              key={ticket.id}
              style={styles.ticketCard}
            >
              <View style={styles.ticketTop}>
                <View style={styles.ticketTitleBlock}>
                  <Text
                    style={styles.ticketTitle}
                    numberOfLines={1}
                  >
                    {ticket.title}
                  </Text>

                  <Text style={styles.ticketMeta}>
                    {ticket.issue_type || 'Support'} ·{' '}
                    {formatDate(ticket.created_at)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    ticket.status === 'resolved'
                      ? styles.statusResolved
                      : ticket.status === 'closed'
                      ? styles.statusClosed
                      : styles.statusOpen,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {statusLabel[ticket.status]}
                  </Text>
                </View>
              </View>

              <Text
                style={styles.ticketDescription}
                numberOfLines={3}
              >
                {ticket.description}
              </Text>
            </View>
          ))
        )}

        <Pressable
          onPress={() => {
            setRefreshing(true);
            loadTickets(false);
          }}
          style={styles.refreshButton}
        >
          <Ionicons
            name="refresh-outline"
            size={17}
            color="#A8E63A"
          />
          <Text style={styles.refreshText}>Refresh Requests</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  hero: {
    backgroundColor: '#171717',
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  heroText: {
    color: '#A3A3A3',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 150,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  problemIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#291616',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#A3A3A3',
    marginTop: 5,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    padding: 16,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: '#FFFFFF',
    backgroundColor: '#0D0D0D',
    fontSize: 14,
    marginBottom: 10,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 13,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 2,
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4D4D4',
  },
  submitButton: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 17,
    backgroundColor: '#A8E63A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  submitText: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  contactCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 17,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 24,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
    marginLeft: 11,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  contactValue: {
    fontSize: 12,
    color: '#A3A3A3',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sectionCount: {
    minWidth: 28,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#242424',
    color: '#A8E63A',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  loading: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyCard: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#171717',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 9,
  },
  emptyText: {
    fontSize: 12,
    color: '#A3A3A3',
    textAlign: 'center',
    marginTop: 4,
  },
  ticketCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#171717',
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ticketTitleBlock: {
    flex: 1,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ticketMeta: {
    fontSize: 11,
    color: '#737373',
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusOpen: {
    backgroundColor: '#2A220D',
    borderColor: '#6B5414',
  },
  statusResolved: {
    backgroundColor: '#132A10',
    borderColor: '#315B25',
  },
  statusClosed: {
    backgroundColor: '#202020',
    borderColor: '#383838',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4D4D4',
  },
  ticketDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#A3A3A3',
    marginTop: 9,
  },
  refreshButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 6,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D4D4D4',
  },
});
