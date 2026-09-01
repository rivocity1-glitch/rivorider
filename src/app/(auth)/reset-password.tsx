// src/app/(auth)/reset-password.tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { updateRiderPassword } from '../../services/auth';

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length !== 6) {
      Alert.alert('Invalid Password', 'Password must be exactly 6 characters. Any letters, numbers or symbols are allowed.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updateRiderPassword(password);
      await supabaseSignOutSafely();
      Alert.alert('Password Updated', 'Your password has been changed. Please log in with your new password.', [
        { text: 'Continue', onPress: () => router.replace('/(auth)/login' as any) },
      ]);
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Unable to update your password.');
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
            Create your new password
          </Text>
        </View>

        <View style={{ backgroundColor: theme.cardBg, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>New Password</Text>
          <View style={{ position: 'relative', marginBottom: 18 }}>
            <TextInput
              placeholder="6 characters"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              maxLength={6}
              style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, padding: 16, paddingRight: 60, borderRadius: 12, color: theme.text, fontSize: 15 }}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 16, top: 16 }}>
              <Text style={{ color: '#2ECC71', fontSize: 14, fontWeight: '600' }}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Confirm Password</Text>
          <View style={{ position: 'relative', marginBottom: 24 }}>
            <TextInput
              placeholder="Enter it again"
              placeholderTextColor={theme.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              maxLength={6}
              style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, padding: 16, paddingRight: 60, borderRadius: 12, color: theme.text, fontSize: 15 }}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 16, top: 16 }}>
              <Text style={{ color: '#2ECC71', fontSize: 14, fontWeight: '600' }}>{showConfirmPassword ? 'HIDE' : 'SHOW'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 20 }}>
            Use exactly 6 characters. Letters, numbers and symbols are all allowed.
          </Text>

          <TouchableOpacity onPress={handleSubmit} disabled={loading} style={{ backgroundColor: '#2ECC71', height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={{ color: '#0D0D0D', fontWeight: 'bold', fontSize: 16 }}>Update Password</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

async function supabaseSignOutSafely() {
  const { supabase } = await import('../../lib/supabase');
  await supabase.auth.signOut();
}
