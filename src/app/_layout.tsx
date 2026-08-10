// src/app/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

// Prevent the splash screen from auto-hiding until fonts are ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...Ionicons.font,
  });

  const [session, setSession] = useState<any>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Session Listener & Auth State Initialization
  useEffect(() => {
    // Read current Supabase session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
    });

    // Listen for auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, INITIAL_SESSION)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // React to session changes and navigate immediately
  useEffect(() => {
    if (!authInitialized || !loaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Immediately replace navigation with (auth) when session becomes null
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      // Immediately navigate to (tabs) when authenticated
      router.replace('/(tabs)/dashboard' as any);
    }
  }, [session, authInitialized, loaded, segments]);

  // Show loading indicator while font loading or initial auth check is in progress
  if ((!loaded && !error) || !authInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' }}>
        <ActivityIndicator size="large" color="#A8E63A" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}