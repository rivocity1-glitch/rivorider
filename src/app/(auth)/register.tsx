// src/app/(auth)/register.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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

const GENDER_OPTIONS = [
  { id: 'Male', label: 'Male' },
  { id: 'Female', label: 'Female' },
  { id: 'Other', label: 'Other' },
];

const BLOOD_GROUP_OPTIONS = [
  { id: 'A+', label: 'A+' },
  { id: 'A-', label: 'A-' },
  { id: 'B+', label: 'B+' },
  { id: 'B-', label: 'B-' },
  { id: 'AB+', label: 'AB+' },
  { id: 'AB-', label: 'AB-' },
  { id: 'O+', label: 'O+' },
  { id: 'O-', label: 'O-' },
];

export default function RegisterScreen() {
  // Account Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Personal Details
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [isSpeciallyAbled, setIsSpeciallyAbled] = useState(false);
  const [disabilityType, setDisabilityType] = useState('locomotor');
  const [showDisabilityDropdown, setShowDisabilityDropdown] = useState(false);

  // Vehicle Details
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Address Details
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Documents
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState('');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState('');
  const [panCardUrl, setPanCardUrl] = useState('');
  const [drivingLicenseUrl, setDrivingLicenseUrl] = useState('');
  const [vehicleRcUrl, setVehicleRcUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Bank Details
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');

  // Declaration Checkboxes
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [understandInactive, setUnderstandInactive] = useState(false);

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
  const isDlMandatory = !['bicycle', 'ev', 'ev_gear'].includes(vehicleType);

  // Password validation rule
  const passwordHasMinLen = password.length >= 8;
  const passwordHasUpper = /[A-Z]/.test(password);
  const passwordHasLower = /[a-z]/.test(password);
  const passwordHasNumber = /[0-9]/.test(password);
  const isPasswordValid = passwordHasMinLen && passwordHasUpper && passwordHasLower && passwordHasNumber;

  const getPasswordStrength = () => {
    if (!password) return { label: '', color: '#555555', score: 0 };
    let score = 0;
    if (passwordHasMinLen) score++;
    if (passwordHasUpper) score++;
    if (passwordHasLower) score++;
    if (passwordHasNumber) score++;

    if (score <= 2) return { label: 'Weak', color: '#E74C3C', score };
    if (score === 3) return { label: 'Medium', color: '#F39C12', score };
    return { label: 'Strong', color: '#A8E63A', score };
  };

  const strength = getPasswordStrength();

  // Document photo upload handler
  const handleUploadDocument = async (
    type: 'aadhaar_front' | 'aadhaar_back' | 'pan' | 'dl' | 'rc' | 'selfie'
  ) => {
    try {
      if (type === 'selfie') {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to capture selfie.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          setSelfieUrl(result.assets[0].uri);
        }
        return;
      }

      Alert.alert(
        'Upload Document',
        'Choose option to attach document photo',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              const camPerm = await ImagePicker.requestCameraPermissionsAsync();
              if (!camPerm.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required.');
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.6,
              });
              if (!res.canceled && res.assets && res.assets.length > 0) {
                setDocUri(type, res.assets[0].uri);
              }
            },
          },
          {
            text: 'Choose From Gallery',
            onPress: async () => {
              const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!libPerm.granted) {
                Alert.alert('Permission Denied', 'Media library permission is required.');
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.6,
              });
              if (!res.canceled && res.assets && res.assets.length > 0) {
                setDocUri(type, res.assets[0].uri);
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (e) {
      Alert.alert('Error', 'An error occurred picking document photo.');
    }
  };

  const setDocUri = (type: string, uri: string) => {
    if (type === 'aadhaar_front') setAadhaarFrontUrl(uri);
    if (type === 'aadhaar_back') setAadhaarBackUrl(uri);
    if (type === 'pan') setPanCardUrl(uri);
    if (type === 'dl') setDrivingLicenseUrl(uri);
    if (type === 'rc') setVehicleRcUrl(uri);
  };

  const allDeclarationsChecked = confirmAccurate && agreeTerms && understandInactive;

  const handleRegister = async () => {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    const cleanEmail = email.trim();

    if (
      !fullName.trim() ||
      !cleanEmail ||
      !cleanPhone ||
      !gender ||
      !bloodGroup ||
      !vehicleType.trim() ||
      (!isNoPlateRequired && !vehicleNumber.trim()) ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert('Validation Error', 'Phone number must be exactly 10 digits.');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert(
        'Validation Error',
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    if (!aadhaarFrontUrl || !aadhaarBackUrl) {
      Alert.alert('Validation Error', 'Aadhaar Card Front and Back photos are required.');
      return;
    }

    if (!panCardUrl) {
      Alert.alert('Validation Error', 'PAN Card photo is required.');
      return;
    }

    if (isDlMandatory && !drivingLicenseUrl) {
      Alert.alert('Validation Error', 'Driving Licence photo is required for petrol vehicles.');
      return;
    }

    if (!selfieUrl) {
      Alert.alert('Validation Error', 'Live Selfie photo is required.');
      return;
    }

    if (!allDeclarationsChecked) {
      Alert.alert('Validation Error', 'Please agree to all declarations before submitting.');
      return;
    }

    setLoading(true);
    try {
      const selectedOption = VEHICLE_OPTIONS.find((v) => v.id === vehicleType);
      const selectedDisability = DISABILITY_OPTIONS.find((d) => d.id === disabilityType);

      await registerRider({
        rider_name: fullName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        vehicle_type: selectedOption ? selectedOption.label : vehicleType,
        vehicle_number: vehicleNumber.trim().toUpperCase() || 'N/A',
        is_specially_abled: isSpeciallyAbled,
        disability_type: isSpeciallyAbled
          ? selectedDisability
            ? selectedDisability.label
            : disabilityType
          : null,
        gender: gender,
        blood_group: bloodGroup,
        password: password,
        address: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        state: stateName.trim() || undefined,
        pin_code: pinCode.trim() || undefined,
        emergency_contact_name: emergencyName.trim() || undefined,
        emergency_contact_phone: emergencyPhone.trim() || undefined,
        account_holder_name: accountHolder.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        account_number: accountNumber.trim() || undefined,
        ifsc_code: ifsc.trim().toUpperCase() || undefined,
        upi_id: upi.trim() || undefined,
      } as any);

      Alert.alert(
        'Registration Submitted',
        'Your registration and KYC have been submitted successfully.\n\nOur team will review your details.\n\nYou will be able to log in after approval.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const renderDocCard = (
    title: string,
    mandatory: boolean,
    docUri: string,
    onUpload: () => void,
    helperText?: string
  ) => (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600' }}>
          {title} {mandatory && <Text style={{ color: '#E74C3C' }}>*</Text>}
        </Text>

        {docUri ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={16} color="#A8E63A" style={{ marginRight: 4 }} />
            <Text style={{ color: '#A8E63A', fontSize: 12, fontWeight: '700' }}>Uploaded</Text>
          </View>
        ) : null}
      </View>

      {helperText ? (
        <Text style={{ color: '#888888', fontSize: 11, marginBottom: 6 }}>{helperText}</Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onUpload}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0D0D0D',
          borderWidth: 1,
          borderColor: docUri ? '#A8E63A' : '#333333',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
        }}
      >
        <Ionicons name="camera-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
        <Text style={{ color: '#A8E63A', fontSize: 13, fontWeight: '700' }}>
          {docUri ? 'Replace Document' : 'Upload Document'}
        </Text>
      </TouchableOpacity>

      {docUri ? (
        <Image
          source={{ uri: docUri }}
          style={{
            width: '100%',
            height: 130,
            borderRadius: 12,
            marginTop: 8,
            resizeMode: 'cover',
          }}
        />
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0D0D0D' }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingVertical: 32 }} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            paddingHorizontal: 20,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* HEADER */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' }}>
              Rider Registration & <Text style={{ color: '#A8E63A' }}>KYC</Text>
            </Text>
            <Text style={{ fontSize: 14, color: '#888888', marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              Complete your registration and submit your documents for verification.
            </Text>
          </View>

          {/* SECTION 1: ACCOUNT INFORMATION */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="person-circle-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Account Information</Text>
            </View>
            <Text style={{ color: '#888888', fontSize: 12, marginBottom: 16 }}>
              Enter your basic identity and login details
            </Text>

            {/* Full Name */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Full Name *</Text>
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
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Email */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Email Address *</Text>
            <TextInput
              placeholder="johndoe@example.com"
              placeholderTextColor="#555555"
              value={email}
              onChangeText={(val) => setEmail(val.trim())}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Phone */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Phone Number *</Text>
            <TextInput
              placeholder="10-digit mobile number"
              placeholderTextColor="#555555"
              value={phone}
              onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Password */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Password *</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                borderRadius: 12,
                paddingHorizontal: 14,
                marginBottom: 6,
              }}
            >
              <TextInput
                placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                placeholderTextColor="#555555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={{ flex: 1, paddingVertical: 14, color: '#FFFFFF' }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888888" />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={{ marginBottom: 14, paddingHorizontal: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: '#888888', fontSize: 11 }}>Password Strength:</Text>
                  <Text style={{ color: strength.color, fontSize: 11, fontWeight: '700' }}>{strength.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4, height: 4 }}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: step <= strength.score ? strength.color : '#262626',
                      }}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Confirm Password */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Confirm Password *</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                borderRadius: 12,
                paddingHorizontal: 14,
                marginBottom: 4,
              }}
            >
              <TextInput
                placeholder="Re-enter password"
                placeholderTextColor="#555555"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ flex: 1, paddingVertical: 14, color: '#FFFFFF' }}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888888" />
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 2: PERSONAL DETAILS */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="male-female-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Personal Details</Text>
            </View>
            <Text style={{ color: '#888888', fontSize: 12, marginBottom: 16 }}>
              Select gender, blood group, and accessibility options
            </Text>

            {/* Gender Selection */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Gender *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {GENDER_OPTIONS.map((item) => {
                const isSelected = gender === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setGender(item.id)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: isSelected ? '#A8E63A' : '#0D0D0D',
                      borderWidth: 1,
                      borderColor: isSelected ? '#A8E63A' : '#333333',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
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

            {/* Blood Group Selection */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Blood Group *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {BLOOD_GROUP_OPTIONS.map((item) => {
                const isSelected = bloodGroup === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setBloodGroup(item.id)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: isSelected ? '#A8E63A' : '#0D0D0D',
                      borderWidth: 1,
                      borderColor: isSelected ? '#A8E63A' : '#333333',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                    }}
                  >
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

            {/* Specially Abled / Blessed by Nature Support Section */}
            <View style={{ marginBottom: 4 }}>
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
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                    Blessed by Nature / Specially Abled 💚
                  </Text>
                  <Text style={{ color: '#888888', fontSize: 11, marginTop: 2 }}>
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
                  {isSpeciallyAbled && (
                    <Text style={{ color: '#0D0D0D', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Disability Category Dropdown */}
              {isSpeciallyAbled && (
                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: '#0D0D0D',
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: '#333333',
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowDisabilityDropdown(!showDisabilityDropdown)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <View>
                      <Text style={{ color: '#888888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                        Disability Category
                      </Text>
                      <Text style={{ color: '#A8E63A', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                        {DISABILITY_OPTIONS.find((d) => d.id === disabilityType)?.label}
                      </Text>
                    </View>
                    <Ionicons name={showDisabilityDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#A8E63A" />
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
                          <Text
                            style={{
                              color: disabilityType === opt.id ? '#A8E63A' : '#CCCCCC',
                              fontSize: 13,
                              fontWeight: disabilityType === opt.id ? '700' : '500',
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* SECTION 3: VEHICLE DETAILS */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="bicycle-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Vehicle Details</Text>
            </View>
            <Text style={{ color: '#888888', fontSize: 12, marginBottom: 16 }}>
              Select vehicle type and registration details
            </Text>

            {/* Vehicle Type Options */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              Vehicle Type *
            </Text>
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
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
              Vehicle Registration Number {isNoPlateRequired ? '(Optional)' : '*'}
            </Text>
            <TextInput
              placeholder={isNoPlateRequired ? 'Optional for Cycle/EV' : 'e.g., KA-01-AB-1234'}
              placeholderTextColor="#555555"
              value={vehicleNumber}
              onChangeText={(val) => setVehicleNumber(val.toUpperCase())}
              autoCapitalize="characters"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />
            {isNoPlateRequired && (
              <Text style={{ color: '#888888', fontSize: 11, marginTop: 6 }}>
                Vehicle number is optional for Bicycle and EV.
              </Text>
            )}
          </View>

          {/* SECTION 4: ADDRESS DETAILS */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="location-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Address Details</Text>
            </View>
            <Text style={{ color: '#888888', fontSize: 12, marginBottom: 16 }}>
              Enter residential address and emergency contact
            </Text>

            {/* Address Line */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Address Line</Text>
            <TextInput
              placeholder="Flat / House No., Street, Area"
              placeholderTextColor="#555555"
              value={addressLine}
              onChangeText={setAddressLine}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* City & State Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>City</Text>
                <TextInput
                  placeholder="e.g. Bangalore"
                  placeholderTextColor="#555555"
                  value={city}
                  onChangeText={setCity}
                  style={{
                    backgroundColor: '#0D0D0D',
                    borderWidth: 1,
                    borderColor: '#333333',
                    padding: 14,
                    borderRadius: 12,
                    color: '#FFFFFF',
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>State</Text>
                <TextInput
                  placeholder="e.g. Karnataka"
                  placeholderTextColor="#555555"
                  value={stateName}
                  onChangeText={setStateName}
                  style={{
                    backgroundColor: '#0D0D0D',
                    borderWidth: 1,
                    borderColor: '#333333',
                    padding: 14,
                    borderRadius: 12,
                    color: '#FFFFFF',
                  }}
                />
              </View>
            </View>

            {/* PIN Code */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>PIN Code</Text>
            <TextInput
              placeholder="6-digit PIN Code"
              placeholderTextColor="#555555"
              value={pinCode}
              onChangeText={(val) => setPinCode(val.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Emergency Contact Name */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
              Emergency Contact Name
            </Text>
            <TextInput
              placeholder="Parent / Spouse / Relative Name"
              placeholderTextColor="#555555"
              value={emergencyName}
              onChangeText={setEmergencyName}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Emergency Contact Number */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
              Emergency Contact Number
            </Text>
            <TextInput
              placeholder="10-digit Emergency Number"
              placeholderTextColor="#555555"
              value={emergencyPhone}
              onChangeText={(val) => setEmergencyPhone(val.replace(/[^0-9]/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />
          </View>

          {/* SECTION 5: DOCUMENTS SECTION */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Documents</Text>
            </View>
            <Text style={{ color: '#888888', fontSize: 12, marginBottom: 16 }}>
              Upload clear photos of your required verification documents
            </Text>

            {/* Aadhaar Front */}
            {renderDocCard('Aadhaar Front', true, aadhaarFrontUrl, () => handleUploadDocument('aadhaar_front'))}

            {/* Aadhaar Back */}
            {renderDocCard('Aadhaar Back', true, aadhaarBackUrl, () => handleUploadDocument('aadhaar_back'))}

            {/* PAN Card */}
            {renderDocCard('PAN Card', true, panCardUrl, () => handleUploadDocument('pan'))}

            {/* Driving License */}
            {renderDocCard(
              'Driving Licence',
              isDlMandatory,
              drivingLicenseUrl,
              () => handleUploadDocument('dl'),
              isDlMandatory ? 'Mandatory for petrol bike/scooter' : 'Optional for EV/Cycle'
            )}

            {/* Vehicle RC */}
            {renderDocCard('Vehicle RC', false, vehicleRcUrl, () => handleUploadDocument('rc'), 'Optional')}

            {/* Selfie */}
            {renderDocCard('Selfie', true, selfieUrl, () => handleUploadDocument('selfie'), 'Camera capture only')}
          </View>

          {/* SECTION 6: BANK DETAILS */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="wallet-outline" size={18} color="#A8E63A" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Bank Details</Text>
            </View>
            <Text style={{ color: '#888888', fontSize: 12, marginBottom: 16 }}>
              Payout account information for weekly earnings
            </Text>

            {/* Account Holder */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Account Holder Name</Text>
            <TextInput
              placeholder="Name as per Bank records"
              placeholderTextColor="#555555"
              value={accountHolder}
              onChangeText={setAccountHolder}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Bank Name */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Bank Name</Text>
            <TextInput
              placeholder="e.g., HDFC Bank"
              placeholderTextColor="#555555"
              value={bankName}
              onChangeText={setBankName}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* Account Number */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Account Number</Text>
            <TextInput
              placeholder="Bank Account Number"
              placeholderTextColor="#555555"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* IFSC Code */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>IFSC Code</Text>
            <TextInput
              placeholder="e.g., HDFC0001234"
              placeholderTextColor="#555555"
              value={ifsc}
              onChangeText={(val) => setIfsc(val.toUpperCase())}
              autoCapitalize="characters"
              maxLength={11}
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                marginBottom: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />

            {/* UPI ID */}
            <Text style={{ color: '#E0E0E0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>UPI ID (Optional)</Text>
            <TextInput
              placeholder="e.g., mobile@upi"
              placeholderTextColor="#555555"
              value={upi}
              onChangeText={setUpi}
              autoCapitalize="none"
              style={{
                backgroundColor: '#0D0D0D',
                borderWidth: 1,
                borderColor: '#333333',
                padding: 14,
                borderRadius: 12,
                color: '#FFFFFF',
              }}
            />
          </View>

          {/* SECTION 7: DECLARATION */}
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#262626',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 14 }}>
              Declaration & Confirmation
            </Text>

            {/* Checkbox 1 */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setConfirmAccurate(!confirmAccurate)}
              style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: confirmAccurate ? '#A8E63A' : '#555555',
                  backgroundColor: confirmAccurate ? '#A8E63A' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  marginTop: 2,
                }}
              >
                {confirmAccurate && <Text style={{ color: '#0D0D0D', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
              </View>
              <Text style={{ color: '#CCCCCC', fontSize: 13, flex: 1, lineHeight: 18 }}>
                I confirm that all information provided is accurate.
              </Text>
            </TouchableOpacity>

            {/* Checkbox 2 */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAgreeTerms(!agreeTerms)}
              style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: agreeTerms ? '#A8E63A' : '#555555',
                  backgroundColor: agreeTerms ? '#A8E63A' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  marginTop: 2,
                }}
              >
                {agreeTerms && <Text style={{ color: '#0D0D0D', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
              </View>
              <Text style={{ color: '#CCCCCC', fontSize: 13, flex: 1, lineHeight: 18 }}>
                I agree to the Terms & Conditions and Privacy Policy.
              </Text>
            </TouchableOpacity>

            {/* Checkbox 3 */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setUnderstandInactive(!understandInactive)}
              style={{ flexDirection: 'row', alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: understandInactive ? '#A8E63A' : '#555555',
                  backgroundColor: understandInactive ? '#A8E63A' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  marginTop: 2,
                }}
              >
                {understandInactive && <Text style={{ color: '#0D0D0D', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
              </View>
              <Text style={{ color: '#CCCCCC', fontSize: 13, flex: 1, lineHeight: 18 }}>
                I understand my account will remain inactive until KYC verification is completed.
              </Text>
            </TouchableOpacity>
          </View>

          {/* SUBMIT BUTTON */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleRegister}
              disabled={loading || !allDeclarationsChecked}
              activeOpacity={1}
              style={{
                backgroundColor: allDeclarationsChecked ? '#A8E63A' : '#333333',
                opacity: allDeclarationsChecked ? 1 : 0.6,
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
                <Text
                  style={{
                    color: allDeclarationsChecked ? '#0D0D0D' : '#888888',
                    fontWeight: 'bold',
                    fontSize: 16,
                  }}
                >
                  Submit Registration & KYC
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* BACK TO LOGIN */}
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login' as any)}
            style={{ marginTop: 20, marginBottom: 24, alignItems: 'center' }}
          >
            <Text style={{ color: '#666666', fontSize: 14 }}>
              Already registered? <Text style={{ color: '#2ECC71', fontWeight: '600' }}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}