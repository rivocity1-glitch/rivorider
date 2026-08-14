import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { registerRider } from '../../services/auth';

export default function RegisterScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------
  // PERSONAL DETAILS
  // ---------------------------------------------------------

  const [riderName, setRiderName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  // ---------------------------------------------------------
  // VEHICLE DETAILS
  // ---------------------------------------------------------

  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // ---------------------------------------------------------
  // ADDRESS
  // ---------------------------------------------------------

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');

  // ---------------------------------------------------------
  // EMERGENCY CONTACT
  // ---------------------------------------------------------

  const [emergencyContactName, setEmergencyContactName] =
    useState('');

  const [emergencyContactPhone, setEmergencyContactPhone] =
    useState('');

  const [alternateContact, setAlternateContact] =
    useState('');

  // ---------------------------------------------------------
  // BANK DETAILS
  // ---------------------------------------------------------

  const [accountHolderName, setAccountHolderName] =
    useState('');

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  // ---------------------------------------------------------
  // OPTIONAL KYC NUMBERS
  // ---------------------------------------------------------

  const [aadhaarNumber, setAadhaarNumber] =
    useState('');

  const [panNumber, setPanNumber] = useState('');

  const [drivingLicenseNumber, setDrivingLicenseNumber] =
    useState('');

  const [isSpeciallyAbled, setIsSpeciallyAbled] =
    useState(false);

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  const normalizePhone = (value: string) =>
    value.replace(/[^0-9]/g, '').slice(0, 10);

  const normalizeAadhaar = (value: string) =>
    value.replace(/[^0-9]/g, '').slice(0, 12);

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

  // ---------------------------------------------------------
  // REGISTRATION
  // ---------------------------------------------------------

  const handleRegister = async () => {
    if (loading) {
      return;
    }

    const cleanName = riderName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);

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

    if (!vehicleType.trim()) {
      Alert.alert(
        'Missing Vehicle Type',
        'Please enter your vehicle type.'
      );
      return;
    }

    if (!vehicleNumber.trim()) {
      Alert.alert(
        'Missing Vehicle Number',
        'Please enter your vehicle number.'
      );
      return;
    }

    if (!address.trim()) {
      Alert.alert(
        'Missing Address',
        'Please enter your address.'
      );
      return;
    }

    if (!city.trim()) {
      Alert.alert(
        'Missing City',
        'Please enter your city.'
      );
      return;
    }

    if (!state.trim()) {
      Alert.alert(
        'Missing State',
        'Please enter your state.'
      );
      return;
    }

    if (pinCode.trim().length !== 6) {
      Alert.alert(
        'Invalid PIN Code',
        'Please enter a valid 6-digit PIN code.'
      );
      return;
    }

    if (
      emergencyContactPhone &&
      normalizePhone(emergencyContactPhone).length !== 10
    ) {
      Alert.alert(
        'Invalid Emergency Contact',
        'Please enter a valid 10-digit emergency contact number.'
      );
      return;
    }

    if (
      alternateContact &&
      normalizePhone(alternateContact).length !== 10
    ) {
      Alert.alert(
        'Invalid Alternate Contact',
        'Please enter a valid 10-digit alternate contact number.'
      );
      return;
    }

    if (
      aadhaarNumber &&
      normalizeAadhaar(aadhaarNumber).length !== 12
    ) {
      Alert.alert(
        'Invalid Aadhaar Number',
        'Aadhaar number must contain 12 digits.'
      );
      return;
    }

    if (
      panNumber &&
      normalizePan(panNumber).length !== 10
    ) {
      Alert.alert(
        'Invalid PAN Number',
        'PAN number must contain 10 characters.'
      );
      return;
    }

    if (
      drivingLicenseNumber.trim() &&
      drivingLicenseNumber.trim().length < 5
    ) {
      Alert.alert(
        'Invalid Driving Licence',
        'Please enter a valid driving licence number.'
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * IMPORTANT:
       *
       * No KYC image is uploaded here.
       *
       * Registration only creates the Auth user,
       * riders record and rider_profiles record.
       *
       * KYC documents are completed later from
       * the authenticated Complete KYC screen.
       */

      const rider = await registerRider({
        rider_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,

        vehicle_type:
          vehicleType.trim(),

        vehicle_number:
          vehicleNumber.trim().toUpperCase(),

        is_specially_abled:
          isSpeciallyAbled,

        gender:
          gender.trim() || null,

        blood_group:
          bloodGroup.trim() || null,

        address:
          address.trim(),

        city:
          city.trim(),

        state:
          state.trim(),

        pin_code:
          pinCode.trim(),

        emergency_contact_name:
          emergencyContactName.trim() || null,

        emergency_contact_phone:
          normalizePhone(
            emergencyContactPhone
          ) || null,

        alternate_contact:
          normalizePhone(
            alternateContact
          ) || null,

        account_holder_name:
          accountHolderName.trim() || null,

        bank_name:
          bankName.trim() || null,

        account_number:
          accountNumber.trim() || null,

        ifsc_code:
          normalizeIfsc(ifscCode) || null,

        upi_id:
          upiId.trim() || null,

        /*
         * KYC numbers are optional.
         * If entered, they are saved.
         */
        aadhaar_number:
          normalizeAadhaar(aadhaarNumber) || null,

        pan_number:
          normalizePan(panNumber) || null,

        driving_license_number:
          drivingLicenseNumber.trim() || null,

        /*
         * KYC document URIs intentionally NOT passed.
         *
         * Even if the UI previously selected files,
         * registration does not upload them.
         */
      });

      console.log(
        'Rider registration successful:',
        rider?.id
      );

      Alert.alert(
        'Registration Successful',
        'Your rider account has been created. KYC is optional and can be completed later from your profile.',
        [
          {
            text: 'Continue',
            onPress: () => {
              router.replace('/');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error(
        'Rider registration error:',
        error
      );

      const message =
        error?.message ||
        'Unable to create your rider account. Please try again.';

      Alert.alert(
        'Registration Failed',
        message
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // INPUT COMPONENT
  // ---------------------------------------------------------

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    options?: {
      keyboardType?: any;
      autoCapitalize?: any;
      secureTextEntry?: boolean;
      maxLength?: number;
      multiline?: boolean;
      editable?: boolean;
    }
  ) => {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label}
        </Text>

        <TextInput
          style={[
            styles.input,
            options?.multiline &&
              styles.multilineInput,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={
            options?.keyboardType || 'default'
          }
          autoCapitalize={
            options?.autoCapitalize ||
            'sentences'
          }
          secureTextEntry={
            options?.secureTextEntry || false
          }
          maxLength={options?.maxLength}
          multiline={
            options?.multiline || false
          }
          editable={
            options?.editable !== false
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ------------------------------------------------ */}
          {/* HEADER */}
          {/* ------------------------------------------------ */}

          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>
                R
              </Text>
            </View>

            <Text style={styles.title}>
              Rider Registration
            </Text>

            <Text style={styles.subtitle}>
              Create your Rivo rider account
            </Text>
          </View>

          {/* ------------------------------------------------ */}
          {/* PERSONAL DETAILS */}
          {/* ------------------------------------------------ */}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Personal Details
            </Text>

            {renderInput(
              'Full Name *',
              riderName,
              setRiderName,
              'Enter your full name'
            )}

            {renderInput(
              'Email *',
              email,
              setEmail,
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
                  normalizePhone(value)
                ),
              '10-digit mobile number',
              {
                keyboardType:
                  'phone-pad',
                maxLength: 10,
              }
            )}

            {renderInput(
              'Gender',
              gender,
              setGender,
              'Male / Female / Other'
            )}

            {renderInput(
              'Blood Group',
              bloodGroup,
              setBloodGroup,
              'e.g. O+'
            )}
          </View>

          {/* ------------------------------------------------ */}
          {/* VEHICLE DETAILS */}
          {/* ------------------------------------------------ */}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Vehicle Details
            </Text>

            {renderInput(
              'Vehicle Type *',
              vehicleType,
              setVehicleType,
              'Bike / Scooter / Cycle'
            )}

            {renderInput(
              'Vehicle Number *',
              vehicleNumber,
              (value) =>
                setVehicleNumber(
                  value.toUpperCase()
                ),
              'e.g. MH12AB1234',
              {
                autoCapitalize:
                  'characters',
              }
            )}

            <TouchableOpacity
              style={[
                styles.checkboxRow,
                isSpeciallyAbled &&
                  styles.checkboxRowActive,
              ]}
              onPress={() =>
                setIsSpeciallyAbled(
                  (previous) =>
                    !previous
                )
              }
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  isSpeciallyAbled &&
                    styles.checkboxActive,
                ]}
              >
                {isSpeciallyAbled && (
                  <Text
                    style={
                      styles.checkboxTick
                    }
                  >
                    ✓
                  </Text>
                )}
              </View>

              <Text
                style={
                  styles.checkboxLabel
                }
              >
                I am specially abled
              </Text>
            </TouchableOpacity>
          </View>

          {/* ------------------------------------------------ */}
          {/* ADDRESS */}
          {/* ------------------------------------------------ */}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Address
            </Text>

            {renderInput(
              'Address *',
              address,
              setAddress,
              'House / Street / Area',
              {
                multiline: true,
              }
            )}

            {renderInput(
              'City *',
              city,
              setCity,
              'City'
            )}

            {renderInput(
              'State *',
              state,
              setState,
              'State'
            )}

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
                    .slice(0, 6)
                ),
              '6-digit PIN code',
              {
                keyboardType:
                  'number-pad',
                maxLength: 6,
              }
            )}
          </View>

          {/* ------------------------------------------------ */}
          {/* EMERGENCY CONTACT */}
          {/* ------------------------------------------------ */}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Emergency Contact
            </Text>

            {renderInput(
              'Contact Name',
              emergencyContactName,
              setEmergencyContactName,
              'Emergency contact name'
            )}

            {renderInput(
              'Contact Number',
              emergencyContactPhone,
              (value) =>
                setEmergencyContactPhone(
                  normalizePhone(value)
                ),
              '10-digit mobile number',
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
                  normalizePhone(value)
                ),
              'Optional alternate number',
              {
                keyboardType:
                  'phone-pad',
                maxLength: 10,
              }
            )}
          </View>

          {/* ------------------------------------------------ */}
          {/* BANK DETAILS */}
          {/* ------------------------------------------------ */}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Bank Details
            </Text>

            <Text style={styles.optionalText}>
              Optional — you can add these later.
            </Text>

            {renderInput(
              'Account Holder Name',
              accountHolderName,
              setAccountHolderName,
              'Account holder name'
            )}

            {renderInput(
              'Bank Name',
              bankName,
              setBankName,
              'Bank name'
            )}

            {renderInput(
              'Account Number',
              accountNumber,
              setAccountNumber,
              'Bank account number',
              {
                keyboardType:
                  'number-pad',
              }
            )}

            {renderInput(
              'IFSC Code',
              ifscCode,
              (value) =>
                setIfscCode(
                  normalizeIfsc(value)
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
              setUpiId,
              'example@upi',
              {
                autoCapitalize:
                  'none',
              }
            )}
          </View>

          {/* ------------------------------------------------ */}
          {/* OPTIONAL KYC */}
          {/* ------------------------------------------------ */}

          <View style={styles.card}>
            <View
              style={
                styles.kycHeaderRow
              }
            >
              <View
                style={
                  styles.kycHeaderTextContainer
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  KYC Information
                </Text>

                <Text
                  style={
                    styles.optionalBadge
                  }
                >
                  OPTIONAL
                </Text>
              </View>
            </View>

            <Text style={styles.kycInfoText}>
              You can skip KYC during registration.
              Your account can be created now and
              you can complete KYC later from your
              rider profile.
            </Text>

            {renderInput(
              'Aadhaar Number',
              aadhaarNumber,
              (value) =>
                setAadhaarNumber(
                  normalizeAadhaar(value)
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
                  normalizePan(value)
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
              'Driving licence number'
            )}

            <View
              style={
                styles.kycLaterNotice
              }
            >
              <Text
                style={
                  styles.kycLaterNoticeTitle
                }
              >
                📋 Documents can be uploaded later
              </Text>

              <Text
                style={
                  styles.kycLaterNoticeText
                }
              >
                Aadhaar, PAN, driving licence,
                vehicle RC and selfie documents
                are completed from the Complete
                KYC section after registration.
              </Text>
            </View>
          </View>

          {/* ------------------------------------------------ */}
          {/* REGISTER BUTTON */}
          {/* ------------------------------------------------ */}

          <TouchableOpacity
            style={[
              styles.registerButton,
              loading &&
                styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.registerButtonText
                }
              >
                Create Rider Account
              </Text>
            )}
          </TouchableOpacity>

          {/* ------------------------------------------------ */}
          {/* LOGIN */}
          {/* ------------------------------------------------ */}

          <View
            style={
              styles.loginContainer
            }
          >
            <Text
              style={
                styles.loginText
              }
            >
              Already have a rider account?
            </Text>

            <TouchableOpacity
              onPress={() =>
                router.replace(
                  '/login'
                )
              }
              disabled={loading}
            >
              <Text
                style={
                  styles.loginLink
                }
              >
                Login
              </Text>
            </TouchableOpacity>
          </View>

          {/* ------------------------------------------------ */}
          {/* FOOTER */}
          {/* ------------------------------------------------ */}

          <Text
            style={
              styles.footerText
            }
          >
            By creating an account, you agree
            to Rivo's terms and privacy policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#22CC71',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },

  title: {
    color: '#0D0D0D',
    fontSize: 25,
    fontWeight: '900',
  },

  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 5,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },

  sectionTitle: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 14,
  },

  fieldContainer: {
    marginBottom: 14,
  },

  fieldLabel: {
    color: '#0D0D0D',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },

  input: {
    width: '100%',
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '600',
  },

  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  checkboxRowActive: {
    opacity: 1,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  checkboxActive: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },

  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  checkboxLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },

  optionalText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 14,
  },

  kycHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  kycHeaderTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  optionalBadge: {
    color: '#22CC71',
    backgroundColor: '#E8FBF0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: '900',
    overflow: 'hidden',
  },

  kycInfoText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 16,
  },

  kycLaterNotice: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 13,
    marginTop: 2,
  },

  kycLaterNoticeTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },

  kycLaterNoticeText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },

  registerButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#22CC71',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },

  registerButtonDisabled: {
    opacity: 0.65,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 5,
  },

  loginText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },

  loginLink: {
    color: '#22CC71',
    fontSize: 13,
    fontWeight: '900',
  },

  footerText: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 20,
  },
});