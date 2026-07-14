import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeOutRight,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

// --- Interfaces & Types ---
interface FormData {
  address: string;
  city: string;
  state: string;
  pinCode: string;
  emergencyContact: string;
  alternateContact: string;
  vehicleType: string;
  vehicleNumber: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  aadhaarNumber: string;
  panNumber: string;
  dlNumber: string;
}

interface FormErrors {
  [key: string]: string;
}

const TOTAL_STEPS = 5;

export default function CompleteKycScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const navigation = useNavigation();
  
  // App / Integration Engine States
  const [riderId, setRiderId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSuccessState, setIsSuccessState] = useState<boolean>(false);
  const [isBankEditing, setIsBankEditing] = useState<boolean>(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState<boolean>(false);

  // Form State Architecture
  const [formData, setFormData] = useState<FormData>({
    address: '',
    city: '',
    state: '',
    pinCode: '',
    emergencyContact: '',
    alternateContact: '',
    vehicleType: '',
    vehicleNumber: '',
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    aadhaarNumber: '',
    panNumber: '',
    dlNumber: '',
  });

  const [initialDataState, setInitialDataState] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const progress = useSharedValue(0.2);

  // --- On Screen Load Data Fetching & Resume Pipeline ---
  useEffect(() => {
    async function loadRiderKycData() {
      try {
        setIsLoadingProfile(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          Alert.alert('Authentication Error', 'Please log in again to complete your verification.');
          router.replace('/login');
          return;
        }

        setAuthUserId(user.id);

        const { data: rider, error: dbError } = await supabase
          .from('riders')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

        if (dbError && dbError.code !== 'PGRST116') {
          throw dbError;
        }

        if (rider) {
          setRiderId(rider.id);

          let baseData: FormData = {
            address: rider.address || '',
            city: rider.city || '',
            state: rider.state || '',
            pinCode: rider.pin_code || '',
            emergencyContact: rider.emergency_contact || '',
            alternateContact: rider.alternate_contact || '',
            vehicleType: rider.vehicle_type || '',
            vehicleNumber: rider.vehicle_number || '',
            accountHolderName: rider.account_holder_name || '',
            bankName: rider.bank_name || '',
            accountNumber: rider.account_number || '',
            ifscCode: rider.ifsc_code || '',
            upiId: rider.upi_id || '',
            aadhaarNumber: rider.aadhaar_number || '',
            panNumber: rider.pan_number || '',
            dlNumber: rider.driving_license_number || '',
          };

          // Prioritize loading kyc_draft over the formal columns if it exists
          if (rider.kyc_draft) {
            try {
              const draftData = typeof rider.kyc_draft === 'string' ? JSON.parse(rider.kyc_draft) : rider.kyc_draft;
              baseData = { ...baseData, ...draftData };
              
              const targetStep = rider.kyc_current_step || 1;
              setCurrentStep(targetStep);
              progress.value = targetStep / TOTAL_STEPS;
              setShowRestoredBanner(true);
            } catch (jsonErr) {
              console.error('Failed processing kyc_draft data format payload:', jsonErr);
            }
          } else {
            progress.value = 1 / TOTAL_STEPS;
          }

          setFormData(baseData);
          setInitialDataState(baseData);

          if (baseData.accountNumber) {
            setIsBankEditing(false);
          }
        }
      } catch (err: any) {
        Alert.alert('Data Sync Error', err.message || 'Could not securely fetch profile assets.');
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadRiderKycData();
  }, []);

  // Check if any field has been modified from baseline state
  const hasUnsavedChanges = (): boolean => {
    if (!initialDataState) return false;
    return Object.keys(formData).some(
      (key) => formData[key as keyof FormData] !== initialDataState[key as keyof FormData]
    );
  };

  // Intercept Navigation Changes / Back Actions for Unsaved Progress Alert
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges() || isSuccessState) {
        return;
      }
      e.preventDefault();

      Alert.alert(
        'Discard KYC Progress?',
        'You have unsaved KYC information. If you leave now your progress will be lost.',
        [
          { text: 'Continue Editing', style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, formData, initialDataState, isSuccessState]);

  const updateField = (key: keyof FormData, value: string | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // --- Auto Save Persistent Engine ---
  const saveKycDraftState = async (nextStepIndex: number) => {
    if (!authUserId) return;
    try {
      await supabase
        .from('riders')
        .update({
          kyc_draft: formData,
          kyc_current_step: nextStepIndex,
        })
        .eq('auth_user_id', authUserId);
    } catch (err) {
      console.error('Failed executing auto save draft matrix payload context:', err);
    }
  };

  // --- Strict Format Checking Validation Logic ---
  const validateStep = (step: number): boolean => {
    const nextErrors: FormErrors = {};

    if (step === 1) {
      if (!formData.address.trim()) nextErrors.address = 'Address is required';
      if (!formData.city.trim()) nextErrors.city = 'City is required';
      if (!formData.state.trim()) nextErrors.state = 'State is required';
      
      if (!/^\d{6}$/.test(formData.pinCode.trim())) {
        nextErrors.pinCode = 'PIN Code must be exactly 6 digits';
      }
      if (!/^\d{10}$/.test(formData.emergencyContact.trim())) {
        nextErrors.emergencyContact = 'Emergency contact must be exactly 10 digits';
      }
      if (formData.alternateContact.trim() && !/^\d{10}$/.test(formData.alternateContact.trim())) {
        nextErrors.alternateContact = 'Alternate contact must be exactly 10 digits';
      }
    } else if (step === 2) {
      if (!formData.vehicleType.trim()) nextErrors.vehicleType = 'Vehicle type is required';
      if (!formData.vehicleNumber.trim()) nextErrors.vehicleNumber = 'Vehicle number is required';
      if (!/^\d{10}$/.test(formData.emergencyContact.trim())) {
        nextErrors.emergencyContact = 'Emergency contact must be exactly 10 digits';
      }
    } else if (step === 3 && isBankEditing) {
      if (!formData.accountHolderName.trim()) nextErrors.accountHolderName = 'Account holder name is required';
      if (!formData.bankName.trim()) nextErrors.bankName = 'Bank name is required';
      if (!formData.accountNumber.trim()) nextErrors.accountNumber = 'Account number is required';
      
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode.trim())) {
        nextErrors.ifscCode = 'IFSC must match format AAAA0123456';
      }
      if (!formData.upiId.trim().includes('@')) {
        nextErrors.upiId = 'UPI ID must contain @ symbol';
      }
    } else if (step === 4) {
      if (!/^\d{12}$/.test(formData.aadhaarNumber.trim())) {
        nextErrors.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
      }
      
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.trim())) {
        nextErrors.panNumber = 'PAN number must match format ABCDE1234F';
      }
      
      if (formData.dlNumber.trim().length < 10) {
        nextErrors.dlNumber = 'Driving License number must be at least 10 characters';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // --- Controls Handling ---
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        progress.value = withTiming(nextStep / TOTAL_STEPS, { duration: 350 });
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        
        // Execute step auto save trigger sequentially
        saveKycDraftState(nextStep);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      progress.value = withTiming(prevStep / TOTAL_STEPS, { duration: 350 });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // --- Complete Submission Core Engine ---
  const handleSubmit = async () => {
    if (isSubmitting || !riderId || !authUserId) return;

    const isP1Valid = validateStep(1);
    const isP2Valid = validateStep(2);
    const isP3Valid = validateStep(3);
    const isP4Valid = validateStep(4);

    if (!isP1Valid || !isP2Valid || !isP3Valid || !isP4Valid) {
      for (let s = 1; s <= 4; s++) {
        if (!validateStep(s)) {
          setCurrentStep(s);
          progress.value = withTiming(s / TOTAL_STEPS, { duration: 350 });
          break;
        }
      }
      return;
    }

    try {
      setIsSubmitting(true);

      // Perform Mutation query updates against the Database context table columns exclusively
      const { error: dbUpdateError } = await supabase
        .from('riders')
        .update({
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pin_code: formData.pinCode,
          emergency_contact: formData.emergencyContact,
          alternate_contact: formData.alternateContact,
          aadhaar_number: formData.aadhaarNumber,
          pan_number: formData.panNumber,
          driving_license_number: formData.dlNumber,
          account_holder_name: formData.accountHolderName,
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          ifsc_code: formData.ifscCode,
          upi_id: formData.upiId,
          kyc_status: 'pending',
          verification_notes: null,
          documents_updated_at: new Date().toISOString(),
          // Clear active session kyc draft details configuration values upon submission success
          kyc_draft: null,
          kyc_current_step: 1,
        })
        .eq('auth_user_id', authUserId);

      if (dbUpdateError) throw dbUpdateError;

      setIsSuccessState(true);
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Verification payload transaction processing failure occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Shared Reanimated Value Animations Styles ---
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  if (isLoadingProfile) {
    return (
      <View style={styles.loaderCenterWrapper}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loaderSyncText}>Syncing Rider Profile Configuration...</Text>
      </View>
    );
  }

  // --- Full Screen Success Frame ---
  if (isSuccessState) {
    return (
      <SafeAreaView style={styles.successWrapper}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.successInnerCard}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>KYC Submitted Successfully</Text>
          <Text style={styles.successDescription}>
            Your documents have been securely received. Our verification team will review them within 24–48 hours. You'll receive a notification once your KYC has been approved or rejected.
          </Text>
          
          <Pressable 
            style={({ pressed }) => [styles.successActionBtn, pressed && { transform: [{ scale: 0.97 }] }]}
            onPress={() => router.replace('/(tabs)/profile')}
          >
            <Text style={styles.successActionBtnText}>Back to Profile</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        {/* Screen Heading Area */}
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>Complete Your KYC</Text>
          <Text style={styles.subtitleText}>
            Complete your verification before you can start receiving delivery requests.
          </Text>
          
          {showRestoredBanner && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.restoredDraftBannerRow}>
              <Ionicons name="refresh-circle" size={16} color="#047857" />
              <View style={{ marginLeft: 6, flex: 1 }}>
                <Text style={styles.restoredDraftBannerTitle}>Continue your KYC</Text>
                <Text style={styles.restoredDraftBannerText}>We restored your previous progress.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRestoredBanner(false)}>
                <Ionicons name="close" size={16} color="#047857" />
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={styles.timeBadgeRow}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.timeBadgeText}>Estimated time: 5–10 minutes</Text>
          </View>
          <View style={styles.securityBadgeRow}>
            <Ionicons name="shield-checkmark" size={13} color="#059669" />
            <Text style={styles.securityBadgeText}>
              Your documents are securely encrypted and reviewed only by authorized Rivo administrators.
            </Text>
          </View>
        </View>

        {/* Linear Managed Tracker Component */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressStepLabel}>Step {currentStep} of {TOTAL_STEPS}</Text>
            <Text style={styles.progressPercentageLabel}>{Math.round((currentStep / TOTAL_STEPS) * 100)}%</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <Animated.View style={[styles.progressBarFill, animatedProgressStyle]} />
          </View>
        </View>

        {/* Container Forms Area */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View layout={Layout.duration(200)}>
            
            {/* STEP 1: Personal Verification Metadata */}
            {currentStep === 1 && (
              <Animated.View entering={FadeInLeft.duration(300)} exiting={FadeOutRight.duration(300)} style={styles.stepCard}>
                <Text style={styles.sectionHeading}>Personal Details</Text>
                <Text style={styles.helperTextBanner}>This address will be used for verification purposes.</Text>
                
                <RenderInput label="Address" value={formData.address} onChangeText={(val) => updateField('address', val)} error={errors.address} placeholder="House, Street name, Locality" />
                <RenderInput label="City" value={formData.city} onChangeText={(val) => updateField('city', val)} error={errors.city} placeholder="City name" />
                <RenderInput label="State" value={formData.state} onChangeText={(val) => updateField('state', val)} error={errors.state} placeholder="State territory" />
                <RenderInput label="PIN Code" value={formData.pinCode} onChangeText={(val) => updateField('pinCode', val)} error={errors.pinCode} placeholder="6-digit postal index code" keyboardType="number-pad" maxLength={6} />
                <RenderInput label="Emergency Contact" value={formData.emergencyContact} onChangeText={(val) => updateField('emergencyContact', val)} error={errors.emergencyContact} placeholder="Primary relative number (10 digits)" keyboardType="number-pad" maxLength={10} />
                <RenderInput label="Alternate Contact (optional)" value={formData.alternateContact} onChangeText={(val) => updateField('alternateContact', val)} error={errors.alternateContact} placeholder="Secondary backup number (10 digits)" keyboardType="number-pad" maxLength={10} />
              </Animated.View>
            )}

            {/* STEP 2: Pre-registered Vehicle & Contact Info Display */}
            {currentStep === 2 && (
              <Animated.View entering={FadeInLeft.duration(300)} exiting={FadeOutRight.duration(300)} style={styles.stepCard}>
                <Text style={styles.sectionHeading}>Contact & Vehicle</Text>

                <RenderInput label="Vehicle Type" value={formData.vehicleType} onChangeText={(val) => updateField('vehicleType', val)} error={errors.vehicleType} placeholder="e.g. Motorcycle" isRegisteredLabel />
                <RenderInput label="Vehicle Number" value={formData.vehicleNumber} onChangeText={(val) => updateField('vehicleNumber', val)} error={errors.vehicleNumber} placeholder="e.g. MH-12-XX-0000" autoCapitalize="characters" isRegisteredLabel />
                <RenderInput label="Emergency Contact" value={formData.emergencyContact} onChangeText={(val) => updateField('emergencyContact', val)} error={errors.emergencyContact} placeholder="Primary safety target phone" keyboardType="number-pad" maxLength={10} />
                <RenderInput label="Alternate Contact" value={formData.alternateContact} onChangeText={(val) => updateField('alternateContact', val)} error={errors.alternateContact} placeholder="Secondary safe fallback phone" keyboardType="number-pad" maxLength={10} />
              </Animated.View>
            )}

            {/* STEP 3: Premium Editable Financial Asset Section */}
            {currentStep === 3 && (
              <Animated.View entering={FadeInLeft.duration(300)} exiting={FadeOutRight.duration(300)} style={styles.stepCard}>
                <View style={styles.bankHeaderRow}>
                  <Text style={styles.sectionHeading}>Bank Details</Text>
                  {!isBankEditing && (
                    <TouchableOpacity style={styles.bankEditInlineBtn} onPress={() => setIsBankEditing(true)}>
                      <Ionicons name="create-outline" size={14} color="#10B981" />
                      <Text style={styles.bankEditInlineBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!isBankEditing ? (
                  <View style={styles.existingBankCard}>
                    <View style={styles.existingBankHeader}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.existingBankCardTitle}>Existing Bank Details Verified</Text>
                    </View>
                    <Text style={styles.existingBankTextSub}>{formData.bankName || 'Unknown Bank'} •••• {formData.accountNumber ? formData.accountNumber.slice(-4) : 'XXXX'}</Text>
                    <Text style={styles.existingBankTextSub}>{formData.accountHolderName || 'Rider Profile Beneficiary'}</Text>
                  </View>
                ) : (
                  <View>
                    <RenderInput label="Account Holder" value={formData.accountHolderName} onChangeText={(val) => updateField('accountHolderName', val)} error={errors.accountHolderName} placeholder="Name as visible in bank records" />
                    <RenderInput label="Bank Name" value={formData.bankName} onChangeText={(val) => updateField('bankName', val)} error={errors.bankName} placeholder="e.g. Axis Bank" />
                    <RenderInput label="Account Number" value={formData.accountNumber} onChangeText={(val) => updateField('accountNumber', val)} error={errors.accountNumber} placeholder="Target account code number" keyboardType="number-pad" secureTextEntry />
                    <RenderInput label="IFSC" value={formData.ifscCode} onChangeText={(val) => updateField('ifscCode', val)} error={errors.ifscCode} placeholder="11 character alphanumeric routing code" autoCapitalize="characters" />
                    <RenderInput label="UPI" value={formData.upiId} onChangeText={(val) => updateField('upiId', val)} error={errors.upiId} placeholder="handle@bank" autoCapitalize="none" />
                    
                    {formData.accountNumber.length > 4 && (
                      <TouchableOpacity style={styles.lockBankBtn} onPress={() => { if(validateStep(3)) setIsBankEditing(false); }}>
                        <Text style={styles.lockBankBtnText}>✓ Save & Lock Bank Profile</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Animated.View>
            )}

            {/* STEP 4: Managed Individual Premium Document Selection Matrix */}
            {currentStep === 4 && (
              <Animated.View entering={FadeInLeft.duration(300)} exiting={FadeOutRight.duration(300)} style={styles.stepCard}>
                <Text style={styles.sectionHeading}>Identity Verification</Text>

                {/* Profile Photo Module */}
                <View style={styles.docWrapperBlock}>
                  <Text style={styles.fieldLabelText}>Profile Photo</Text>
                  <View style={styles.soonMessageContainer}>
                    <Text style={styles.soonMessageText}>Document upload will be available soon. Our team will contact you for verification.</Text>
                  </View>
                </View>

                {/* Aadhaar Setup Module */}
                <View style={styles.docWrapperBlock}>
                  <RenderInput label="Aadhaar" value={formData.aadhaarNumber} onChangeText={(val) => updateField('aadhaarNumber', val)} error={errors.aadhaarNumber} placeholder="12-digit identity number" keyboardType="number-pad" maxLength={12} secureTextEntry />
                  <View style={styles.soonMessageContainer}>
                    <Text style={styles.soonMessageText}>Document upload will be available soon. Our team will contact you for verification.</Text>
                  </View>
                </View>

                {/* PAN Processing Card Frame */}
                <View style={styles.docWrapperBlock}>
                  <RenderInput label="PAN" value={formData.panNumber} onChangeText={(val) => updateField('panNumber', val)} error={errors.panNumber} placeholder="10-digit alphanumeric index sequence" autoCapitalize="characters" maxLength={10} />
                  <View style={styles.soonMessageContainer}>
                    <Text style={styles.soonMessageText}>Document upload will be available soon. Our team will contact you for verification.</Text>
                  </View>
                </View>

                {/* Driving License Matrix Module */}
                <View style={styles.docWrapperBlock}>
                  <RenderInput label="Driving License" value={formData.dlNumber} onChangeText={(val) => updateField('dlNumber', val)} error={errors.dlNumber} placeholder="DL reference identification" autoCapitalize="characters" />
                  <View style={styles.soonMessageContainer}>
                    <Text style={styles.soonMessageText}>Document upload will be available soon. Our team will contact you for verification.</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* STEP 5: Complex Summary Comprehensive Multi-panel Dashboard Review */}
            {currentStep === 5 && (
              <Animated.View entering={FadeInLeft.duration(300)} exiting={FadeOutRight.duration(300)} style={styles.stepCard}>
                <Text style={styles.sectionHeading}>Review Forms & Documents</Text>

                {/* Personal Details */}
                <Text style={styles.reviewBlockHeadingText}>Personal Details</Text>
                <View style={styles.reviewWrapperBox}>
                  <ReviewLineItem label="Address" value={formData.address} />
                  <ReviewLineItem label="City" value={formData.city} />
                  <ReviewLineItem label="State" value={formData.state} />
                  <ReviewLineItem label="PIN Code" value={formData.pinCode} />
                  <ReviewLineItem label="Emergency Contact" value={formData.emergencyContact} />
                </View>

                {/* Vehicle Setup */}
                <Text style={styles.reviewBlockHeadingText}>Vehicle</Text>
                <View style={styles.reviewWrapperBox}>
                  <ReviewLineItem label="Vehicle Type" value={formData.vehicleType} />
                  <ReviewLineItem label="Vehicle Number" value={formData.vehicleNumber} />
                </View>

                {/* Bank Data Information */}
                <Text style={styles.reviewBlockHeadingText}>Bank</Text>
                <View style={styles.reviewWrapperBox}>
                  <ReviewLineItem label="Account Holder" value={formData.accountHolderName} />
                  <ReviewLineItem label="Bank Name" value={formData.bankName} />
                  <ReviewLineItem label="Account Number" value={formData.accountNumber ? `••••${formData.accountNumber.slice(-4)}` : ''} />
                  <ReviewLineItem label="IFSC" value={formData.ifscCode} />
                  <ReviewLineItem label="UPI" value={formData.upiId} />
                </View>
              </Animated.View>
            )}

          </Animated.View>
        </ScrollView>

        {/* Action Controls Navigation Persistent Unit */}
        <View style={[styles.actionNavigationFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          
          {/* Legal Warning Meta Box (Rendered contextually inside step 5 layout space) */}
          {currentStep === TOTAL_STEPS && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.disclaimerFullWrapper}>
              <Text style={styles.disclaimerTextBody}>
                By submitting your KYC, you confirm that all information provided is accurate. Submitting false information may result in permanent suspension of your rider account.
              </Text>
            </Animated.View>
          )}

          <View style={styles.actionButtonsHorizontalLayoutRow}>
            {currentStep > 1 ? (
              <TouchableOpacity 
                style={styles.previousButtonAction} 
                onPress={handlePrev} 
                activeOpacity={0.7}
                disabled={isSubmitting}
              >
                <Text style={styles.previousButtonText}>Previous</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {currentStep < TOTAL_STEPS ? (
              <TouchableOpacity style={styles.nextPrimaryButtonAction} onPress={handleNext} activeOpacity={0.8}>
                <Text style={styles.nextButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ) : (
              <Pressable 
                style={({ pressed }) => [
                  styles.submitKycButtonAction, 
                  (pressed || isSubmitting) && { transform: [{ scale: 0.98 }] },
                  isSubmitting && { backgroundColor: '#A7F3D0' }
                ]} 
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#065F46" style={{ marginRight: 8 }} />
                    <Text style={[styles.nextButtonText, { color: '#065F46' }]}>Submitting...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Submit for Verification</Text>
                    <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Internal Architectural Modular Elements ---

function RenderInput({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  maxLength,
  isRegisteredLabel = false,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  error?: string;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  isRegisteredLabel?: boolean;
}) {
  return (
    <View style={styles.inputOuterContainer}>
      <Text style={styles.fieldLabelText}>{label}</Text>
      <TextInput
        style={[styles.inputElement, error ? styles.inputElementError : null, isRegisteredLabel ? styles.inputDisabledStyle : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={!isRegisteredLabel}
      />
      {isRegisteredLabel && (
        <Text style={styles.alreadyRegisteredSubtext}>Already registered</Text>
      )}
      {error ? <Text style={styles.inlineErrorText}>{error}</Text> : null}
    </View>
  );
}

function ReviewLineItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewLineWrapperRow}>
      <Text style={styles.reviewLabelLeft}>{label}</Text>
      <Text style={styles.reviewValueRight} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardContainer: {
    flex: 1,
  },
  loaderCenterWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loaderSyncText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  titleText: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.6,
  },
  subtitleText: {
    fontSize: 13.5,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 19,
  },
  restoredDraftBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  restoredDraftBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  restoredDraftBannerText: {
    fontSize: 12,
    color: '#047857',
    marginTop: 1,
  },
  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginLeft: 5,
  },
  securityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  securityBadgeText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#065F46',
    marginLeft: 6,
    flex: 1,
    lineHeight: 15,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginVertical: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressStepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  progressPercentageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  helperTextBanner: {
    fontSize: 12.5,
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    marginBottom: 16,
  },
  inputOuterContainer: {
    marginBottom: 14,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  inputElement: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputElementError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputDisabledStyle: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
    borderColor: '#E5E7EB',
  },
  alreadyRegisteredSubtext: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  inlineErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
  bankHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankEditInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bankEditInlineBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 4,
  },
  existingBankCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  existingBankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  existingBankCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    marginLeft: 6,
  },
  existingBankTextSub: {
    fontSize: 13,
    color: '#14532D',
    marginTop: 2,
  },
  lockBankBtn: {
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lockBankBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  docWrapperBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 16,
    marginBottom: 16,
  },
  soonMessageContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  soonMessageText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  reviewBlockHeadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  reviewWrapperBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewLineWrapperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  reviewLabelLeft: {
    fontSize: 13,
    color: '#6B7280',
    flex: 0.45,
  },
  reviewValueRight: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 0.55,
    textAlign: 'right',
  },
  actionNavigationFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  disclaimerFullWrapper: {
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  disclaimerTextBody: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
    textAlign: 'center',
  },
  actionButtonsHorizontalLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previousButtonAction: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previousButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  nextPrimaryButtonAction: {
    flex: 1.2,
    height: 48,
    backgroundColor: '#111827',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitKycButtonAction: {
    flex: 1.8,
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successWrapper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successInnerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  successActionBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});