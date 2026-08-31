import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['App experience', 'Deliveries', 'Earnings', 'Support', 'Other'];

export default function FeedbackScreen() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('App experience');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback() {
    if (rating < 1) {
      Alert.alert('Rating required', 'Please select a rating from 1 to 5.');
      return;
    }

    if (message.trim().length < 5) {
      Alert.alert('Feedback required', 'Please tell us a little more about your experience.');
      return;
    }

    if (submitting) return;

    try {
      setSubmitting(true);

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

      const { error } = await supabase
        .from('rider_support_tickets')
        .insert({
          rider_id: rider.id,
          title: `Rider Feedback — ${category}`,
          description: `Rating: ${rating}/5\nFeedback: ${message.trim()}`,
          status: 'open',
          priority: 'medium',
          issue_type: 'feedback',
          unread_for_admin: true,
          unread_for_rider: false,
        });

      if (error) throw error;

      setRating(0);
      setMessage('');

      Alert.alert(
        'Thank you',
        'Your feedback has been sent to the Rivo team.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Rider feedback submission failed:', error);
      Alert.alert(
        'Unable to send feedback',
        error?.message || 'Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  }

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
        <Text style={styles.headerTitle}>Send Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="star-outline"
              size={24}
              color="#A8E63A"
            />
          </View>
          <Text style={styles.title}>Help us improve Rivo Rider</Text>
          <Text style={styles.subtitle}>
            Tell us what worked well or what we should improve.
          </Text>
        </View>

        <Text style={styles.label}>Your rating</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              style={styles.starButton}
              hitSlop={6}
            >
              <Ionicons
                name={value <= rating ? 'star' : 'star-outline'}
                size={34}
                color={value <= rating ? '#F59E0B' : '#64748B'}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryWrap}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.category,
                category === item && styles.categorySelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categoryTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Feedback</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Share your experience..."
          placeholderTextColor="#64748B"
          multiline
          maxLength={2000}
          textAlignVertical="top"
          style={styles.textarea}
        />
        <Text style={styles.counter}>{message.length}/2000</Text>

        <Pressable
          onPress={submitFeedback}
          disabled={submitting}
          style={[styles.primaryButton, submitting && styles.disabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Ionicons name="send-outline" size={18} color="#0D0D0D" />
          )}
          <Text style={styles.primaryText}>
            {submitting ? 'Sending...' : 'Send Feedback'}
          </Text>
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
    padding: 20,
    paddingBottom: 48,
  },
  hero: {
    backgroundColor: '#171717',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 24,
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
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 6,
    color: '#A3A3A3',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D4D4D4',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  starButton: {
    marginRight: 8,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  category: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#171717',
  },
  categorySelected: {
    backgroundColor: '#A8E63A',
    borderColor: '#A8E63A',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A3A3A3',
  },
  categoryTextSelected: {
    color: '#0D0D0D',
  },
  textarea: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: '#171717',
  },
  counter: {
    textAlign: 'right',
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#A8E63A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});
