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

const VEHICLE_OPTIONS = [
  { id: 'bike', label: 'Bike (Motorcycle)', icon: '🏍️' },
  { id: 'scooty', label: 'Scooty / Scooter', icon: '🛵' },
  { id: 'ev', label: 'Electric Vehicle (EV)', icon: '⚡' },
  { id: 'ev_gear', label: 'EV Gearbike', icon: '🔋' },
  { id: 'bicycle', label: 'Bicycle / Cycle', icon: '🚲' },
];

const DISABILITY_OPTIONS = [
  { id: 'locomotor', label: 'Locomotor / Physical Disability' },
  { id: 'visual', label: 'Visual / Sight Impairment' },
  { id: 'hearing_speech', label: 'Hearing / Speech Impairment' },
  { id: 'other', label: 'Other / Preferred Not to Detail' },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  
  // Specially Abled / Disability States
  const [isSpeciallyAbled, setIsSpeciallyAbled] = useState(false);
  const [disabilityType, setDisabilityType] = useState('locomotor');
  const [showDisabilityDropdown, setShowDisabilityDropdown] = useState(false);

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

  const isNoPlateRequired = ['bicycle', 'ev'].includes(vehicleType);

  const handleRegister = async () => {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !vehicleType.trim() ||
      (!isNoPlateRequired && !vehicleNumber.trim()) ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
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
      const selectedOption = VEHICLE_OPTIONS.find((v) => v.id === vehicleType);
      const selectedDisability = DISABILITY_OPTIONS.find((d) => d.id === disabilityType);
      
      await registerRider({
        rider_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicle_type: selectedOption ? selectedOption.label : vehicleType,
        vehicle_number: vehicleNumber.trim() || 'N/A',
        is_specially_abled: isSpeciallyAbled,
        disability_type: isSpeciallyAbled ? (selectedDisability ? selectedDisability.label : disabilityType) : null,
        password: password,
      } as any);

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
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Full Name *</Text>
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
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Email Address *</Text>
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
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Phone Number *</Text>
            <TextInput
              placeholder="+91 9876543210"
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

            {/* Vehicle Type Options */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Select Vehicle Type *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {VEHICLE_OPTIONS.map((item) => {
                const isSelected = vehicleType === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setVehicleType(item.id)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isSelected ? '#A8E63A' : '#0D0D0D',
                      borderWidth: 1,
                      borderColor: isSelected ? '#A8E63A' : '#333333',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 14, marginRight: 6 }}>{item.icon}</Text>
                    <Text
                      style={{
                        color: isSelected ? '#0D0D0D' : '#E0E0E0',
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Vehicle Number */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>
              Vehicle Registration Number {isNoPlateRequired ? '(Optional)' : '*'}
            </Text>
            <TextInput
              placeholder={isNoPlateRequired ? "Optional for Cycle/EV" : "e.g., KA-01-AB-1234"}
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

            {/* Specially Abled / Blessed by Nature Support Section */}
            <View style={{ marginBottom: 20 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const nextVal = !isSpeciallyAbled;
                  setIsSpeciallyAbled(nextVal);
                  if (nextVal) setShowDisabilityDropdown(true);
                  else setShowDisabilityDropdown(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isSpeciallyAbled ? '#262626' : '#0D0D0D',
                  borderWidth: 1,
                  borderColor: isSpeciallyAbled ? '#A8E63A' : '#333333',
                  padding: 14,
                  borderRadius: 12,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                    Blessed by Nature / Specially Abled 💚
                  </Text>
                  <Text style={{ color: '#888888', fontSize: 12, marginTop: 2 }}>
                    Check this if you require accessible delivery assignments
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: isSpeciallyAbled ? '#A8E63A' : '#555555',
                    backgroundColor: isSpeciallyAbled ? '#A8E63A' : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSpeciallyAbled && <Text style={{ color: '#0D0D0D', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                </View>
              </TouchableOpacity>

              {/* Disability Category Select Dropdown */}
              {isSpeciallyAbled && (
                <View style={{ marginTop: 12, backgroundColor: '#0D0D0D', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#333333' }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowDisabilityDropdown(!showDisabilityDropdown)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <View>
                      <Text style={{ color: '#888888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Select Category</Text>
                      <Text style={{ color: '#A8E63A', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                        {DISABILITY_OPTIONS.find((d) => d.id === disabilityType)?.label}
                      </Text>
                    </View>
                    <Text style={{ color: '#A8E63A', fontSize: 14 }}>{showDisabilityDropdown ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {showDisabilityDropdown && (
                    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#222222', paddingTop: 8 }}>
                      {DISABILITY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => {
                            setDisabilityType(opt.id);
                            setShowDisabilityDropdown(false);
                          }}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            backgroundColor: disabilityType === opt.id ? '#1A1A1A' : 'transparent',
                          }}
                        >
                          <Text style={{ color: disabilityType === opt.id ? '#A8E63A' : '#CCCCCC', fontSize: 13, fontWeight: disabilityType === opt.id ? '700' : '500' }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Password */}
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Password *</Text>
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
            <Text style={{ color: '#E0E0E0', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>Confirm Password *</Text>
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