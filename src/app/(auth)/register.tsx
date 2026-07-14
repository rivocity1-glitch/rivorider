// src/app/(auth)/register.tsx
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
import { registerRider } from '../../services/auth';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleRegister = async () => {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !vehicleType.trim() ||
      !vehicleNumber.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      Alert.alert('Validation Error', 'All fields are required.');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await registerRider({
        rider_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicle_type: vehicleType.trim(),
        vehicle_number: vehicleNumber.trim(),
        password: password,
      });

      Alert.alert(
        'Registration Submitted',
        'Registration submitted successfully. Please wait for admin approval.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0D0D0D' }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingVertical: 40 }} bounces={false}>
        <Animated.View
          style={{
            padding: 24,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' }}>
              Create <Text style={{ color: '#A8E63A' }}>Account</Text>
            </Text>
            <Text style={{ fontSize: 16, color: '#666666', marginTop: 8 }}>
              Join Rivo Delivery Network
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
            {/* Full Name */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Full Name</Text>
            <TextInput
              placeholder="John Doe"
              placeholderTextColor="#555555"
              value={fullName}
              onChangeText={setFullName}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 16,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Email */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Email Address</Text>
            <TextInput
              placeholder="johndoe@example.com"
              placeholderTextColor="#555555"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 16,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Phone */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Phone Number</Text>
            <TextInput
              placeholder="+1234567890"
              placeholderTextColor="#555555"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 16,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Vehicle Type */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Vehicle Type</Text>
            <TextInput
              placeholder="e.g., Motorcycle, Scooter, Bicycle"
              placeholderTextColor="#555555"
              value={vehicleType}
              onChangeText={setVehicleType}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 16,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Vehicle Number */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Vehicle Number</Text>
            <TextInput
              placeholder="e.g., ABC-1234"
              placeholderTextColor="#555555"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              autoCapitalize="characters"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 16,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Password */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Password</Text>
            <TextInput
              placeholder="Minimum 6 characters"
              placeholderTextColor="#555555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 16,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Confirm Password */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Confirm Password</Text>
            <TextInput
              placeholder="Re-enter password"
              placeholderTextColor="#555555"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 24,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Submit Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={1}
                style={{
                  backgroundColor: '#A8E63A',
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
                    Submit Registration
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Back to Login */}
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login' as any)}
              style={{ marginTop: 20, alignItems: 'center' }}
            >
              <Text style={{ color: '#666666', fontSize: 14 }}>
                Already registered?{' '}
                <Text style={{ color: '#2ECC71', fontWeight: '600' }}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}