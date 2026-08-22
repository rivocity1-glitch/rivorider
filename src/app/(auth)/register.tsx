// src/app/(auth)/register.tsx

import { Ionicons } from '@expo/vector-icons';
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

// ============================================================
// OPTIONS
// ============================================================

const VEHICLE_OPTIONS = [
  {
    id: 'bike',
    label: 'Bike (Motorcycle)',
    icon: '🏍️',
  },
  {
    id: 'scooty',
    label: 'Scooty / Scooter',
    icon: '🛵',
  },
  {
    id: 'ev',
    label: 'Electric Vehicle (EV)',
    icon: '⚡',
  },
  {
    id: 'ev_gear',
    label: 'EV Gearbike',
    icon: '🔋',
  },
  {
    id: 'bicycle',
    label: 'Bicycle / Cycle',
    icon: '🚲',
  },
];

const GENDER_OPTIONS = [
  {
    id: 'Male',
    label: 'Male',
  },
  {
    id: 'Female',
    label: 'Female',
  },
  {
    id: 'Other',
    label: 'Other',
  },
];

const BLOOD_GROUP_OPTIONS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

const DISABILITY_OPTIONS = [
  {
    id: 'locomotor',
    label: 'Locomotor / Physical Disability',
  },
  {
    id: 'visual',
    label: 'Visual / Sight Impairment',
  },
  {
    id: 'hearing_speech',
    label: 'Hearing / Speech Impairment',
  },
  {
    id: 'other',
    label: 'Other / Preferred Not to Detail',
  },
];

// ============================================================
// COMPONENT
// ============================================================

