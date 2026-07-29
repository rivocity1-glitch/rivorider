import { Redirect } from 'expo-router';
import { useState } from 'react';
import { AnimatedSplash } from '../../components/splash/AnimatedSplash';
import { supabase } from '../lib/supabase';

export default function Index() {
  const [animationFinished, setAnimationFinished] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const handleAnimationComplete = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setLoggedIn(!!session);
    } catch {
      setLoggedIn(false);
    } finally {
      setAnimationFinished(true);
    }
  };

  if (!animationFinished || loggedIn === null) {
    return <AnimatedSplash onAnimationComplete={handleAnimationComplete} />;
  }

  if (loggedIn) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}