import { router } from 'expo-router';
import { useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, useTheme } from '../../context/ThemeContext';
import { registerRider } from '../../services/auth';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 15,
    marginBottom: 16,
  } as const;

  const handleGetLocation = async () => {
    if (gettingLocation) return;
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission required', 'Allow location access to use your current location.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setLocationCoords({ latitude, longitude });
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = results[0];
      if (place) {
        const generatedAddress = [
          place.name,
          place.street,
          place.subregion,
          place.city,
          place.district,
          place.region,
          place.postalCode,
        ].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
        if (generatedAddress) setAddress(generatedAddress);
      }
    } catch (error: any) {
      Alert.alert('Unable to get location', error?.message || 'Enter your address manually.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleRegister = async () => {
    if (loading) return;
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(0, 10);
    const cleanEmail = email.trim().toLowerCase();
    const cleanAddress = address.trim();

    if (cleanName.length < 2) {
      Alert.alert('Name required', 'Enter your full name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid mobile number', 'Enter a valid 10-digit mobile number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (!cleanAddress) {
      Alert.alert('Address required', 'Enter your residential address.');
      return;
    }
    if (password.length !== 6) {
      Alert.alert('Invalid password', 'Password must be exactly 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await registerRider({
        rider_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress,
        registration_latitude: locationCoords?.latitude,
        registration_longitude: locationCoords?.longitude,
        password,
      });

      Alert.alert(
        'Account created',
        'Your rider account has been created. Log in to complete the remaining profile details.',
        [{ text: 'Continue', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      Alert.alert('Registration failed', error?.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22, paddingVertical: 36 }}
      >
        <TouchableOpacity onPress={() => router.replace('/login')} style={{ marginBottom: 28 }}>
          <Text style={{ color: COLORS.emeraldGreen, fontSize: 14, fontWeight: '800' }}>‹ Back to login</Text>
        </TouchableOpacity>

        <Text style={{ color: theme.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>
          Join Rivo Rider
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 28 }}>
          Create your account in a few steps. You can complete the rest of your rider profile after logging in.
        </Text>

        <View style={{ backgroundColor: theme.cardBg, borderRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 20 }}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }}>Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            style={inputStyle}
          />

          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }}>Mobile number</Text>
          <TextInput
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
            style={inputStyle}
          />

          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }}>Residential address</Text>
            <TouchableOpacity onPress={handleGetLocation} disabled={gettingLocation} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
              {gettingLocation ? <ActivityIndicator size="small" color={COLORS.emeraldGreen} /> : <Text style={{ color: COLORS.emeraldGreen, fontSize: 12, fontWeight: '800' }}>◎ Get my location</Text>}
            </TouchableOpacity>
          </View>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="House / flat / street / area"
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            style={[inputStyle, { minHeight: 92 }]}
          />

          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }}>Password</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingLeft: 14, paddingRight: 12, marginBottom: 18 }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create a 6-character password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              maxLength={6}
              style={{ flex: 1, color: theme.text, paddingVertical: 14, fontSize: 15 }}
            />
            <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
              <Text style={{ color: COLORS.emeraldGreen, fontSize: 11, fontWeight: '900' }}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
            style={{ height: 54, borderRadius: 13, backgroundColor: COLORS.limeGreen, alignItems: 'center', justifyContent: 'center' }}
          >
            {loading ? <ActivityIndicator color={COLORS.jetBlack} /> : (
              <Text style={{ color: COLORS.jetBlack, fontSize: 15, fontWeight: '900' }}>Create rider account</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.replace('/login')} style={{ alignItems: 'center', marginTop: 22 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>
            Already registered? <Text style={{ color: COLORS.limeGreen, fontWeight: '800' }}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