export default function RegisterScreen() {
  // ----------------------------------------------------------
  // ACCOUNT
  // ----------------------------------------------------------

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // ----------------------------------------------------------
  // PERSONAL
  // ----------------------------------------------------------

  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  const [isSpeciallyAbled, setIsSpeciallyAbled] =
    useState(false);

  const [disabilityType, setDisabilityType] =
    useState('locomotor');

  const [showDisabilityDropdown, setShowDisabilityDropdown] =
    useState(false);

  // ----------------------------------------------------------
  // VEHICLE
  // ----------------------------------------------------------

  const [vehicleType, setVehicleType] =
    useState('bike');

  const [vehicleNumber, setVehicleNumber] =
    useState('');

  // ----------------------------------------------------------
  // ADDRESS
  // ----------------------------------------------------------

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pinCode, setPinCode] = useState('');

  // ----------------------------------------------------------
  // EMERGENCY
  // ----------------------------------------------------------

  const [emergencyContact, setEmergencyContact] =
    useState('');

  const [alternateContact, setAlternateContact] =
    useState('');

  // ----------------------------------------------------------
  // BANK
  // ----------------------------------------------------------

  const [accountHolderName, setAccountHolderName] =
    useState('');

  const [bankName, setBankName] = useState('');

  const [accountNumber, setAccountNumber] =
    useState('');

  const [ifscCode, setIfscCode] = useState('');

  const [upiId, setUpiId] = useState('');

  // ----------------------------------------------------------
  // OPTIONAL KYC NUMBERS
  // ----------------------------------------------------------

  const [aadhaarNumber, setAadhaarNumber] =
    useState('');

  const [panNumber, setPanNumber] =
    useState('');

  const [drivingLicenseNumber, setDrivingLicenseNumber] =
    useState('');

  // ----------------------------------------------------------
  // DECLARATIONS
  // ----------------------------------------------------------

  const [confirmAccurate, setConfirmAccurate] =
    useState(false);

  const [agreeTerms, setAgreeTerms] =
    useState(false);

  const [understandKycOptional, setUnderstandKycOptional] =
    useState(false);

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [loading, setLoading] = useState(false);

  // ----------------------------------------------------------
  // ANIMATION
  // ----------------------------------------------------------

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  const slideAnim = useRef(
    new Animated.Value(30)
  ).current;

  const buttonScale = useRef(
    new Animated.Value(1)
  ).current;

  // ==========================================================
  // EFFECT
  // ==========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ==========================================================
  // NORMALIZERS
  // ==========================================================

  const normalizePhone = (value: string) =>
    value
      .replace(/[^0-9]/g, '')
      .slice(0, 10);

  const normalizeAadhaar = (value: string) =>
    value
      .replace(/[^0-9]/g, '')
      .slice(0, 12);

  const normalizePan = (value: string) =>
    value
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 10);

  const normalizeIfsc = (value: string) =>
    value
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 11);

  const normalizeAccountNumber = (value: string) =>
    value.replace(/[^0-9]/g, '');

  const normalizeUpi = (value: string) =>
    value.trim().toLowerCase();

  // ==========================================================
  // VEHICLE
  // ==========================================================

  const isNoPlateRequired = [
    'bicycle',
    'ev',
  ].includes(vehicleType);

  // ==========================================================
  // PASSWORD
  // ==========================================================

  const passwordHasMinLength =
    password.length >= 8;

  const passwordHasUpper =
    /[A-Z]/.test(password);

  const passwordHasLower =
    /[a-z]/.test(password);

  const passwordHasNumber =
    /[0-9]/.test(password);

  const passwordValid =
    passwordHasMinLength &&
    passwordHasUpper &&
    passwordHasLower &&
    passwordHasNumber;

  const getPasswordStrength = () => {
    if (!password) {
      return {
        label: '',
        color: '#555555',
        score: 0,
      };
    }

    let score = 0;

    if (passwordHasMinLength) score++;
    if (passwordHasUpper) score++;
    if (passwordHasLower) score++;
    if (passwordHasNumber) score++;

    if (score <= 2) {
      return {
        label: 'Weak',
        color: '#E74C3C',
        score,
      };
    }

    if (score === 3) {
      return {
        label: 'Medium',
        color: '#F39C12',
        score,
      };
    }

    return {
      label: 'Strong',
      color: '#22CC71',
      score,
    };
  };

  const passwordStrength =
    getPasswordStrength();

  // ==========================================================
  // BUTTON ANIMATION
  // ==========================================================

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // ==========================================================
  // DECLARATIONS
  // ==========================================================

  const allDeclarationsChecked =
    confirmAccurate &&
    agreeTerms &&
    understandKycOptional;

  // ==========================================================
  // REGISTER
  // ==========================================================

  const handleRegister = async () => {
    if (loading) {
      return;
    }

    const cleanName =
      fullName.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanPhone =
      normalizePhone(phone);

    const cleanAddress =
      address.trim();

    const cleanCity =
      city.trim();

    const cleanState =
      stateName.trim();

    const cleanPin =
      pinCode.trim();

    const cleanEmergency =
      normalizePhone(
        emergencyContact
      );

    const cleanAlternate =
      normalizePhone(
        alternateContact
      );

    const cleanAadhaar =
      normalizeAadhaar(
        aadhaarNumber
      );

    const cleanPan =
      normalizePan(
        panNumber
      );

    const cleanDl =
      drivingLicenseNumber.trim();

    // --------------------------------------------------------
    // BASIC REQUIRED FIELDS
    // --------------------------------------------------------

    if (!cleanName) {
      Alert.alert(
        'Missing Name',
        'Please enter your full name.'
      );
      return;
    }

    if (!cleanEmail) {
      Alert.alert(
        'Missing Email',
        'Please enter your email address.'
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert(
        'Invalid Phone',
        'Please enter a valid 10-digit mobile number.'
      );
      return;
    }

    if (!password) {
      Alert.alert(
        'Missing Password',
        'Please create a password.'
      );
      return;
    }

    if (!passwordValid) {
      Alert.alert(
        'Invalid Password',
        'Password must contain at least 8 characters, one uppercase letter, one lowercase letter and one number.'
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      Alert.alert(
        'Password Mismatch',
        'Passwords do not match.'
      );
      return;
    }

    if (!gender) {
      Alert.alert(
        'Missing Gender',
        'Please select your gender.'
      );
      return;
    }

    if (!bloodGroup) {
      Alert.alert(
        'Missing Blood Group',
        'Please select your blood group.'
      );
      return;
    }

    if (!vehicleType) {
      Alert.alert(
        'Missing Vehicle',
        'Please select your vehicle type.'
      );
      return;
    }

    if (
      !isNoPlateRequired &&
      !vehicleNumber.trim()
    ) {
      Alert.alert(
        'Missing Vehicle Number',
        'Please enter your vehicle registration number.'
      );
      return;
    }

    if (!cleanAddress) {
      Alert.alert(
        'Missing Address',
        'Please enter your address.'
      );
      return;
    }

    if (!cleanCity) {
      Alert.alert(
        'Missing City',
        'Please enter your city.'
      );
      return;
    }

    if (!cleanState) {
      Alert.alert(
        'Missing State',
        'Please enter your state.'
      );
      return;
    }

    if (cleanPin.length !== 6) {
      Alert.alert(
        'Invalid PIN Code',
        'Please enter a valid 6-digit PIN code.'
      );
      return;
    }

    // --------------------------------------------------------
    // REQUIRED BANK DETAILS
    // --------------------------------------------------------

    const cleanAccountHolder =
      accountHolderName.trim();

    const cleanBankName =
      bankName.trim();

    const cleanAccountNumber =
      normalizeAccountNumber(accountNumber);

    const cleanIfsc =
      normalizeIfsc(ifscCode);

    const cleanUpi =
      normalizeUpi(upiId);

    if (!cleanAccountHolder) {
      Alert.alert(
        'Missing Bank Details',
        'Please enter the account holder name.'
      );
      return;
    }

    if (!cleanBankName) {
      Alert.alert(
        'Missing Bank Details',
        'Please enter the bank name.'
      );
      return;
    }

    if (
      cleanAccountNumber.length < 9 ||
      cleanAccountNumber.length > 18
    ) {
      Alert.alert(
        'Invalid Account Number',
        'Please enter a valid bank account number.'
      );
      return;
    }

    if (cleanIfsc.length !== 11) {
      Alert.alert(
        'Invalid IFSC',
        'Please enter a valid 11-character IFSC code.'
      );
      return;
    }

    // --------------------------------------------------------
    // OPTIONAL EMERGENCY VALIDATION
    // --------------------------------------------------------

    if (
      emergencyContact &&
      cleanEmergency.length !== 10
    ) {
      Alert.alert(
        'Invalid Emergency Contact',
        'Please enter a valid 10-digit emergency contact number.'
      );
      return;
    }

    if (
      alternateContact &&
      cleanAlternate.length !== 10
    ) {
      Alert.alert(
        'Invalid Alternate Contact',
        'Please enter a valid 10-digit alternate contact number.'
      );
      return;
    }

    // --------------------------------------------------------
    // OPTIONAL KYC NUMBER VALIDATION
    // --------------------------------------------------------

    if (
      aadhaarNumber &&
      cleanAadhaar.length !== 12
    ) {
      Alert.alert(
        'Invalid Aadhaar',
        'Aadhaar number must contain 12 digits.'
      );
      return;
    }

    if (
      panNumber &&
      cleanPan.length !== 10
    ) {
      Alert.alert(
        'Invalid PAN',
        'PAN number must contain 10 characters.'
      );
      return;
    }

    if (
      drivingLicenseNumber &&
      cleanDl.length < 5
    ) {
      Alert.alert(
        'Invalid Driving Licence',
        'Please enter a valid driving licence number.'
      );
      return;
    }

    // --------------------------------------------------------
    // DECLARATIONS
    // --------------------------------------------------------

    if (!allDeclarationsChecked) {
      Alert.alert(
        'Confirm Registration',
        'Please accept all declarations before creating your rider account.'
      );
      return;
    }

    // --------------------------------------------------------
    // REGISTER
    // --------------------------------------------------------

    setLoading(true);

    try {
      const selectedVehicle =
        VEHICLE_OPTIONS.find(
          (item) =>
            item.id === vehicleType
        );

      /*
       * IMPORTANT:
       *
       * KYC DOCUMENTS ARE NOT UPLOADED HERE.
       *
       * Registration only sends:
       *
       * - account information
       * - personal information
       * - vehicle information
       * - address
       * - emergency contact
       * - bank information
       * - optional KYC NUMBERS
       *
       * Aadhaar/PAN/DL/RC/selfie images are completed
       * later from the authenticated rider profile.
       */

      const rider =
        await registerRider({
          rider_name:
            cleanName,

          email:
            cleanEmail,

          phone:
            cleanPhone,

          vehicle_type:
            selectedVehicle
              ? selectedVehicle.label
              : vehicleType,

          vehicle_number:
            vehicleNumber.trim()
              ? vehicleNumber
                  .trim()
                  .toUpperCase()
              : 'N/A',

          is_specially_abled:
            isSpeciallyAbled,

          gender:
            gender || null,

          blood_group:
            bloodGroup || null,

          address:
            cleanAddress,

          city:
            cleanCity,

          state:
            cleanState,

          pin_code:
            cleanPin,

          emergency_contact:
            cleanEmergency || undefined,

          alternate_contact:
            cleanAlternate || undefined,

          account_holder_name:
            cleanAccountHolder,

          bank_name:
            cleanBankName,

          account_number:
            cleanAccountNumber,

          ifsc_code:
            cleanIfsc,

          upi_id:
            cleanUpi || undefined,

          // --------------------------------------------------
          // OPTIONAL KYC NUMBERS
          // --------------------------------------------------

          aadhaar_number:
            cleanAadhaar || undefined,

          pan_number:
            cleanPan || undefined,

          driving_license_number:
            cleanDl || undefined,

          // --------------------------------------------------
          // NO DOCUMENT URI FIELDS.
          //
          // KYC images are intentionally NOT uploaded
          // during registration.
          // --------------------------------------------------

          password,
        });

      console.log(
        'Rider registration successful:',
        rider?.id
      );

      Alert.alert(
        'Registration Successful',
        'Your Rivo rider account has been created successfully.\n\nKYC is optional during registration. You can complete your remaining KYC from your rider profile.',
        [
          {
            text: 'Continue',
            onPress: () => {
              router.replace(
                '/login'
              );
            },
          },
        ]
      );
    } catch (error: any) {
      console.error(
        'Rider registration error:',
        error
      );

      Alert.alert(
        'Registration Failed',
        error?.message ||
          'Unable to create your rider account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // INPUT COMPONENT
  // ==========================================================

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (
      value: string
    ) => void,
    placeholder: string,
    options?: {
      keyboardType?: any;
      autoCapitalize?: any;
      secureTextEntry?: boolean;
      maxLength?: number;
      multiline?: boolean;
    }
  ) => {
    return (
      <View
        style={{
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            color: '#E0E0E0',
            fontSize: 13,
            fontWeight: '700',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>

        <TextInput
          value={value}
          onChangeText={
            onChangeText
          }
          placeholder={
            placeholder
          }
          placeholderTextColor="#555555"
          keyboardType={
            options?.keyboardType ||
            'default'
          }
          autoCapitalize={
            options?.autoCapitalize ||
            'sentences'
          }
          secureTextEntry={
            options?.secureTextEntry ||
            false
          }
          maxLength={
            options?.maxLength
          }
          multiline={
            options?.multiline ||
            false
          }
          textAlignVertical={
            options?.multiline
              ? 'top'
              : 'center'
          }
          style={{
            backgroundColor:
              '#0D0D0D',
            borderWidth: 1,
            borderColor:
              '#333333',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical:
              options?.multiline
                ? 14
                : 13,
            minHeight:
              options?.multiline
                ? 85
                : undefined,
            color: '#FFFFFF',
            fontSize: 14,
          }}
        />
      </View>
    );
  };

  // ==========================================================
  // CHECKBOX
  // ==========================================================

  const renderCheckbox = (
    checked: boolean,
    onPress: () => void,
    children: React.ReactNode
  ) => {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          flexDirection:
            'row',
          alignItems:
            'flex-start',
          marginBottom: 14,
        }}
      >
        <View
          style={{
            width: 21,
            height: 21,
            borderRadius: 6,
            borderWidth: 2,
            borderColor:
              checked
                ? '#A8E63A'
                : '#555555',
            backgroundColor:
              checked
                ? '#A8E63A'
                : 'transparent',
            alignItems:
              'center',
            justifyContent:
              'center',
            marginRight: 10,
            marginTop: 1,
          }}
        >
          {checked && (
            <Text
              style={{
                color: '#0D0D0D',
                fontSize: 12,
                fontWeight:
                  '900',
              }}
            >
              ✓
            </Text>
          )}
        </View>

        <Text
          style={{
            flex: 1,
            color: '#CCCCCC',
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          {children}
        </Text>
      </TouchableOpacity>
    );
  };

  // ==========================================================
  // SECTION HEADER
  // ==========================================================

  const renderSectionHeader = (
    icon: any,
    title: string,
    subtitle: string
  ) => {
    return (
      <View
        style={{
          marginBottom: 18,
        }}
      >
        <View
          style={{
            flexDirection:
              'row',
            alignItems:
              'center',
            marginBottom: 4,
          }}
        >
          <Ionicons
            name={icon}
            size={19}
            color="#A8E63A"
            style={{
              marginRight: 8,
            }}
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight:
                '900',
            }}
          >
            {title}
          </Text>
        </View>

        <Text
          style={{
            color: '#888888',
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      </View>
    );
  };

  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
      style={{
        flex: 1,
        backgroundColor:
          '#0D0D0D',
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingVertical: 32,
          paddingHorizontal: 20,
          paddingBottom: 50,
        }}
      >
        <Animated.View
          style={{
            opacity:
              fadeAnim,
            transform: [
              {
                translateY:
                  slideAnim,
              },
            ],
          }}
        >
          {/* ==================================================
              HEADER
          ================================================== */}

          <View
            style={{
              marginBottom: 24,
              paddingTop: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => router.replace('/login')}
              disabled={loading}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#1A1A1A',
                borderWidth: 1,
                borderColor: '#262626',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: '900',
                letterSpacing: -0.5,
              }}
            >
              Create Rider Account
            </Text>

            <Text
              style={{
                color: '#888888',
                fontSize: 13,
                marginTop: 7,
                lineHeight: 19,
              }}
            >
              Complete your rider profile to get started with Rivo.
            </Text>
          </View>

          {/* ==================================================
              ACCOUNT INFORMATION
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            {renderSectionHeader(
              'person-circle-outline',
              'Account Information',
              'Create your login and basic account information.'
            )}

            {renderInput(
              'Full Name *',
              fullName,
              setFullName,
              'Enter your full name'
            )}

            {renderInput(
              'Email Address *',
              email,
              (value) =>
                setEmail(
                  value.trim()
                ),
              'you@example.com',
              {
                keyboardType:
                  'email-address',
                autoCapitalize:
                  'none',
              }
            )}

            {renderInput(
              'Mobile Number *',
              phone,
              (value) =>
                setPhone(
                  normalizePhone(
                    value
                  )
                ),
              '10-digit mobile number',
              {
                keyboardType:
                  'phone-pad',
                maxLength: 10,
              }
            )}

            <Text
              style={{
                color:
                  '#E0E0E0',
                fontSize: 13,
                fontWeight:
                  '700',
                marginBottom: 6,
              }}
            >
              Password *
            </Text>

            <View
              style={{
                flexDirection:
                  'row',
                alignItems:
                  'center',
                backgroundColor:
                  '#0D0D0D',
                borderWidth: 1,
                borderColor:
                  '#333333',
                borderRadius: 12,
                paddingLeft: 14,
                paddingRight: 12,
                marginBottom: 7,
              }}
            >
              <TextInput
                value={
                  password
                }
                onChangeText={
                  setPassword
                }
                placeholder="Minimum 8 characters"
                placeholderTextColor="#555555"
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color:
                    '#FFFFFF',
                  paddingVertical: 13,
                  fontSize: 14,
                }}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowPassword(
                    (value) =>
                      !value
                  )
                }
              >
                <Ionicons
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={21}
                  color="#888888"
                />
              </TouchableOpacity>
            </View>

            {password.length >
              0 && (
              <View
                style={{
                  marginBottom:
                    14,
                }}
              >
                <View
                  style={{
                    flexDirection:
                      'row',
                    justifyContent:
                      'space-between',
                    marginBottom:
                      5,
                  }}
                >
                  <Text
                    style={{
                      color:
                        '#777777',
                      fontSize: 11,
                    }}
                  >
                    Password strength
                  </Text>

                  <Text
                    style={{
                      color:
                        passwordStrength.color,
                      fontSize: 11,
                      fontWeight:
                        '800',
                    }}
                  >
                    {
                      passwordStrength.label
                    }
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection:
                      'row',
                    gap: 4,
                  }}
                >
                  {[1, 2, 3, 4].map(
                    (step) => (
                      <View
                        key={
                          step
                        }
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 3,
                          backgroundColor:
                            step <=
                            passwordStrength.score
                              ? passwordStrength.color
                              : '#292929',
                        }}
                      />
                    )
                  )}
                </View>
              </View>
            )}

            <Text
              style={{
                color:
                  '#E0E0E0',
                fontSize: 13,
                fontWeight:
                  '700',
                marginBottom: 6,
              }}
            >
              Confirm Password *
            </Text>

            <View
              style={{
                flexDirection:
                  'row',
                alignItems:
                  'center',
                backgroundColor:
                  '#0D0D0D',
                borderWidth: 1,
                borderColor:
                  '#333333',
                borderRadius: 12,
                paddingLeft: 14,
                paddingRight: 12,
              }}
            >
              <TextInput
                value={
                  confirmPassword
                }
                onChangeText={
                  setConfirmPassword
                }
                placeholder="Re-enter password"
                placeholderTextColor="#555555"
                secureTextEntry={
                  !showConfirmPassword
                }
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color:
                    '#FFFFFF',
                  paddingVertical: 13,
                  fontSize: 14,
                }}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowConfirmPassword(
                    (value) =>
                      !value
                  )
                }
              >
                <Ionicons
                  name={
                    showConfirmPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={21}
                  color="#888888"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ==================================================
              PERSONAL DETAILS
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            {renderSectionHeader(
              'male-female-outline',
              'Personal Details',
              'Provide your personal information.'
            )}

            <Text
              style={{
                color:
                  '#E0E0E0',
                fontSize: 13,
                fontWeight:
                  '700',
                marginBottom: 8,
              }}
            >
              Gender *
            </Text>

            <View
              style={{
                flexDirection:
                  'row',
                flexWrap:
                  'wrap',
                gap: 8,
                marginBottom:
                  16,
              }}
            >
              {GENDER_OPTIONS.map(
                (option) => {
                  const selected =
                    gender ===
                    option.id;

                  return (
                    <TouchableOpacity
                      key={
                        option.id
                      }
                      onPress={() =>
                        setGender(
                          option.id
                        )
                      }
                      activeOpacity={
                        0.8
                      }
                      style={{
                        paddingHorizontal:
                          16,
                        paddingVertical:
                          10,
                        borderRadius:
                          10,
                        backgroundColor:
                          selected
                            ? '#A8E63A'
                            : '#0D0D0D',
                        borderWidth: 1,
                        borderColor:
                          selected
                            ? '#A8E63A'
                            : '#333333',
                      }}
                    >
                      <Text
                        style={{
                          color:
                            selected
                              ? '#0D0D0D'
                              : '#CCCCCC',
                          fontSize:
                            13,
                          fontWeight:
                            '700',
                        }}
                      >
                        {
                          option.label
                        }
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            <Text
              style={{
                color:
                  '#E0E0E0',
                fontSize: 13,
                fontWeight:
                  '700',
                marginBottom: 8,
              }}
            >
              Blood Group *
            </Text>

            <View
              style={{
                flexDirection:
                  'row',
                flexWrap:
                  'wrap',
                gap: 8,
                marginBottom:
                  16,
              }}
            >
              {BLOOD_GROUP_OPTIONS.map(
                (group) => {
                  const selected =
                    bloodGroup ===
                    group;

                  return (
                    <TouchableOpacity
                      key={
                        group
                      }
                      onPress={() =>
                        setBloodGroup(
                          group
                        )
                      }
                      style={{
                        paddingHorizontal:
                          14,
                        paddingVertical:
                          10,
                        borderRadius:
                          10,
                        backgroundColor:
                          selected
                            ? '#A8E63A'
                            : '#0D0D0D',
                        borderWidth: 1,
                        borderColor:
                          selected
                            ? '#A8E63A'
                            : '#333333',
                      }}
                    >
                      <Text
                        style={{
                          color:
                            selected
                              ? '#0D0D0D'
                              : '#CCCCCC',
                          fontSize:
                            13,
                          fontWeight:
                            '700',
                        }}
                      >
                        {
                          group
                        }
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            <TouchableOpacity
              activeOpacity={
                0.8
              }
              onPress={() => {
                const next =
                  !isSpeciallyAbled;

                setIsSpeciallyAbled(
                  next
                );

                setShowDisabilityDropdown(
                  next
                );
              }}
              style={{
                flexDirection:
                  'row',
                alignItems:
                  'center',
                justifyContent:
                  'space-between',
                backgroundColor:
                  isSpeciallyAbled
                    ? '#242424'
                    : '#0D0D0D',
                borderWidth: 1,
                borderColor:
                  isSpeciallyAbled
                    ? '#A8E63A'
                    : '#333333',
                borderRadius:
                  12,
                padding: 14,
              }}
            >
              <View
                style={{
                  flex: 1,
                  paddingRight:
                    10,
                }}
              >
                <Text
                  style={{
                    color:
                      '#FFFFFF',
                    fontSize:
                      13,
                    fontWeight:
                      '700',
                  }}
                >
                  Blessed by Nature / Specially Abled 💚
                </Text>

                <Text
                  style={{
                    color:
                      '#777777',
                    fontSize:
                      11,
                    marginTop:
                      3,
                    lineHeight:
                      16,
                  }}
                >
                  Select this if you require accessible delivery assignments.
                </Text>
              </View>

              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius:
                    6,
                  borderWidth: 2,
                  borderColor:
                    isSpeciallyAbled
                      ? '#A8E63A'
                      : '#555555',
                  backgroundColor:
                    isSpeciallyAbled
                      ? '#A8E63A'
                      : 'transparent',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                }}
              >
                {isSpeciallyAbled && (
                  <Text
                    style={{
                      color:
                        '#0D0D0D',
                      fontWeight:
                        '900',
                    }}
                  >
                    ✓
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {isSpeciallyAbled && (
              <View
                style={{
                  marginTop:
                    12,
                  backgroundColor:
                    '#0D0D0D',
                  borderRadius:
                    12,
                  borderWidth: 1,
                  borderColor:
                    '#333333',
                  padding: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    setShowDisabilityDropdown(
                      (value) =>
                        !value
                    )
                  }
                  style={{
                    flexDirection:
                      'row',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          '#777777',
                        fontSize:
                          10,
                        fontWeight:
                          '800',
                        textTransform:
                          'uppercase',
                      }}
                    >
                      Disability Category
                    </Text>

                    <Text
                      style={{
                        color:
                          '#A8E63A',
                        fontSize:
                          13,
                        fontWeight:
                          '700',
                        marginTop:
                          3,
                      }}
                    >
                      {
                        DISABILITY_OPTIONS.find(
                          (item) =>
                            item.id ===
                            disabilityType
                        )
                          ?.label
                      }
                    </Text>
                  </View>

                  <Ionicons
                    name={
                      showDisabilityDropdown
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={
                      18
                    }
                    color="#A8E63A"
                  />
                </TouchableOpacity>

                {showDisabilityDropdown &&
                  DISABILITY_OPTIONS.map(
                    (
                      option
                    ) => (
                      <TouchableOpacity
                        key={
                          option.id
                        }
                        onPress={() => {
                          setDisabilityType(
                            option.id
                          );

                          setShowDisabilityDropdown(
                            false
                          );
                        }}
                        style={{
                          paddingVertical:
                            10,
                          paddingHorizontal:
                            8,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              disabilityType ===
                              option.id
                                ? '#A8E63A'
                                : '#CCCCCC',
                            fontSize:
                              13,
                            fontWeight:
                              disabilityType ===
                              option.id
                                ? '800'
                                : '500',
                          }}
                        >
                          {
                            option.label
                          }
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
              </View>
            )}
          </View>

          {/* ==================================================
              VEHICLE DETAILS
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            {renderSectionHeader(
              'bicycle-outline',
              'Vehicle Details',
              'Select your vehicle and provide its registration information.'
            )}

            <Text
              style={{
                color:
                  '#E0E0E0',
                fontSize: 13,
                fontWeight:
                  '700',
                marginBottom: 8,
              }}
            >
              Vehicle Type *
            </Text>

            <View
              style={{
                flexDirection:
                  'row',
                flexWrap:
                  'wrap',
                gap: 8,
                marginBottom:
                  16,
              }}
            >
              {VEHICLE_OPTIONS.map(
                (option) => {
                  const selected =
                    vehicleType ===
                    option.id;

                  return (
                    <TouchableOpacity
                      key={
                        option.id
                      }
                      activeOpacity={
                        0.8
                      }
                      onPress={() =>
                        setVehicleType(
                          option.id
                        )
                      }
                      style={{
                        flexDirection:
                          'row',
                        alignItems:
                          'center',
                        backgroundColor:
                          selected
                            ? '#A8E63A'
                            : '#0D0D0D',
                        borderWidth: 1,
                        borderColor:
                          selected
                            ? '#A8E63A'
                            : '#333333',
                        paddingHorizontal:
                          12,
                        paddingVertical:
                          10,
                        borderRadius:
                          10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize:
                            15,
                          marginRight:
                            6,
                        }}
                      >
                        {
                          option.icon
                        }
                      </Text>

                      <Text
                        style={{
                          color:
                            selected
                              ? '#0D0D0D'
                              : '#CCCCCC',
                          fontSize:
                            12,
                          fontWeight:
                            '700',
                        }}
                      >
                        {
                          option.label
                        }
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {renderInput(
              `Vehicle Registration Number ${
                isNoPlateRequired
                  ? '(Optional)'
                  : '*'
              }`,
              vehicleNumber,
              (value) =>
                setVehicleNumber(
                  value.toUpperCase()
                ),
              isNoPlateRequired
                ? 'Optional for this vehicle'
                : 'e.g. MH12AB1234',
              {
                autoCapitalize:
                  'characters',
              }
            )}

            {isNoPlateRequired && (
              <Text
                style={{
                  color:
                    '#777777',
                  fontSize:
                    11,
                  marginTop:
                    -8,
                }}
              >
                Vehicle registration number is optional for Bicycle and EV.
              </Text>
            )}
          </View>

          {/* ==================================================
              ADDRESS
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            {renderSectionHeader(
              'location-outline',
              'Address Details',
              'Enter your residential address and contact information.'
            )}

            {renderInput(
              'Address *',
              address,
              setAddress,
              'House / Flat / Street / Area',
              {
                multiline:
                  true,
              }
            )}

            <View
              style={{
                flexDirection:
                  'row',
                gap: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                {renderInput(
                  'City *',
                  city,
                  setCity,
                  'City'
                )}
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                {renderInput(
                  'State *',
                  stateName,
                  setStateName,
                  'State'
                )}
              </View>
            </View>

            {renderInput(
              'PIN Code *',
              pinCode,
              (value) =>
                setPinCode(
                  value
                    .replace(
                      /[^0-9]/g,
                      ''
                    )
                    .slice(
                      0,
                      6
                    )
                ),
              '6-digit PIN code',
              {
                keyboardType:
                  'number-pad',
                maxLength: 6,
              }
            )}
          </View>

          {/* ==================================================
              EMERGENCY
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            {renderSectionHeader(
              'call-outline',
              'Emergency Contact',
              'Keep an emergency contact available for rider safety.'
            )}

            {renderInput(
              'Emergency Contact Number',
              emergencyContact,
              (value) =>
                setEmergencyContact(
                  normalizePhone(
                    value
                  )
                ),
              '10-digit emergency number',
              {
                keyboardType:
                  'phone-pad',
                maxLength: 10,
              }
            )}

            {renderInput(
              'Alternate Contact',
              alternateContact,
              (value) =>
                setAlternateContact(
                  normalizePhone(
                    value
                  )
                ),
              'Optional alternate number',
              {
                keyboardType:
                  'phone-pad',
                maxLength: 10,
              }
            )}
          </View>

          {/* ==================================================
              BANK
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            {renderSectionHeader(
              'wallet-outline',
              'Bank Details *',
              'Bank details are required for rider payments and settlements. UPI is optional.'
            )}

            {renderInput(
              'Account Holder Name *',
              accountHolderName,
              setAccountHolderName,
              'Name as per bank records'
            )}

            {renderInput(
              'Bank Name *',
              bankName,
              setBankName,
              'e.g. HDFC Bank'
            )}

            {renderInput(
              'Account Number *',
              accountNumber,
              (value) =>
                setAccountNumber(
                  normalizeAccountNumber(value)
                ),
              'Bank account number',
              {
                keyboardType:
                  'number-pad',
              }
            )}

            {renderInput(
              'IFSC Code *',
              ifscCode,
              (value) =>
                setIfscCode(
                  normalizeIfsc(
                    value
                  )
                ),
              'e.g. SBIN0001234',
              {
                autoCapitalize:
                  'characters',
                maxLength: 11,
              }
            )}

            {renderInput(
              'UPI ID',
              upiId,
              (value) =>
                setUpiId(
                  normalizeUpi(value)
                ),
              'example@upi',
              {
                autoCapitalize:
                  'none',
              }
            )}
          </View>

          {/* ==================================================
              KYC
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            <View
              style={{
                flexDirection:
                  'row',
                justifyContent:
                  'space-between',
                alignItems:
                  'flex-start',
                marginBottom:
                  8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  paddingRight:
                    10,
                }}
              >
                {renderSectionHeader(
                  'shield-checkmark-outline',
                  'KYC Information',
                  'Provide KYC numbers now if available.'
                )}
              </View>

              <View
                style={{
                  backgroundColor:
                    '#24351E',
                  borderRadius:
                    8,
                  paddingHorizontal:
                    9,
                  paddingVertical:
                    5,
                }}
              >
                <Text
                  style={{
                    color:
                      '#A8E63A',
                    fontSize:
                      9,
                    fontWeight:
                      '900',
                  }}
                >
                  OPTIONAL
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor:
                  '#101810',
                borderWidth: 1,
                borderColor:
                  '#31402B',
                borderRadius:
                  12,
                padding: 13,
                marginBottom:
                  16,
              }}
            >
              <Text
                style={{
                  color:
                    '#A8E63A',
                  fontSize:
                    12,
                  fontWeight:
                    '800',
                  marginBottom:
                    4,
                }}
              >
                KYC can be completed later
              </Text>

              <Text
                style={{
                  color:
                    '#888888',
                  fontSize:
                    11,
                  lineHeight:
                    17,
                }}
              >
                You do not need to provide KYC during registration. Missing Aadhaar, PAN, driving licence, RC or selfie documents can be completed later from your rider profile.
              </Text>
            </View>

            {renderInput(
              'Aadhaar Number',
              aadhaarNumber,
              (value) =>
                setAadhaarNumber(
                  normalizeAadhaar(
                    value
                  )
                ),
              '12-digit Aadhaar number',
              {
                keyboardType:
                  'number-pad',
                maxLength: 12,
              }
            )}

            {renderInput(
              'PAN Number',
              panNumber,
              (value) =>
                setPanNumber(
                  normalizePan(
                    value
                  )
                ),
              '10-character PAN number',
              {
                autoCapitalize:
                  'characters',
                maxLength: 10,
              }
            )}

            {renderInput(
              'Driving Licence Number',
              drivingLicenseNumber,
              setDrivingLicenseNumber,
              'Driving licence number',
              {
                autoCapitalize:
                  'characters',
              }
            )}

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor:
                  '#292929',
                paddingTop: 14,
              }}
            >
              <Text
                style={{
                  color:
                    '#777777',
                  fontSize:
                    11,
                  lineHeight:
                    17,
                }}
              >
                📋 Document uploads are intentionally handled after registration. This prevents a storage upload failure from preventing rider account creation.
              </Text>
            </View>
          </View>

          {/* ==================================================
              DECLARATION
          ================================================== */}

          <View
            style={{
              backgroundColor:
                '#1A1A1A',
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor:
                '#262626',
            }}
          >
            <Text
              style={{
                color:
                  '#FFFFFF',
                fontSize:
                  16,
                fontWeight:
                  '900',
                marginBottom:
                  16,
              }}
            >
              Declaration & Confirmation
            </Text>

            {renderCheckbox(
              confirmAccurate,
              () =>
                setConfirmAccurate(
                  (value) =>
                    !value
                ),
              'I confirm that all information provided by me is accurate.'
            )}

            {renderCheckbox(
              agreeTerms,
              () =>
                setAgreeTerms(
                  (value) =>
                    !value
                ),
              'I agree to the Rivo Terms & Conditions and Privacy Policy.'
            )}

            {renderCheckbox(
              understandKycOptional,
              () =>
                setUnderstandKycOptional(
                  (value) =>
                    !value
                ),
              'I understand that KYC documents are optional during registration and that I can complete missing KYC documents later from my rider profile. I understand that bank details are required for rider payments and settlements.'
            )}
          </View>

          {/* ==================================================
              SUBMIT
          ================================================== */}

          <Animated.View
            style={{
              transform: [
                {
                  scale:
                    buttonScale,
                },
              ],
            }}
          >
            <TouchableOpacity
              activeOpacity={
                1
              }
              onPressIn={
                handlePressIn
              }
              onPressOut={
                handlePressOut
              }
              onPress={
                handleRegister
              }
              disabled={
                loading ||
                !allDeclarationsChecked
              }
              style={{
                height: 56,
                borderRadius: 14,
                backgroundColor:
                  allDeclarationsChecked
                    ? '#A8E63A'
                    : '#333333',
                opacity:
                  allDeclarationsChecked
                    ? 1
                    : 0.6,
                alignItems:
                  'center',
                justifyContent:
                  'center',
              }}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#0D0D0D"
                />
              ) : (
                <Text
                  style={{
                    color:
                      allDeclarationsChecked
                        ? '#0D0D0D'
                        : '#888888',
                    fontSize:
                      16,
                    fontWeight:
                      '900',
                  }}
                >
                  Create Rider Account
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ==================================================
              LOGIN
          ================================================== */}

          <TouchableOpacity
            disabled={
              loading
            }
            onPress={() =>
              router.replace(
                '/login'
              )
            }
            style={{
              alignItems:
                'center',
              marginTop: 20,
              marginBottom:
                24,
            }}
          >
            <Text
              style={{
                color:
                  '#777777',
                fontSize:
                  13,
              }}
            >
              Already have a rider account?{' '}
              <Text
                style={{
                  color:
                    '#A8E63A',
                  fontWeight:
                    '800',
                }}
              >
                Login
              </Text>
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color:
                '#555555',
              fontSize:
                10,
              lineHeight:
                15,
              textAlign:
                'center',
              paddingHorizontal:
                20,
            }}
          >
            By creating a rider account, you agree to Rivo's terms and privacy policy.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
            }
