// src/app/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';
import AnimatedSplash from '../../components/splash/AnimatedSplash';
import { supabase } from '../lib/supabase';

type ProfileChecklist = { pending: string[]; completed: number; total: number };

function getHashParams(url: string) {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const raw = [query, hash].filter(Boolean).join('&');
  const params: Record<string, string> = {};
  raw.split('&').forEach((part) => {
    if (!part) return;
    const [rawKey, ...rawValue] = part.split('=');
    if (!rawKey) return;
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('=').replace(/\\+/g, ' '));
  });
  return params;
}

function getProfileChecklist(rider: any, profile: any): ProfileChecklist {
  const value = (key: string) => rider?.[key] || profile?.[key];
  const checks = [
    { label: 'Full name', done: Boolean(rider?.rider_name && rider.rider_name !== 'Profile pending') },
    { label: 'Personal details', done: Boolean(rider?.gender && rider?.blood_group) },
    { label: 'Vehicle details', done: Boolean(rider?.vehicle_type && rider?.vehicle_type !== 'N/A') },
    { label: 'Emergency contact', done: Boolean(value('emergency_contact')) },
    { label: 'Bank details', done: Boolean(value('account_holder_name') && value('bank_name') && value('account_number') && value('ifsc_code')) },
    { label: 'KYC details', done: Boolean(value('aadhaar_number') && value('pan_number')) },
    { label: 'Required documents', done: Boolean(profile?.aadhaar_front_url && profile?.pan_card_url && (profile?.driving_license_url || rider?.driving_license_document_url)) },
  ];
  const pending = checks.filter((item) => !item.done).map((item) => item.label);
  return { pending, completed: checks.length - pending.length, total: checks.length };
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ ...Ionicons.font });
  const [session, setSession] = useState<any>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [checklist, setChecklist] = useState<ProfileChecklist | null>(null);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const finishSplash = useCallback(() => setSplashFinished(true), []);
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    const handleAuthUrl = async (url: string | null) => {
      if (!url || !url.includes('reset-password')) return;
      const params = getHashParams(url);
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      if (!accessToken || !refreshToken) return;
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        console.error('Password recovery session error:', sessionError);
        return;
      }
      if (mounted && data.session) {
        setSession(data.session);
        router.replace('/(auth)/reset-password' as any);
      }
    };

    Linking.getInitialURL().then(handleAuthUrl).catch((err) => console.error('Initial auth deep link error:', err));
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url).catch((err) => console.error('Auth deep link error:', err));
    });
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setAuthInitialized(true);
    });
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthInitialized(true);
      if (event === 'SIGNED_IN') setPromptDismissed(false);
      if (event === 'PASSWORD_RECOVERY') router.replace('/(auth)/reset-password' as any);
    });
    return () => {
      mounted = false;
      linkSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    async function loadChecklist() {
      if (!session?.user?.id) {
        setChecklist(null);
        setShowProfilePrompt(false);
        return;
      }
      try {
        const { data: rider, error: riderError } = await supabase
          .from('riders').select('*').eq('auth_user_id', session.user.id).maybeSingle();
        if (riderError) throw riderError;
        if (!rider) return;
        const { data: profile, error: profileError } = await supabase
          .from('rider_profiles').select('*').eq('rider_id', rider.id).maybeSingle();
        if (profileError) throw profileError;
        if (!mounted) return;
        const next = getProfileChecklist(rider, profile);
        setChecklist(next);
        setShowProfilePrompt(next.pending.length > 0);
      } catch (loadError) {
        console.warn('Unable to load rider profile completion status:', loadError);
      }
    }
    loadChecklist();
    return () => { mounted = false; };
  }, [session?.user?.id, segments]);

  useEffect(() => {
    if (!authInitialized || (!loaded && !error)) return;
    const segmentList = segments as string[];
    const inAuthGroup = segmentList[0] === '(auth)';
    const inResetPassword = inAuthGroup && segmentList[1] === 'reset-password';
    if (!session && !inAuthGroup) router.replace('/(auth)/login' as any);
    else if (session && inAuthGroup && !inResetPassword) router.replace('/(tabs)/dashboard' as any);
  }, [session, authInitialized, loaded, error, segments, router]);

  if (!splashFinished || ((!loaded && !error) || !authInitialized)) {
    return <AnimatedSplash onAnimationComplete={finishSplash} />;
  }

  const section = String(segments[0] ?? '');
  const inProfileCompletion = section === 'complete-kyc';
  const showSupportButton = Boolean(session) && section !== '(auth)' && section !== 'feedback' && section !== 'support' && section !== 'support-lite';
  const showReminder = Boolean(session) && Boolean(checklist?.pending.length) && !inProfileCompletion && section === '(tabs)';

  return (
    <ThemeProvider>
      <View style={styles.root}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="complete-kyc" options={{ headerShown: false }} />
          <Stack.Screen name="feedback" options={{ headerShown: false }} />
          <Stack.Screen name="support" options={{ headerShown: false }} />
          <Stack.Screen name="support-lite" options={{ headerShown: false }} />
        </Stack>

        {showReminder && promptDismissed && (
          <Pressable onPress={() => setPromptDismissed(false)} style={[styles.floatingReminder, { bottom: Math.max(insets.bottom, 12) + 82 }]}>
            <Ionicons name="person-circle-outline" size={19} color="#0D0D0D" />
            <Text style={styles.floatingReminderText}>Complete profile · {checklist?.pending.length} left</Text>
          </Pressable>
        )}

        {showSupportButton && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Help and support"
            onPress={() => router.push('/support' as any)}
            style={({ pressed }) => [
              styles.feedbackButton,
              { bottom: Math.max(insets.bottom, 12) + 150 },
              pressed && styles.feedbackPressed,
            ]}
          >
            <Ionicons name="headset-outline" size={21} color="#0D0D0D" />
          </Pressable>
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  promptCard: {
    position: 'absolute', left: 16, right: 16, backgroundColor: '#FFFFFF',
    borderRadius: 20, padding: 17, borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 }, elevation: 12, zIndex: 90,
  },
  promptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  promptIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#A8E63A', alignItems: 'center', justifyContent: 'center' },
  promptTitle: { color: '#0D0D0D', fontSize: 17, fontWeight: '900' },
  promptDescription: { color: '#64748B', fontSize: 12, marginTop: 5 },
  progressTrack: { height: 7, backgroundColor: '#E2E8F0', borderRadius: 99, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 7, backgroundColor: '#2ECC71', borderRadius: 99 },
  pendingText: { color: '#475569', fontSize: 11, lineHeight: 16, marginTop: 9 },
  promptButton: { backgroundColor: '#A8E63A', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  promptButtonText: { color: '#0D0D0D', fontSize: 13, fontWeight: '900' },
  floatingReminder: { position: 'absolute', right: 16, backgroundColor: '#A8E63A', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 7, zIndex: 90, elevation: 8 },
  floatingReminderText: { color: '#0D0D0D', fontSize: 12, fontWeight: '900' },
  feedbackButton: {
    position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#A8E63A', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 }, elevation: 6, zIndex: 100,
  },
  feedbackPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
