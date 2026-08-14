import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

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

interface DocumentState {
  profilePhotoUrl: string;
  aadhaarFrontUrl: string;
  aadhaarBackUrl: string;
  panCardUrl: string;
  drivingLicenseUrl: string;
  selfieUrl: string;
  vehicleRcUrl: string;
}

interface FormErrors {
  [key: string]: string;
}

type UploadType =
  | 'profile-photo'
  | 'aadhaar-front'
  | 'aadhaar-back'
  | 'pan-card'
  | 'driving-license'
  | 'selfie'
  | 'vehicle-rc';

const TOTAL_STEPS = 5;

const EMPTY_DOCUMENTS: DocumentState = {
  profilePhotoUrl: '',
  aadhaarFrontUrl: '',
  aadhaarBackUrl: '',
  panCardUrl: '',
  drivingLicenseUrl: '',
  selfieUrl: '',
  vehicleRcUrl: '',
};

const EMPTY_FORM: FormData = {
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
};

export default function CompleteKycScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const navigation = useNavigation();

  const [riderId, setRiderId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(1);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);

  const [showRestoredBanner, setShowRestoredBanner] =
    useState(false);

  const [isBankEditing, setIsBankEditing] =
    useState(true);

  const [uploadingType, setUploadingType] =
    useState<UploadType | null>(null);

  const [formData, setFormData] =
    useState<FormData>(EMPTY_FORM);

  const [documents, setDocuments] =
    useState<DocumentState>(EMPTY_DOCUMENTS);

  const [initialFormData, setInitialFormData] =
    useState<FormData | null>(null);

  const [initialDocuments, setInitialDocuments] =
    useState<DocumentState>(EMPTY_DOCUMENTS);

  const [errors, setErrors] =
    useState<FormErrors>({});

  const progress = useSharedValue(1 / TOTAL_STEPS);

  // ---------------------------------------------------------
  // LOAD CURRENT RIDER + PROFILE
  // ---------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadRiderKycData() {
      try {
        setIsLoadingProfile(true);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          Alert.alert(
            'Authentication Required',
            'Please log in again to complete your KYC.'
          );

          router.replace('/login');
          return;
        }

        if (!mounted) return;

        setAuthUserId(user.id);

        const {
          data: rider,
          error: riderError,
        } = await supabase
          .from('riders')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (riderError) {
          throw riderError;
        }

        if (!rider) {
          throw new Error(
            'Rider profile was not found.'
          );
        }

        setRiderId(rider.id);

        let loadedForm: FormData = {
          address: rider.address || '',
          city: rider.city || '',
          state: rider.state || '',
          pinCode: rider.pin_code || '',
          emergencyContact:
            rider.emergency_contact || '',
          alternateContact:
            rider.alternate_contact || '',
          vehicleType:
            rider.vehicle_type || '',
          vehicleNumber:
            rider.vehicle_number || '',
          accountHolderName:
            rider.account_holder_name || '',
          bankName:
            rider.bank_name || '',
          accountNumber:
            rider.account_number || '',
          ifscCode:
            rider.ifsc_code || '',
          upiId:
            rider.upi_id || '',
          aadhaarNumber:
            rider.aadhaar_number || '',
          panNumber:
            rider.pan_number || '',
          dlNumber:
            rider.driving_license_number || '',
        };

        // -----------------------------------------------------
        // LOAD RIDER PROFILE
        // -----------------------------------------------------

        let profile: any = null;

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from('rider_profiles')
          .select('*')
          .eq('rider_id', rider.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        profile = profileData;

        // -----------------------------------------------------
        // CREATE PROFILE IF MISSING
        // -----------------------------------------------------

        if (!profile) {
          const {
            data: createdProfile,
            error: createProfileError,
          } = await supabase
            .from('rider_profiles')
            .insert({
              rider_id: rider.id,
              address: rider.address || null,
              city: rider.city || null,
              state: rider.state || null,
              pin_code: rider.pin_code || null,
              emergency_contact:
                rider.emergency_contact || null,
              driving_license:
                rider.driving_license_number || null,
              aadhaar_number:
                rider.aadhaar_number || null,
              pan_number:
                rider.pan_number || null,
              account_holder_name:
                rider.account_holder_name || null,
              bank_name:
                rider.bank_name || null,
              account_number:
                rider.account_number || null,
              ifsc_code:
                rider.ifsc_code || null,
              upi_id:
                rider.upi_id || null,
              kyc_status:
                rider.kyc_status || 'pending',
            })
            .select()
            .single();

          if (createProfileError) {
            throw createProfileError;
          }

          profile = createdProfile;
        }

        // -----------------------------------------------------
        // PROFILE DATA OVERRIDES RIDER DATA WHERE AVAILABLE
        // -----------------------------------------------------

        loadedForm = {
          ...loadedForm,

          address:
            profile.address ||
            loadedForm.address,

          city:
            profile.city ||
            loadedForm.city,

          state:
            profile.state ||
            loadedForm.state,

          pinCode:
            profile.pin_code ||
            loadedForm.pinCode,

          emergencyContact:
            profile.emergency_contact ||
            loadedForm.emergencyContact,

          accountHolderName:
            profile.account_holder_name ||
            loadedForm.accountHolderName,

          bankName:
            profile.bank_name ||
            loadedForm.bankName,

          accountNumber:
            profile.account_number ||
            loadedForm.accountNumber,

          ifscCode:
            profile.ifsc_code ||
            loadedForm.ifscCode,

          upiId:
            profile.upi_id ||
            loadedForm.upiId,

          aadhaarNumber:
            profile.aadhaar_number ||
            loadedForm.aadhaarNumber,

          panNumber:
            profile.pan_number ||
            loadedForm.panNumber,

          dlNumber:
            profile.driving_license_number ||
            loadedForm.dlNumber,
        };

        // -----------------------------------------------------
        // LOAD DOCUMENT URLS
        // -----------------------------------------------------

        const loadedDocuments: DocumentState = {
          profilePhotoUrl:
            rider.profile_photo_url ||
            profile.profile_photo_url ||
            '',

          aadhaarFrontUrl:
            profile.aadhaar_front_url ||
            rider.aadhaar_document_url ||
            '',

          aadhaarBackUrl:
            profile.aadhaar_back_url ||
            '',

          panCardUrl:
            profile.pan_card_url ||
            rider.pan_document_url ||
            '',

          drivingLicenseUrl:
            profile.driving_license_url ||
            rider.driving_license_document_url ||
            '',

          selfieUrl:
            rider.selfie_photo_url ||
            profile.selfie_photo_url ||
            '',

          vehicleRcUrl:
            rider.vehicle_rc_document_url ||
            '',
        };

        // -----------------------------------------------------
        // RESTORE SAVED DRAFT
        // -----------------------------------------------------

        let restoredStep = 1;

        if (rider.kyc_draft) {
          try {
            const draft =
              typeof rider.kyc_draft === 'string'
                ? JSON.parse(rider.kyc_draft)
                : rider.kyc_draft;

            if (draft?.formData) {
              loadedForm = {
                ...loadedForm,
                ...draft.formData,
              };
            }

            if (draft?.documents) {
              Object.assign(
                loadedDocuments,
                draft.documents
              );
            }

            restoredStep =
              Number(rider.kyc_current_step) || 1;

            if (
              restoredStep < 1 ||
              restoredStep > TOTAL_STEPS
            ) {
              restoredStep = 1;
            }

            setShowRestoredBanner(true);
          } catch (draftError) {
            console.error(
              'KYC draft restore error:',
              draftError
            );
          }
        }

        if (!mounted) return;

        setFormData(loadedForm);
        setDocuments(loadedDocuments);

        setInitialFormData(loadedForm);
        setInitialDocuments(loadedDocuments);

        setCurrentStep(restoredStep);

        progress.value =
          restoredStep / TOTAL_STEPS;

        if (loadedForm.accountNumber) {
          setIsBankEditing(false);
        }
      } catch (error: any) {
        console.error(
          'KYC profile loading error:',
          error
        );

        Alert.alert(
          'Unable to Load KYC',
          error?.message ||
            'Could not load your KYC information.'
        );
      } finally {
        if (mounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadRiderKycData();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------------------------------------------------------
  // FORM CHANGE
  // ---------------------------------------------------------

  const updateField = (
    key: keyof FormData,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [key]: value,
    }));

    if (errors[key]) {
      setErrors((previous) => {
        const next = {
          ...previous,
        };

        delete next[key];

        return next;
      });
    }
  };

  // ---------------------------------------------------------
  // UNSAVED CHANGES
  // ---------------------------------------------------------

  const hasUnsavedChanges = () => {
    if (!initialFormData) {
      return false;
    }

    const formChanged = Object.keys(
      formData
    ).some((key) => {
      const typedKey =
        key as keyof FormData;

      return (
        formData[typedKey] !==
        initialFormData[typedKey]
      );
    });

    const documentsChanged =
      Object.keys(documents).some((key) => {
        const typedKey =
          key as keyof DocumentState;

        return (
          documents[typedKey] !==
          initialDocuments[typedKey]
        );
      });

    return (
      formChanged ||
      documentsChanged
    );
  };

  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        'beforeRemove',
        (event) => {
          if (
            !hasUnsavedChanges() ||
            isSuccessState
          ) {
            return;
          }

          event.preventDefault();

          Alert.alert(
            'Unsaved KYC Changes',
            'You have unsaved KYC information. Save your progress before leaving?',
            [
              {
                text: 'Continue Editing',
                style: 'cancel',
              },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () =>
                  navigation.dispatch(
                    event.data.action
                  ),
              },
            ]
          );
        }
      );

    return unsubscribe;
  }, [
    navigation,
    formData,
    documents,
    initialFormData,
    initialDocuments,
    isSuccessState,
  ]);

  // ---------------------------------------------------------
  // IMAGE PICKER
  // ---------------------------------------------------------

  const requestMediaPermission =
    async () => {
      const {
        status,
      } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow photo library access to upload your KYC document.'
        );

        return false;
      }

      return true;
    };

  const requestCameraPermission =
    async () => {
      const {
        status,
      } =
        await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to capture your KYC photo.'
        );

        return false;
      }

      return true;
    };

  // ---------------------------------------------------------
  // UPLOAD FILE
  // ---------------------------------------------------------

  const uploadDocument = async (
    uri: string,
    type: UploadType
  ) => {
    if (!riderId) {
      throw new Error(
        'Rider account is not available.'
      );
    }

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      throw new Error(
        'Your login session has expired. Please log in again.'
      );
    }

    const response =
      await fetch(uri);

    if (!response.ok) {
      throw new Error(
        'Unable to read the selected image.'
      );
    }

    const blob =
      await response.blob();

    const extension =
      getFileExtension(uri);

    const contentType =
      getMimeType(extension);

    const filePath =
      `${riderId}/${type}-${Date.now()}.${extension}`;

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from('rider-documents')
        .upload(
          filePath,
          blob,
          {
            contentType,
            upsert: true,
          }
        );

    if (uploadError) {
      console.error(
        `KYC ${type} upload error:`,
        uploadError
      );

      throw new Error(
        `Unable to upload ${getReadableDocumentName(
          type
        )}. ${uploadError.message}`
      );
    }

    const {
      data: publicData,
    } =
      supabase.storage
        .from('rider-documents')
        .getPublicUrl(
          filePath
        );

    if (
      !publicData?.publicUrl
    ) {
      throw new Error(
        `Unable to create URL for ${getReadableDocumentName(
          type
        )}.`
      );
    }

    return publicData.publicUrl;
  };

  // ---------------------------------------------------------
  // PICK IMAGE
  // ---------------------------------------------------------

  const pickDocument = async (
    type: UploadType
  ) => {
    if (uploadingType) {
      return;
    }

    const allowed =
      await requestMediaPermission();

    if (!allowed) {
      return;
    }

    try {
      setUploadingType(type);

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              'images',
            ],
            allowsEditing: true,
            quality: 0.85,
          }
        );

      if (
        result.canceled ||
        !result.assets?.[0]?.uri
      ) {
        return;
      }

      const uri =
        result.assets[0].uri;

      const url =
        await uploadDocument(
          uri,
          type
        );

      await saveUploadedDocument(
        type,
        url
      );

      Alert.alert(
        'Upload Complete',
        `${getReadableDocumentName(
          type
        )} has been uploaded successfully.`
      );
    } catch (error: any) {
      console.error(
        'KYC document picker/upload error:',
        error
      );

      Alert.alert(
        'Upload Failed',
        error?.message ||
          'Unable to upload this document.'
      );
    } finally {
      setUploadingType(null);
    }
  };

  // ---------------------------------------------------------
  // TAKE SELFIE
  // ---------------------------------------------------------

  const captureSelfie =
    async () => {
      if (uploadingType) {
        return;
      }

      const allowed =
        await requestCameraPermission();

      if (!allowed) {
        return;
      }

      try {
        setUploadingType(
          'selfie'
        );

        const result =
          await ImagePicker.launchCameraAsync(
            {
              cameraType:
                ImagePicker.CameraType.front,
              allowsEditing: true,
              aspect: [
                1,
                1,
              ],
              quality: 0.85,
            }
          );

        if (
          result.canceled ||
          !result.assets?.[0]?.uri
        ) {
          return;
        }

        const url =
          await uploadDocument(
            result.assets[0].uri,
            'selfie'
          );

        await saveUploadedDocument(
          'selfie',
          url
        );

        Alert.alert(
          'Selfie Uploaded',
          'Your KYC selfie has been uploaded successfully.'
        );
      } catch (error: any) {
        console.error(
          'Selfie upload error:',
          error
        );

        Alert.alert(
          'Upload Failed',
          error?.message ||
            'Unable to upload selfie.'
        );
      } finally {
        setUploadingType(null);
      }
    };

  // ---------------------------------------------------------
  // SAVE DOCUMENT URL
  // ---------------------------------------------------------

  const saveUploadedDocument =
    async (
      type: UploadType,
      url: string
    ) => {
      if (!riderId) {
        throw new Error(
          'Rider ID is unavailable.'
        );
      }

      const profileUpdate: Record<
        string,
        any
      > = {
        documents_updated_at:
          new Date().toISOString(),
      };

      const riderUpdate: Record<
        string,
        any
      > = {
        documents_updated_at:
          new Date().toISOString(),
      };

      switch (type) {
        case 'profile-photo':
          profileUpdate.profile_photo_url =
            url;
          riderUpdate.profile_photo_url =
            url;
          break;

        case 'aadhaar-front':
          profileUpdate.aadhaar_front_url =
            url;
          break;

        case 'aadhaar-back':
          profileUpdate.aadhaar_back_url =
            url;
          break;

        case 'pan-card':
          profileUpdate.pan_card_url =
            url;
          break;

        case 'driving-license':
          profileUpdate.driving_license_url =
            url;

          riderUpdate.driving_license_document_url =
            url;
          break;

        case 'selfie':
          profileUpdate.selfie_photo_url =
            url;

          riderUpdate.selfie_photo_url =
            url;

          riderUpdate.profile_photo_url =
            riderUpdate.profile_photo_url ||
            url;
          break;

        case 'vehicle-rc':
          riderUpdate.vehicle_rc_document_url =
            url;
          break;
      }

      // -----------------------------------------------------
      // UPDATE rider_profiles
      // -----------------------------------------------------

      const {
        error: profileError,
      } =
        await supabase
          .from('rider_profiles')
          .update(
            profileUpdate
          )
          .eq(
            'rider_id',
            riderId
          );

      if (profileError) {
        console.error(
          'KYC profile document DB update error:',
          profileError
        );

        throw new Error(
          `Document uploaded, but profile could not be updated. ${profileError.message}`
        );
      }

      // -----------------------------------------------------
      // UPDATE riders
      // -----------------------------------------------------

      if (
        Object.keys(
          riderUpdate
        ).length > 1
      ) {
        const {
          error: riderError,
        } =
          await supabase
            .from('riders')
            .update(
              riderUpdate
            )
            .eq(
              'id',
              riderId
            );

        if (riderError) {
          console.error(
            'KYC rider document DB update error:',
            riderError
          );

          throw new Error(
            `Document uploaded, but rider profile could not be updated. ${riderError.message}`
          );
        }
      }

      // -----------------------------------------------------
      // UPDATE LOCAL STATE
      // -----------------------------------------------------

      setDocuments(
        (previous) => {
          const next = {
            ...previous,
          };

          switch (type) {
            case 'profile-photo':
              next.profilePhotoUrl =
                url;
              break;

            case 'aadhaar-front':
              next.aadhaarFrontUrl =
                url;
              break;

            case 'aadhaar-back':
              next.aadhaarBackUrl =
                url;
              break;

            case 'pan-card':
              next.panCardUrl =
                url;
              break;

            case 'driving-license':
              next.drivingLicenseUrl =
                url;
              break;

            case 'selfie':
              next.selfieUrl =
                url;
              break;

            case 'vehicle-rc':
              next.vehicleRcUrl =
                url;
              break;
          }

          return next;
        }
      );

      setInitialDocuments(
        (previous) => {
          const next = {
            ...previous,
          };

          switch (type) {
            case 'profile-photo':
              next.profilePhotoUrl =
                url;
              break;

            case 'aadhaar-front':
              next.aadhaarFrontUrl =
                url;
              break;

            case 'aadhaar-back':
              next.aadhaarBackUrl =
                url;
              break;

            case 'pan-card':
              next.panCardUrl =
                url;
              break;

            case 'driving-license':
              next.drivingLicenseUrl =
                url;
              break;

            case 'selfie':
              next.selfieUrl =
                url;
              break;

            case 'vehicle-rc':
              next.vehicleRcUrl =
                url;
              break;
          }

          return next;
        }
      );
    };

  // ---------------------------------------------------------
  // SAVE KYC DATA
  // ---------------------------------------------------------

  const saveKycData = async (
    showMessage = false
  ) => {
    if (!riderId || !authUserId) {
      throw new Error(
        'Rider session is unavailable.'
      );
    }

    const {
      error: riderError,
    } =
      await supabase
        .from('riders')
        .update({
          address:
            formData.address.trim() ||
            null,

          city:
            formData.city.trim() ||
            null,

          state:
            formData.state.trim() ||
            null,

          pin_code:
            formData.pinCode.trim() ||
            null,

          emergency_contact:
            formData.emergencyContact.trim() ||
            null,

          alternate_contact:
            formData.alternateContact.trim() ||
            null,

          aadhaar_number:
            formData.aadhaarNumber.trim() ||
            null,

          pan_number:
            formData.panNumber
              .trim()
              .toUpperCase() ||
            null,

          driving_license_number:
            formData.dlNumber.trim() ||
            null,

          account_holder_name:
            formData.accountHolderName.trim() ||
            null,

          bank_name:
            formData.bankName.trim() ||
            null,

          account_number:
            formData.accountNumber.trim() ||
            null,

          ifsc_code:
            formData.ifscCode
              .trim()
              .toUpperCase() ||
            null,

          upi_id:
            formData.upiId.trim() ||
            null,

          kyc_status:
            'pending',

          documents_updated_at:
            new Date().toISOString(),

          kyc_draft: {
            formData,
            documents,
          },

          kyc_current_step:
            currentStep,
        })
        .eq(
          'auth_user_id',
          authUserId
        );

    if (riderError) {
      throw riderError;
    }

    const {
      error: profileError,
    } =
      await supabase
        .from('rider_profiles')
        .update({
          address:
            formData.address.trim() ||
            null,

          city:
            formData.city.trim() ||
            null,

          state:
            formData.state.trim() ||
            null,

          pin_code:
            formData.pinCode.trim() ||
            null,

          emergency_contact:
            formData.emergencyContact.trim() ||
            null,

          driving_license:
            formData.dlNumber.trim() ||
            null,

          aadhaar_number:
            formData.aadhaarNumber.trim() ||
            null,

          pan_number:
            formData.panNumber
              .trim()
              .toUpperCase() ||
            null,

          account_holder_name:
            formData.accountHolderName.trim() ||
            null,

          bank_name:
            formData.bankName.trim() ||
            null,

          account_number:
            formData.accountNumber.trim() ||
            null,

          ifsc_code:
            formData.ifscCode
              .trim()
              .toUpperCase() ||
            null,

          upi_id:
            formData.upiId.trim() ||
            null,

          kyc_status:
            'pending',

          documents_updated_at:
            new Date().toISOString(),
        })
        .eq(
          'rider_id',
          riderId
        );

    if (profileError) {
      throw profileError;
    }

    setInitialFormData(
      formData
    );

    if (showMessage) {
      Alert.alert(
        'Progress Saved',
        'Your KYC information has been saved. You can continue later.'
      );
    }
  };

  // ---------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------

  const validateStep =
    (step: number) => {
      const nextErrors: FormErrors =
        {};

      if (step === 1) {
        if (
          !formData.address.trim()
        ) {
          nextErrors.address =
            'Address is required';
        }

        if (
          !formData.city.trim()
        ) {
          nextErrors.city =
            'City is required';
        }

        if (
          !formData.state.trim()
        ) {
          nextErrors.state =
            'State is required';
        }

        if (
          formData.pinCode.trim() &&
          !/^\d{6}$/.test(
            formData.pinCode.trim()
          )
        ) {
          nextErrors.pinCode =
            'PIN Code must be 6 digits';
        }

        if (
          formData.emergencyContact.trim() &&
          !/^\d{10}$/.test(
            formData.emergencyContact.trim()
          )
        ) {
          nextErrors.emergencyContact =
            'Enter a valid 10-digit number';
        }

        if (
          formData.alternateContact.trim() &&
          !/^\d{10}$/.test(
            formData.alternateContact.trim()
          )
        ) {
          nextErrors.alternateContact =
            'Enter a valid 10-digit number';
        }
      }

      if (step === 2) {
        if (
          !formData.vehicleType.trim()
        ) {
          nextErrors.vehicleType =
            'Vehicle type is required';
        }

        if (
          !formData.vehicleNumber.trim()
        ) {
          nextErrors.vehicleNumber =
            'Vehicle number is required';
        }
      }

      /*
       * Bank information is optional while completing KYC.
       * If the rider starts filling it, validate the entered
       * fields.
       */
      if (step === 3) {
        const hasBankData =
          formData.accountHolderName.trim() ||
          formData.bankName.trim() ||
          formData.accountNumber.trim() ||
          formData.ifscCode.trim() ||
          formData.upiId.trim();

        if (hasBankData) {
          if (
            !formData.accountHolderName.trim()
          ) {
            nextErrors.accountHolderName =
              'Account holder name is required';
          }

          if (
            !formData.bankName.trim()
          ) {
            nextErrors.bankName =
              'Bank name is required';
          }

          if (
            !formData.accountNumber.trim()
          ) {
            nextErrors.accountNumber =
              'Account number is required';
          }

          if (
            formData.ifscCode.trim() &&
            !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
              formData.ifscCode
                .trim()
                .toUpperCase()
            )
          ) {
            nextErrors.ifscCode =
              'Invalid IFSC format';
          }

          if (
            formData.upiId.trim() &&
            !formData.upiId.includes('@')
          ) {
            nextErrors.upiId =
              'Invalid UPI ID';
          }
        }
      }

      /*
       * KYC identity fields are optional while saving progress.
       * Validate only fields the rider actually entered.
       */
      if (step === 4) {
        if (
          formData.aadhaarNumber.trim() &&
          !/^\d{12}$/.test(
            formData.aadhaarNumber.trim()
          )
        ) {
          nextErrors.aadhaarNumber =
            'Aadhaar must be 12 digits';
        }

        if (
          formData.panNumber.trim() &&
          !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(
            formData.panNumber
              .trim()
              .toUpperCase()
          )
        ) {
          nextErrors.panNumber =
            'Invalid PAN format';
        }

        if (
          formData.dlNumber.trim() &&
          formData.dlNumber.trim().length <
            10
        ) {
          nextErrors.dlNumber =
            'Driving Licence number is too short';
        }
      }

      setErrors(
        nextErrors
      );

      return (
        Object.keys(
          nextErrors
        ).length === 0
      );
    };

  // ---------------------------------------------------------
  // NEXT
  // ---------------------------------------------------------

  const handleNext =
    async () => {
      if (
        !validateStep(
          currentStep
        )
      ) {
        return;
      }

      try {
        await saveKycData(false);

        if (
          currentStep <
          TOTAL_STEPS
        ) {
          const nextStep =
            currentStep + 1;

          setCurrentStep(
            nextStep
          );

          progress.value =
            withTiming(
              nextStep /
                TOTAL_STEPS,
              {
                duration: 350,
              }
            );

          scrollRef.current?.scrollTo(
            {
              y: 0,
              animated: true,
            }
          );
        }
      } catch (error: any) {
        Alert.alert(
          'Save Failed',
          error?.message ||
            'Unable to save your KYC progress.'
        );
      }
    };

  // ---------------------------------------------------------
  // PREVIOUS
  // ---------------------------------------------------------

  const handlePrev =
    () => {
      if (
        currentStep <= 1
      ) {
        return;
      }

      const previousStep =
        currentStep - 1;

      setCurrentStep(
        previousStep
      );

      progress.value =
        withTiming(
          previousStep /
            TOTAL_STEPS,
          {
            duration: 350,
          }
        );

      scrollRef.current?.scrollTo(
        {
          y: 0,
          animated: true,
        }
      );
    };

  // ---------------------------------------------------------
  // SAVE & EXIT
  // ---------------------------------------------------------

  const handleSaveAndExit =
    async () => {
      if (isSubmitting) {
        return;
      }

      try {
        setIsSubmitting(true);

        await saveKycData(
          false
        );

        Alert.alert(
          'Progress Saved',
          'Your KYC progress has been saved. You can continue later from your Profile.',
          [
            {
              text: 'Continue',
              onPress: () =>
                router.replace(
                  '/(tabs)/profile'
                ),
            },
          ]
        );
      } catch (error: any) {
        Alert.alert(
          'Save Failed',
          error?.message ||
            'Unable to save your KYC progress.'
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  // ---------------------------------------------------------
  // FINAL SUBMIT
  // ---------------------------------------------------------

  const handleSubmit =
    async () => {
      if (
        isSubmitting ||
        !riderId ||
        !authUserId
      ) {
        return;
      }

      /*
       * Validate only the entered information.
       *
       * KYC can be incomplete because the rider was allowed
       * to skip it during registration.
       */
      for (
        let step = 1;
        step <= 4;
        step++
      ) {
        if (
          !validateStep(step)
        ) {
          setCurrentStep(
            step
          );

          progress.value =
            withTiming(
              step /
                TOTAL_STEPS,
              {
                duration: 350,
              }
            );

          return;
        }
      }

      try {
        setIsSubmitting(true);

        await saveKycData(
          false
        );

        /*
         * KYC remains pending until Admin verifies it.
         */
        const {
          error: statusError,
        } =
          await supabase
            .from('riders')
            .update({
              kyc_status:
                'pending',

              kyc_draft: null,

              kyc_current_step:
                1,

              documents_updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              riderId
            );

        if (statusError) {
          throw statusError;
        }

        const {
          error:
            profileStatusError,
        } =
          await supabase
            .from('rider_profiles')
            .update({
              kyc_status:
                'pending',

              documents_updated_at:
                new Date().toISOString(),
            })
            .eq(
              'rider_id',
              riderId
            );

        if (
          profileStatusError
        ) {
          throw profileStatusError;
        }

        setInitialFormData(
          formData
        );

        setInitialDocuments(
          documents
        );

        setIsSuccessState(
          true
        );
      } catch (error: any) {
        console.error(
          'KYC submission error:',
          error
        );

        Alert.alert(
          'KYC Submission Failed',
          error?.message ||
            'Unable to submit your KYC information.'
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  // ---------------------------------------------------------
  // DOCUMENT HELPERS
  // ---------------------------------------------------------

  const isUploading =
    (
      type: UploadType
    ) =>
      uploadingType ===
      type;

  const getDocumentCompleted =
    (
      type: UploadType
    ) => {
      switch (type) {
        case 'profile-photo':
          return Boolean(
            documents.profilePhotoUrl
          );

        case 'aadhaar-front':
          return Boolean(
            documents.aadhaarFrontUrl
          );

        case 'aadhaar-back':
          return Boolean(
            documents.aadhaarBackUrl
          );

        case 'pan-card':
          return Boolean(
            documents.panCardUrl
          );

        case 'driving-license':
          return Boolean(
            documents.drivingLicenseUrl
          );

        case 'selfie':
          return Boolean(
            documents.selfieUrl
          );

        case 'vehicle-rc':
          return Boolean(
            documents.vehicleRcUrl
          );
      }
    };

  const getKycProgress =
    () => {
      const requirements = [
        Boolean(
          formData.aadhaarNumber.trim()
        ),
        Boolean(
          documents.aadhaarFrontUrl
        ),
        Boolean(
          documents.aadhaarBackUrl
        ),
        Boolean(
          formData.panNumber.trim()
        ),
        Boolean(
          documents.panCardUrl
        ),
        Boolean(
          formData.dlNumber.trim()
        ),
        Boolean(
          documents.drivingLicenseUrl
        ),
        Boolean(
          documents.selfieUrl
        ),
      ];

      const completed =
        requirements.filter(
          Boolean
        ).length;

      return {
        completed,
        total:
          requirements.length,
        percentage: Math.round(
          (completed /
            requirements.length) *
            100
        ),
      };
    };

  // ---------------------------------------------------------
  // ANIMATED PROGRESS
  // ---------------------------------------------------------

  const animatedProgressStyle =
    useAnimatedStyle(
      () => ({
        width: `${progress.value * 100}%`,
      })
    );

  const kycProgress =
    getKycProgress();

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------

  if (isLoadingProfile) {
    return (
      <View
        style={
          styles.loaderCenterWrapper
        }
      >
        <ActivityIndicator
          size="large"
          color="#10B981"
        />

        <Text
          style={
            styles.loaderSyncText
          }
        >
          Loading your KYC profile...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------
  // SUCCESS
  // ---------------------------------------------------------

  if (isSuccessState) {
    return (
      <SafeAreaView
        style={
          styles.successWrapper
        }
      >
        <Animated.View
          entering={FadeIn.duration(
            400
          )}
          style={
            styles.successInnerCard
          }
        >
          <Text
            style={
              styles.successEmoji
            }
          >
            🎉
          </Text>

          <Text
            style={
              styles.successTitle
            }
          >
            KYC Submitted
          </Text>

          <Text
            style={
              styles.successDescription
            }
          >
            Your KYC information has been
            saved successfully. Rivo
            administrators will review your
            submitted information and
            documents.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.successActionBtn,
              pressed && {
                transform: [
                  {
                    scale: 0.97,
                  },
                ],
              },
            ]}
            onPress={() =>
              router.replace(
                '/(tabs)/profile'
              )
            }
          >
            <Text
              style={
                styles.successActionBtnText
              }
            >
              Back to Profile
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        'top',
        'left',
        'right',
      ]}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : 'height'
        }
        style={
          styles.keyboardContainer
        }
      >
        {/* HEADER */}

        <View
          style={
            styles.headerContainer
          }
        >
          <Text
            style={
              styles.titleText
            }
          >
            Complete Your KYC
          </Text>

          <Text
            style={
              styles.subtitleText
            }
          >
            Add your verification details
            and documents. You can save
            your progress and continue later.
          </Text>

          {showRestoredBanner && (
            <Animated.View
              entering={FadeIn.duration(
                300
              )}
              style={
                styles.restoredDraftBannerRow
              }
            >
              <Ionicons
                name="refresh-circle"
                size={16}
                color="#047857"
              />

              <View
                style={{
                  marginLeft: 6,
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.restoredDraftBannerTitle
                  }
                >
                  KYC progress restored
                </Text>

                <Text
                  style={
                    styles.restoredDraftBannerText
                  }
                >
                  Your previously saved
                  information is available.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowRestoredBanner(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={16}
                  color="#047857"
                />
              </TouchableOpacity>
            </Animated.View>
          )}

          <View
            style={
              styles.kycSummaryCard
            }
          >
            <View
              style={
                styles.kycSummaryHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.kycSummaryTitle
                  }
                >
                  KYC Progress
                </Text>

                <Text
                  style={
                    styles.kycSummarySubtitle
                  }
                >
                  {kycProgress.completed}{' '}
                  of{' '}
                  {kycProgress.total}{' '}
                  requirements completed
                </Text>
              </View>

              <Text
                style={
                  styles.kycSummaryPercentage
                }
              >
                {kycProgress.percentage}%
              </Text>
            </View>

            <View
              style={
                styles.kycSummaryBarBackground
              }
            >
              <View
                style={[
                  styles.kycSummaryBarFill,
                  {
                    width: `${kycProgress.percentage}%`,
                  },
                ]}
              />
            </View>
          </View>

          <View
            style={
              styles.securityBadgeRow
            }
          >
            <Ionicons
              name="shield-checkmark"
              size={13}
              color="#059669"
            />

            <Text
              style={
                styles.securityBadgeText
              }
            >
              Your documents are securely
              stored and accessible only to
              authorized Rivo administrators.
            </Text>
          </View>
        </View>

        {/* STEP PROGRESS */}

        <View
          style={
            styles.progressContainer
          }
        >
          <View
            style={
              styles.progressLabelRow
            }
          >
            <Text
              style={
                styles.progressStepLabel
              }
            >
              Step {currentStep} of{' '}
              {TOTAL_STEPS}
            </Text>

            <Text
              style={
                styles.progressPercentageLabel
              }
            >
              {Math.round(
                (currentStep /
                  TOTAL_STEPS) *
                  100
              )}
              %
            </Text>
          </View>

          <View
            style={
              styles.progressBarBackground
            }
          >
            <Animated.View
              style={[
                styles.progressBarFill,
                animatedProgressStyle,
              ]}
            />
          </View>
        </View>

        {/* CONTENT */}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            layout={Layout.duration(
              200
            )}
          >
            {/* STEP 1 */}

            {currentStep === 1 && (
              <Animated.View
                entering={FadeInLeft.duration(
                  300
                )}
                exiting={FadeOutRight.duration(
                  300
                )}
                style={
                  styles.stepCard
                }
              >
                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  Personal Details
                </Text>

                <Text
                  style={
                    styles.helperTextBanner
                  }
                >
                  Keep your address and
                  emergency contact information
                  up to date.
                </Text>

                <RenderInput
                  label="Address"
                  value={
                    formData.address
                  }
                  onChangeText={(value) =>
                    updateField(
                      'address',
                      value
                    )
                  }
                  error={
                    errors.address
                  }
                  placeholder="House, Street, Locality"
                />

                <RenderInput
                  label="City"
                  value={
                    formData.city
                  }
                  onChangeText={(value) =>
                    updateField(
                      'city',
                      value
                    )
                  }
                  error={
                    errors.city
                  }
                  placeholder="City"
                />

                <RenderInput
                  label="State"
                  value={
                    formData.state
                  }
                  onChangeText={(value) =>
                    updateField(
                      'state',
                      value
                    )
                  }
                  error={
                    errors.state
                  }
                  placeholder="State"
                />

                <RenderInput
                  label="PIN Code"
                  value={
                    formData.pinCode
                  }
                  onChangeText={(value) =>
                    updateField(
                      'pinCode',
                      value
                    )
                  }
                  error={
                    errors.pinCode
                  }
                  placeholder="6-digit PIN"
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <RenderInput
                  label="Emergency Contact"
                  value={
                    formData.emergencyContact
                  }
                  onChangeText={(value) =>
                    updateField(
                      'emergencyContact',
                      value
                    )
                  }
                  error={
                    errors.emergencyContact
                  }
                  placeholder="10-digit mobile number"
                  keyboardType="number-pad"
                  maxLength={10}
                />

                <RenderInput
                  label="Alternate Contact"
                  value={
                    formData.alternateContact
                  }
                  onChangeText={(value) =>
                    updateField(
                      'alternateContact',
                      value
                    )
                  }
                  error={
                    errors.alternateContact
                  }
                  placeholder="Optional"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </Animated.View>
            )}

            {/* STEP 2 */}

            {currentStep === 2 && (
              <Animated.View
                entering={FadeInLeft.duration(
                  300
                )}
                exiting={FadeOutRight.duration(
                  300
                )}
                style={
                  styles.stepCard
                }
              >
                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  Contact & Vehicle
                </Text>

                <RenderInput
                  label="Vehicle Type"
                  value={
                    formData.vehicleType
                  }
                  onChangeText={(value) =>
                    updateField(
                      'vehicleType',
                      value
                    )
                  }
                  error={
                    errors.vehicleType
                  }
                  placeholder="e.g. Motorcycle"
                  isRegisteredLabel
                />

                <RenderInput
                  label="Vehicle Number"
                  value={
                    formData.vehicleNumber
                  }
                  onChangeText={(value) =>
                    updateField(
                      'vehicleNumber',
                      value
                    )
                  }
                  error={
                    errors.vehicleNumber
                  }
                  placeholder="e.g. MH12AB1234"
                  autoCapitalize="characters"
                  isRegisteredLabel
                />
              </Animated.View>
            )}

            {/* STEP 3 */}

            {currentStep === 3 && (
              <Animated.View
                entering={FadeInLeft.duration(
                  300
                )}
                exiting={FadeOutRight.duration(
                  300
                )}
                style={
                  styles.stepCard
                }
              >
                <View
                  style={
                    styles.bankHeaderRow
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.sectionHeading
                      }
                    >
                      Bank Details
                    </Text>

                    <Text
                      style={
                        styles.optionalText
                      }
                    >
                      Optional — add when ready
                    </Text>
                  </View>

                  {!isBankEditing &&
                    formData.accountNumber && (
                      <TouchableOpacity
                        style={
                          styles.bankEditInlineBtn
                        }
                        onPress={() =>
                          setIsBankEditing(
                            true
                          )
                        }
                      >
                        <Ionicons
                          name="create-outline"
                          size={14}
                          color="#10B981"
                        />

                        <Text
                          style={
                            styles.bankEditInlineBtnText
                          }
                        >
                          Edit
                        </Text>
                      </TouchableOpacity>
                    )}
                </View>

                {!isBankEditing &&
                formData.accountNumber ? (
                  <View
                    style={
                      styles.existingBankCard
                    }
                  >
                    <View
                      style={
                        styles.existingBankHeader
                      }
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#10B981"
                      />

                      <Text
                        style={
                          styles.existingBankCardTitle
                        }
                      >
                        Bank details saved
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.existingBankTextSub
                      }
                    >
                      {formData.bankName ||
                        'Bank'}{' '}
                      ••••{' '}
                      {formData.accountNumber.slice(
                        -4
                      )}
                    </Text>

                    <Text
                      style={
                        styles.existingBankTextSub
                      }
                    >
                      {formData.accountHolderName ||
                        'Account Holder'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <RenderInput
                      label="Account Holder"
                      value={
                        formData.accountHolderName
                      }
                      onChangeText={(value) =>
                        updateField(
                          'accountHolderName',
                          value
                        )
                      }
                      error={
                        errors.accountHolderName
                      }
                      placeholder="Name as per bank account"
                    />

                    <RenderInput
                      label="Bank Name"
                      value={
                        formData.bankName
                      }
                      onChangeText={(value) =>
                        updateField(
                          'bankName',
                          value
                        )
                      }
                      error={
                        errors.bankName
                      }
                      placeholder="Bank name"
                    />

                    <RenderInput
                      label="Account Number"
                      value={
                        formData.accountNumber
                      }
                      onChangeText={(value) =>
                        updateField(
                          'accountNumber',
                          value
                        )
                      }
                      error={
                        errors.accountNumber
                      }
                      placeholder="Account number"
                      keyboardType="number-pad"
                      secureTextEntry
                    />

                    <RenderInput
                      label="IFSC"
                      value={
                        formData.ifscCode
                      }
                      onChangeText={(value) =>
                        updateField(
                          'ifscCode',
                          value
                            .toUpperCase()
                        )
                      }
                      error={
                        errors.ifscCode
                      }
                      placeholder="e.g. SBIN0001234"
                      autoCapitalize="characters"
                    />

                    <RenderInput
                      label="UPI ID"
                      value={
                        formData.upiId
                      }
                      onChangeText={(value) =>
                        updateField(
                          'upiId',
                          value
                        )
                      }
                      error={
                        errors.upiId
                      }
                      placeholder="name@bank"
                      autoCapitalize="none"
                    />

                    <TouchableOpacity
                      style={
                        styles.lockBankBtn
                      }
                      onPress={() => {
                        if (
                          validateStep(
                            3
                          )
                        ) {
                          setIsBankEditing(
                            false
                          );
                        }
                      }}
                    >
                      <Text
                        style={
                          styles.lockBankBtnText
                        }
                      >
                        Save Bank Details
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            )}

            {/* STEP 4 */}

            {currentStep === 4 && (
              <Animated.View
                entering={FadeInLeft.duration(
                  300
                )}
                exiting={FadeOutRight.duration(
                  300
                )}
                style={
                  styles.stepCard
                }
              >
                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  Identity Verification
                </Text>

                <Text
                  style={
                    styles.helperTextBanner
                  }
                >
                  Upload the documents you have
                  available. You can save your
                  progress and add missing
                  documents later.
                </Text>

                {/* PROFILE PHOTO */}

                <DocumentCard
                  title="Profile Photo"
                  subtitle="Clear photo of your face"
                  url={
                    documents.profilePhotoUrl
                  }
                  uploading={isUploading(
                    'profile-photo'
                  )}
                  completed={getDocumentCompleted(
                    'profile-photo'
                  )}
                  onPress={() =>
                    pickDocument(
                      'profile-photo'
                    )
                  }
                />

                {/* SELFIE */}

                <DocumentCard
                  title="KYC Selfie"
                  subtitle="Take a clear selfie using your front camera"
                  url={
                    documents.selfieUrl
                  }
                  uploading={isUploading(
                    'selfie'
                  )}
                  completed={getDocumentCompleted(
                    'selfie'
                  )}
                  onPress={
                    captureSelfie
                  }
                />

                {/* AADHAAR */}

                <View
                  style={
                    styles.documentSection
                  }
                >
                  <Text
                    style={
                      styles.documentSectionTitle
                    }
                  >
                    Aadhaar
                  </Text>

                  <RenderInput
                    label="Aadhaar Number"
                    value={
                      formData.aadhaarNumber
                    }
                    onChangeText={(value) =>
                      updateField(
                        'aadhaarNumber',
                        value
                      )
                    }
                    error={
                      errors.aadhaarNumber
                    }
                    placeholder="12-digit Aadhaar number"
                    keyboardType="number-pad"
                    maxLength={12}
                    secureTextEntry
                  />

                  <DocumentCard
                    title="Aadhaar Front"
                    subtitle="Front side of Aadhaar"
                    url={
                      documents.aadhaarFrontUrl
                    }
                    uploading={isUploading(
                      'aadhaar-front'
                    )}
                    completed={getDocumentCompleted(
                      'aadhaar-front'
                    )}
                    onPress={() =>
                      pickDocument(
                        'aadhaar-front'
                      )
                    }
                  />

                  <DocumentCard
                    title="Aadhaar Back"
                    subtitle="Back side of Aadhaar"
                    url={
                      documents.aadhaarBackUrl
                    }
                    uploading={isUploading(
                      'aadhaar-back'
                    )}
                    completed={getDocumentCompleted(
                      'aadhaar-back'
                    )}
                    onPress={() =>
                      pickDocument(
                        'aadhaar-back'
                      )
                    }
                  />
                </View>

                {/* PAN */}

                <View
                  style={
                    styles.documentSection
                  }
                >
                  <Text
                    style={
                      styles.documentSectionTitle
                    }
                  >
                    PAN Card
                  </Text>

                  <RenderInput
                    label="PAN Number"
                    value={
                      formData.panNumber
                    }
                    onChangeText={(value) =>
                      updateField(
                        'panNumber',
                        value
                          .toUpperCase()
                      )
                    }
                    error={
                      errors.panNumber
                    }
                    placeholder="ABCDE1234F"
                    autoCapitalize="characters"
                    maxLength={10}
                  />

                  <DocumentCard
                    title="PAN Card Document"
                    subtitle="Clear image of your PAN card"
                    url={
                      documents.panCardUrl
                    }
                    uploading={isUploading(
                      'pan-card'
                    )}
                    completed={getDocumentCompleted(
                      'pan-card'
                    )}
                    onPress={() =>
                      pickDocument(
                        'pan-card'
                      )
                    }
                  />
                </View>

                {/* DRIVING LICENCE */}

                <View
                  style={
                    styles.documentSection
                  }
                >
                  <Text
                    style={
                      styles.documentSectionTitle
                    }
                  >
                    Driving Licence
                  </Text>

                  <RenderInput
                    label="Driving Licence Number"
                    value={
                      formData.dlNumber
                    }
                    onChangeText={(value) =>
                      updateField(
                        'dlNumber',
                        value
                          .toUpperCase()
                      )
                    }
                    error={
                      errors.dlNumber
                    }
                    placeholder="Driving licence number"
                    autoCapitalize="characters"
                  />

                  <DocumentCard
                    title="Driving Licence"
                    subtitle="Clear image of your driving licence"
                    url={
                      documents.drivingLicenseUrl
                    }
                    uploading={isUploading(
                      'driving-license'
                    )}
                    completed={getDocumentCompleted(
                      'driving-license'
                    )}
                    onPress={() =>
                      pickDocument(
                        'driving-license'
                      )
                    }
                  />
                </View>

                {/* VEHICLE RC */}

                <View
                  style={
                    styles.documentSection
                  }
                >
                  <Text
                    style={
                      styles.documentSectionTitle
                    }
                  >
                    Vehicle RC
                  </Text>

                  <DocumentCard
                    title="Vehicle RC"
                    subtitle="Optional vehicle registration document"
                    url={
                      documents.vehicleRcUrl
                    }
                    uploading={isUploading(
                      'vehicle-rc'
                    )}
                    completed={getDocumentCompleted(
                      'vehicle-rc'
                    )}
                    onPress={() =>
                      pickDocument(
                        'vehicle-rc'
                      )
                    }
                  />
                </View>
              </Animated.View>
            )}

            {/* STEP 5 */}

            {currentStep === 5 && (
              <Animated.View
                entering={FadeInLeft.duration(
                  300
                )}
                exiting={FadeOutRight.duration(
                  300
                )}
                style={
                  styles.stepCard
                }
              >
                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  Review KYC
                </Text>

                <View
                  style={
                    styles.finalProgressCard
                  }
                >
                  <Text
                    style={
                      styles.finalProgressTitle
                    }
                  >
                    KYC completion
                  </Text>

                  <Text
                    style={
                      styles.finalProgressPercentage
                    }
                  >
                    {kycProgress.percentage}%
                  </Text>

                  <View
                    style={
                      styles.kycSummaryBarBackground
                    }
                  >
                    <View
                      style={[
                        styles.kycSummaryBarFill,
                        {
                          width: `${kycProgress.percentage}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={
                      styles.finalProgressText
                    }
                  >
                    {kycProgress.completed}{' '}
                    of{' '}
                    {kycProgress.total}{' '}
                    KYC requirements completed.
                  </Text>
                </View>

                <Text
                  style={
                    styles.reviewBlockHeadingText
                  }
                >
                  Personal Details
                </Text>

                <View
                  style={
                    styles.reviewWrapperBox
                  }
                >
                  <ReviewLineItem
                    label="Address"
                    value={
                      formData.address
                    }
                  />

                  <ReviewLineItem
                    label="City"
                    value={
                      formData.city
                    }
                  />

                  <ReviewLineItem
                    label="State"
                    value={
                      formData.state
                    }
                  />

                  <ReviewLineItem
                    label="PIN"
                    value={
                      formData.pinCode
                    }
                  />
                </View>

                <Text
                  style={
                    styles.reviewBlockHeadingText
                  }
                >
                  Identity
                </Text>

                <View
                  style={
                    styles.reviewWrapperBox
                  }
                >
                  <StatusReviewLine
                    label="Aadhaar Number"
                    completed={
                      Boolean(
                        formData.aadhaarNumber
                      )
                    }
                  />

                  <StatusReviewLine
                    label="Aadhaar Front"
                    completed={
                      Boolean(
                        documents.aadhaarFrontUrl
                      )
                    }
                  />

                  <StatusReviewLine
                    label="Aadhaar Back"
                    completed={
                      Boolean(
                        documents.aadhaarBackUrl
                      )
                    }
                  />

                  <StatusReviewLine
                    label="PAN Number"
                    completed={
                      Boolean(
                        formData.panNumber
                      )
                    }
                  />

                  <StatusReviewLine
                    label="PAN Document"
                    completed={
                      Boolean(
                        documents.panCardUrl
                      )
                    }
                  />

                  <StatusReviewLine
                    label="Driving Licence Number"
                    completed={
                      Boolean(
                        formData.dlNumber
                      )
                    }
                  />

                  <StatusReviewLine
                    label="Driving Licence Document"
                    completed={
                      Boolean(
                        documents.drivingLicenseUrl
                      )
                    }
                  />

                  <StatusReviewLine
                    label="KYC Selfie"
                    completed={
                      Boolean(
                        documents.selfieUrl
                      )
                    }
                  />
                </View>

                <Text
                  style={
                    styles.reviewBlockHeadingText
                  }
                >
                  Bank Details
                </Text>

                <View
                  style={
                    styles.reviewWrapperBox
                  }
                >
                  <ReviewLineItem
                    label="Account Holder"
                    value={
                      formData.accountHolderName
                    }
                  />

                  <ReviewLineItem
                    label="Bank"
                    value={
                      formData.bankName
                    }
                  />

                  <ReviewLineItem
                    label="Account"
                    value={
                      formData.accountNumber
                        ? `••••${formData.accountNumber.slice(
                            -4
                          )}`
                        : ''
                    }
                  />

                  <ReviewLineItem
                    label="IFSC"
                    value={
                      formData.ifscCode
                    }
                  />
                </View>

                {kycProgress.percentage <
                  100 && (
                  <View
                    style={
                      styles.incompleteWarning
                    }
                  >
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#D97706"
                    />

                    <Text
                      style={
                        styles.incompleteWarningText
                      }
                    >
                      Some KYC information is
                      still missing. You can
                      submit the information you
                      have now and continue
                      completing the missing
                      items later from your
                      Profile.
                    </Text>
                  </View>
                )}
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>

        {/* FOOTER */}

        <View
          style={[
            styles.actionNavigationFooter,
            {
              paddingBottom:
                Math.max(
                  insets.bottom,
                  16
                ),
            },
          ]}
        >
          <TouchableOpacity
            style={
              styles.saveExitButton
            }
            onPress={
              handleSaveAndExit
            }
            disabled={
              isSubmitting ||
              Boolean(uploadingType)
            }
          >
            <Ionicons
              name="save-outline"
              size={16}
              color="#374151"
            />

            <Text
              style={
                styles.saveExitButtonText
              }
            >
              Save & Exit
            </Text>
          </TouchableOpacity>

          <View
            style={
              styles.actionButtonsHorizontalLayoutRow
            }
          >
            {currentStep > 1 ? (
              <TouchableOpacity
                style={
                  styles.previousButtonAction
                }
                onPress={
                  handlePrev
                }
                disabled={
                  isSubmitting ||
                  Boolean(uploadingType)
                }
              >
                <Text
                  style={
                    styles.previousButtonText
                  }
                >
                  Previous
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  flex: 1,
                }}
              />
            )}

            {currentStep <
            TOTAL_STEPS ? (
              <TouchableOpacity
                style={
                  styles.nextPrimaryButtonAction
                }
                onPress={
                  handleNext
                }
                disabled={
                  isSubmitting ||
                  Boolean(uploadingType)
                }
                activeOpacity={0.8}
              >
                <Text
                  style={
                    styles.nextButtonText
                  }
                >
                  Save & Next
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color="#FFFFFF"
                  style={{
                    marginLeft: 6,
                  }}
                />
              </TouchableOpacity>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.submitKycButtonAction,
                  pressed && {
                    transform: [
                      {
                        scale: 0.98,
                      },
                    ],
                  },
                  isSubmitting && {
                    backgroundColor:
                      '#A7F3D0',
                  },
                ]}
                onPress={
                  handleSubmit
                }
                disabled={
                  isSubmitting ||
                  Boolean(uploadingType)
                }
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#065F46"
                      style={{
                        marginRight: 8,
                      }}
                    />

                    <Text
                      style={[
                        styles.nextButtonText,
                        {
                          color:
                            '#065F46',
                        },
                      ]}
                    >
                      Saving...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={
                        styles.nextButtonText
                      }
                    >
                      Submit for Verification
                    </Text>

                    <Ionicons
                      name="shield-checkmark"
                      size={16}
                      color="#FFFFFF"
                      style={{
                        marginLeft: 6,
                      }}
                    />
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

// =========================================================
// DOCUMENT CARD
// =========================================================

function DocumentCard({
  title,
  subtitle,
  url,
  uploading,
  completed,
  onPress,
}: {
  title: string;
  subtitle: string;
  url: string;
  uploading: boolean;
  completed: boolean;
  onPress: () => void;
}) {
  return (
    <View
      style={
        styles.documentCard
      }
    >
      <View
        style={
          styles.documentCardHeader
        }
      >
        <View
          style={{
            flex: 1,
          }}
        >
          <View
            style={
              styles.documentTitleRow
            }
          >
            <Text
              style={
                styles.documentCardTitle
              }
            >
              {title}
            </Text>

            {completed && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#10B981"
                style={{
                  marginLeft: 6,
                }}
              />
            )}
          </View>

          <Text
            style={
              styles.documentCardSubtitle
            }
          >
            {subtitle}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.uploadDocumentButton,
            completed &&
              styles.uploadDocumentButtonCompleted,
          ]}
          onPress={onPress}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <>
              <Ionicons
                name={
                  completed
                    ? 'refresh-outline'
                    : 'cloud-upload-outline'
                }
                size={16}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.uploadDocumentButtonText
                }
              >
                {completed
                  ? 'Replace'
                  : 'Upload'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {completed &&
        url && (
          <View
            style={
              styles.documentPreviewContainer
            }
          >
            <Image
              source={{
                uri: url,
              }}
              style={
                styles.documentPreview
              }
              resizeMode="cover"
            />

            <View
              style={
                styles.documentUploadedBadge
              }
            >
              <Ionicons
                name="checkmark"
                size={12}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.documentUploadedBadgeText
                }
              >
                Uploaded
              </Text>
            </View>
          </View>
        )}
    </View>
  );
}

// =========================================================
// INPUT
// =========================================================

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
  onChangeText?: (
    text: string
  ) => void;
  error?: string;
  placeholder: string;
  keyboardType?:
    | 'default'
    | 'number-pad'
    | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?:
    | 'none'
    | 'sentences'
    | 'words'
    | 'characters';
  maxLength?: number;
  isRegisteredLabel?: boolean;
}) {
  return (
    <View
      style={
        styles.inputOuterContainer
      }
    >
      <Text
        style={
          styles.fieldLabelText
        }
      >
        {label}
      </Text>

      <TextInput
        style={[
          styles.inputElement,
          error &&
            styles.inputElementError,
          isRegisteredLabel &&
            styles.inputDisabledStyle,
        ]}
        value={value}
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#9CA3AF"
        keyboardType={
          keyboardType
        }
        secureTextEntry={
          secureTextEntry
        }
        autoCapitalize={
          autoCapitalize
        }
        maxLength={
          maxLength
        }
        editable={
          !isRegisteredLabel
        }
      />

      {isRegisteredLabel && (
        <Text
          style={
            styles.alreadyRegisteredSubtext
          }
        >
          Already registered
        </Text>
      )}

      {error && (
        <Text
          style={
            styles.inlineErrorText
          }
        >
          {error}
        </Text>
      )}
    </View>
  );
}

// =========================================================
// REVIEW COMPONENTS
// =========================================================

function ReviewLineItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.reviewLineWrapperRow
      }
    >
      <Text
        style={
          styles.reviewLabelLeft
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.reviewValueRight
        }
        numberOfLines={2}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

function StatusReviewLine({
  label,
  completed,
}: {
  label: string;
  completed: boolean;
}) {
  return (
    <View
      style={
        styles.reviewLineWrapperRow
      }
    >
      <Text
        style={
          styles.reviewLabelLeft
        }
      >
        {label}
      </Text>

      <View
        style={
          styles.statusReviewRight
        }
      >
        <Ionicons
          name={
            completed
              ? 'checkmark-circle'
              : 'close-circle'
          }
          size={16}
          color={
            completed
              ? '#10B981'
              : '#F59E0B'
          }
        />

        <Text
          style={[
            styles.statusReviewText,
            {
              color:
                completed
                  ? '#059669'
                  : '#D97706',
            },
          ]}
        >
          {completed
            ? 'Complete'
            : 'Missing'}
        </Text>
      </View>
    </View>
  );
}

// =========================================================
// FILE HELPERS
// =========================================================

function getFileExtension(
  uri: string
) {
  const cleanUri =
    uri.split('?')[0];

  const extension =
    cleanUri
      .split('.')
      .pop()
      ?.toLowerCase();

  if (
    extension === 'png' ||
    extension === 'webp' ||
    extension === 'jpeg' ||
    extension === 'jpg'
  ) {
    return extension ===
      'jpeg'
      ? 'jpg'
      : extension;
  }

  return 'jpg';
}

function getMimeType(
  extension: string
) {
  switch (extension) {
    case 'png':
      return 'image/png';

    case 'webp':
      return 'image/webp';

    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function getReadableDocumentName(
  type: UploadType
) {
  switch (type) {
    case 'profile-photo':
      return 'profile photo';

    case 'aadhaar-front':
      return 'Aadhaar front';

    case 'aadhaar-back':
      return 'Aadhaar back';

    case 'pan-card':
      return 'PAN card';

    case 'driving-license':
      return 'driving licence';

    case 'selfie':
      return 'KYC selfie';

    case 'vehicle-rc':
      return 'vehicle RC';

    default:
      return 'document';
  }
}

// =========================================================
// STYLES
// =========================================================

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

  kycSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 13,
    marginTop: 10,
  },

  kycSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  kycSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  kycSummarySubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 2,
  },

  kycSummaryPercentage: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },

  kycSummaryBarBackground: {
    height: 7,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 9,
  },

  kycSummaryBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 5,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 8,
  },

  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
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
    lineHeight: 18,
  },

  optionalText: {
    fontSize: 11.5,
    color: '#9CA3AF',
    marginBottom: 8,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  bankEditInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
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

  documentSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginTop: 4,
  },

  documentSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  documentCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 13,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  documentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  documentCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111827',
  },

  documentCardSubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 16,
  },

  uploadDocumentButton: {
    minWidth: 88,
    height: 38,
    paddingHorizontal: 10,
    backgroundColor: '#10B981',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginLeft: 10,
  },

  uploadDocumentButtonCompleted: {
    backgroundColor: '#059669',
  },

  uploadDocumentButtonText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    marginLeft: 5,
  },

  documentPreviewContainer: {
    height: 150,
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },

  documentPreview: {
    width: '100%',
    height: '100%',
  },

  documentUploadedBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },

  documentUploadedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 3,
  },

  finalProgressCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },

  finalProgressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  finalProgressPercentage: {
    fontSize: 30,
    fontWeight: '900',
    color: '#059669',
    marginTop: 3,
  },

  finalProgressText: {
    fontSize: 11.5,
    color: '#166534',
    marginTop: 8,
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
    paddingVertical: 7,
  },

  reviewLabelLeft: {
    fontSize: 13,
    color: '#6B7280',
    flex: 0.55,
  },

  reviewValueRight: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 0.45,
    textAlign: 'right',
  },

  statusReviewRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusReviewText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },

  incompleteWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
  },

  incompleteWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    marginLeft: 7,
  },

  actionNavigationFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  saveExitButton: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 9,
  },

  saveExitButtonText: {
    color: '#374151',
    fontSize: 12.5,
    fontWeight: '700',
    marginLeft: 5,
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
    flex: 1.3,
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
    shadowOffset: {
      width: 0,
      height: 8,
    },
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