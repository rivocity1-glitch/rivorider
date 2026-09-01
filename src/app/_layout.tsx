// src/app/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

function getHashParams(url: string) {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const raw = [query, hash].filter(Boolean).join('&');
  const params: Record<string, string> = {};

  raw.split('&').forEach((part) => {
    if (!part) return;
    const [rawKey, ...rawValue] = part.split('=');
    if (!rawKey) return;
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('=').replace(/\+/g, ' '));
  });

  return params;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ ...Ionicons.font });
  const [session, setSession] = useState<any>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
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

    Linking.getInitialURL().then(handleAuthUrl).catch((err) => {
      console.error('Initial auth deep link error:', err);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url).catch((err) => {
        console.error('Auth deep link error:', err);
      });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setAuthInitialized(true);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthInitialized(true);

      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password' as any);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      authSubscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!authInitialized || (!loaded && !error)) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inResetPassword = inAuthGroup && segments[1] === 'reset-password';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup && !inResetPassword) {
      router.replace('/(tabs)/dashboard' as any);
    }
  }, [session, authInitialized, loaded, error, segments, router]);

  if ((!loaded && !error) || !authInitialized) {
    return <View style={styles.loading}><ActivityIndicator size="small" color="#A8E63A" /></View>;
  }

  const section = String(segments[0] ?? '');
  const showSupportButton = Boolean(session) && section !== '(auth)' && section !== 'feedback' && section !== 'support' && section !== 'support-lite';

  return (
    <ThemeProvider>
      <View style={styles.root}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="feedback" options={{ headerShown: false }} />
          <Stack.Screen name="support" options={{ headerShown: false }} />
          <Stack.Screen name="support-lite" options={{ headerShown: false }} />
        </Stack>
        {showSupportButton && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Help and support"
            onPress={() => router.push('/support' as any)}
            style={({ pressed }) => [
              styles.feedbackButton,
              { bottom: Math.max(insets.bottom, 12) + 96 },
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' },
  feedbackButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A8E63A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 100,
  },
  feedbackPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
