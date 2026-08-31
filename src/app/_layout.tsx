// src/app/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...Ionicons.font,
  });

  const [session, setSession] = useState<any>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authInitialized || (!loaded && !error)) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/dashboard' as any);
    }
  }, [session, authInitialized, loaded, error, segments, router]);

  if ((!loaded && !error) || !authInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#A8E63A" />
      </View>
    );
  }

  const section = String(segments[0] ?? '');
  const showFeedbackButton =
    Boolean(session) &&
    section !== '(auth)' &&
    section !== 'feedback' &&
    section !== 'support';

  return (
    <ThemeProvider>
      <View style={styles.root}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="feedback" options={{ headerShown: false }} />
          <Stack.Screen name="support" options={{ headerShown: false }} />
        </Stack>

        {showFeedbackButton && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send rider feedback"
            onPress={() => router.push('/feedback' as any)}
            style={({ pressed }) => [
              styles.feedbackButton,
              { bottom: Math.max(insets.bottom, 8) + 16 },
              pressed && styles.feedbackPressed,
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={21}
              color="#0D0D0D"
            />
          </Pressable>
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
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
  feedbackPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
