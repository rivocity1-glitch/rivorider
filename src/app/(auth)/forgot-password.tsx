// src/app/(auth)/forgot-password.tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { requestRiderPasswordReset } from '../../services/auth';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('Missing Email', 'Please enter your rider account email.');
      return;
    }

    setLoading(true);
    try {
      await requestRiderPasswordReset(cleanEmail);
      Alert.alert(
        'Check Your Email',
        'If a rider account exists for this email, you will receive a password reset link. Open that link on this phone to set a new password.',
        [{ text: 'Back to Login', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      Alert.alert('Reset Request Failed', error.message || 'Unable to send the password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.text }}>
            Rivo <Text style={{ color: '#2ECC71' }}>Rider</Text>
          </Text>
          <Text style={{ fontSize: 16, color: theme.textMuted, marginTop: 8, textAlign: 'center' }}>
            Reset your rider account password
          </Text>
        </View>

        <View style={{ backgroundColor: theme.cardBg, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Email Address</Text>
          <TextInput
            placeholder="Enter your registered email"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, padding: 16, borderRadius: 12, color: theme.text, fontSize: 15, marginBottom: 20 }}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: '#2ECC71', height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={{ color: '#0D0D0D', fontWeight: 'bold', fontSize: 16 }}>Send Reset Link</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/login' as any)} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: '#A8E63A', fontSize: 14, fontWeight: '600' }}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
