// src/app/(auth)/login.tsx
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { registerForPushNotifications } from '@/lib/pushNotifications';
import { signInRider } from '../../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await signInRider(email, password);

      try {
        await registerForPushNotifications();
      } catch (err) {
        console.warn('Push registration failed:', err);
      }

      router.replace('/(tabs)/dashboard' as any);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0D0D0D' }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} bounces={false}>
        <Animated.View
          style={{
            padding: 24,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Brand/Header */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                backgroundColor: '#2ECC71',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                shadowColor: '#2ECC71',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Text style={{ fontSize: 36, color: '#0D0D0D' }}>⚡</Text>
            </View>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' }}>
              Rivo <Text style={{ color: '#2ECC71' }}>Rider</Text>
            </Text>
            <Text style={{ fontSize: 16, color: '#666666', marginTop: 8 }}>
              Welcome Rider, log in to start earning
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: '#262626',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Email Address
            </Text>
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor="#555555"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 16,
                marginBottom: 20,
                borderRadius: 12,
                color: '#FFFFFF',
                fontSize: 15,
              }}
            />

            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Password
            </Text>
            <View style={{ position: 'relative', marginBottom: 28 }}>
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#555555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secureText}
                autoCapitalize="none"
                style={{
                  backgroundColor: '#0D0D0D',
                  borderWidth: 1,
                  borderColor: '#333333',
                  padding: 16,
                  paddingRight: 60,
                  borderRadius: 12,
                  color: '#FFFFFF',
                  fontSize: 15,
                }}
              />
              <TouchableOpacity
                onPress={() => setSecureText(!secureText)}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: 16,
                }}
              >
                <Text style={{ color: '#2ECC71', fontSize: 14, fontWeight: '600' }}>
                  {secureText ? 'SHOW' : 'HIDE'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={1}
                style={{
                  backgroundColor: '#2ECC71',
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 56,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#0D0D0D" />
                ) : (
                  <Text style={{ color: '#0D0D0D', fontWeight: 'bold', fontSize: 16 }}>
                    Log In
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Register Route */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register' as any)}
              style={{ marginTop: 20, alignItems: 'center' }}
            >
              <Text style={{ color: '#666666', fontSize: 14 }}>
                Don't have an account?{' '}
                <Text style={{ color: '#A8E63A', fontWeight: '600' }}>Register Here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}