from pathlib import Path

path = Path('src/app/(tabs)/dashboard.tsx')
text = path.read_text(encoding='utf-8')

replacements = [
(
'''      if (shiftData && shiftData.length > 0) {
        setActiveShift(shiftData[0]);
      } else {
        setActiveShift(null);
      }

      const { data: scheduled } = await supabase''',
'''      if (shiftData && shiftData.length > 0) {
        setActiveShift(shiftData[0]);
      } else {
        setActiveShift(null);

        // A rider cannot remain online without an active shift.
        if (profileData.availability_status?.toLowerCase() === 'available') {
          try {
            const offlineProfile = await updateAvailabilityStatus('offline');
            if (offlineProfile) {
              setRider((prev: any) => ({ ...prev, ...offlineProfile }));
            }
          } catch (availabilityError) {
            console.error('Failed to reset availability without an active shift:', availabilityError);
          }
        }
      }

      const { data: scheduled } = await supabase'''),
(
'''      const isRiderOnline = profileData.availability_status?.toLowerCase() === 'available';
      const isFullyEligible = isRiderOnline && !!shiftData?.[0];''',
'''      const hasActiveShift = !!shiftData?.[0];
      const isRiderOnline = hasActiveShift && profileData.availability_status?.toLowerCase() === 'available';
      const isFullyEligible = isRiderOnline && hasActiveShift;'''),
(
'''      if (error) throw error;

      setShiftModalVisible(false);
      Alert.alert(
        isToday ? 'Shift Started!' : 'Shift Reserved!',''',
'''      if (error) throw error;

      // Starting today's shift automatically makes the rider available.
      if (isToday) {
        try {
          const updatedRider = await updateAvailabilityStatus('available');
          if (updatedRider) {
            setRider((prev: any) => ({ ...prev, ...updatedRider }));
          }
        } catch (availabilityError) {
          console.error('Failed to enable availability after starting shift:', availabilityError);
        }
      }

      setShiftModalVisible(false);
      Alert.alert(
        isToday ? 'Shift Started!' : 'Shift Reserved!','''),
(
'''    if (rider.kyc_status === 'rejected') {
      Alert.alert('KYC Required', 'Complete your KYC verification first.');
      return;
    }

    Animated.sequence([''',
'''    if (rider.kyc_status === 'rejected') {
      Alert.alert('KYC Required', 'Complete your KYC verification first.');
      return;
    }

    if (!activeShift) {
      setShiftModalVisible(true);
      return;
    }

    Animated.sequence(['''),
(
'''            {/* 2. OPERATIONAL STATUS PILL */}
            <Animated.View style={{ transform: [{ scale: onlineBtnScale }], marginBottom: 16 }}>
              <TouchableOpacity
                activeOpacity={rider?.kyc_status === 'verified' ? 0.9 : 1}
                onPress={toggleAvailability}
                style={[
                  styles.statusLargePill,
                  {
                    backgroundColor: isFullyEligible ? (isDarkMode ? '#064E3B' : '#ECFDF5') : isAvailable ? (isDarkMode ? '#451A03' : LOCAL_COLORS.amberBgLight) : theme.cardBg,
                    borderColor: isFullyEligible ? LOCAL_COLORS.emeraldGreen : isAvailable ? LOCAL_COLORS.amberBorderLight : theme.border,
                    opacity: rider?.kyc_status === 'verified' ? 1 : 0.6,
                  },
                ]}
              >
                <View style={[styles.statusIndicatorDot, { backgroundColor: isFullyEligible ? LOCAL_COLORS.emeraldGreen : isAvailable ? LOCAL_COLORS.amberBorderLight : '#9CA3AF' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusPillTitle, { color: isFullyEligible ? (isDarkMode ? '#A7F3D0' : '#065F46') : isAvailable ? (isDarkMode ? '#FDE68A' : LOCAL_COLORS.amberTextLight) : theme.text }]}>
                    {isFullyEligible ? '🟢 Online — Shift Active' : isAvailable ? '🟡 Online — No Active Shift' : '⚫ Offline'}
                  </Text>
                  <Text style={[styles.statusPillSubtitle, { color: theme.textMuted }]}>
                    {isFullyEligible ? 'Receiving Delivery Requests' : isAvailable ? 'Not Receiving Orders — Select or Reserve Shift' : 'Tap to go Online'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>''',
'''            {/* 2. SHIFT + AVAILABILITY STATUS */}
            <Animated.View style={{ transform: [{ scale: onlineBtnScale }], marginBottom: 16 }}>
              <TouchableOpacity
                activeOpacity={rider?.kyc_status === 'verified' ? 0.9 : 1}
                onPress={toggleAvailability}
                style={[
                  styles.statusLargePill,
                  {
                    backgroundColor: !hasActiveShift
                      ? theme.cardBg
                      : isAvailable
                      ? (isDarkMode ? '#064E3B' : '#ECFDF5')
                      : (isDarkMode ? '#1F2937' : '#F9FAFB'),
                    borderColor: !hasActiveShift
                      ? theme.border
                      : isAvailable
                      ? LOCAL_COLORS.emeraldGreen
                      : theme.border,
                    opacity: rider?.kyc_status === 'verified' ? 1 : 0.6,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusIndicatorDot,
                    {
                      backgroundColor: !hasActiveShift
                        ? '#9CA3AF'
                        : isAvailable
                        ? LOCAL_COLORS.emeraldGreen
                        : '#9CA3AF',
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.statusPillTitle,
                      {
                        color: !hasActiveShift
                          ? theme.text
                          : isAvailable
                          ? (isDarkMode ? '#A7F3D0' : '#065F46')
                          : theme.text,
                      },
                    ]}
                  >
                    {!hasActiveShift ? '⚪ Offline — Select a Shift' : isAvailable ? '🟢 Online — Shift Active' : '⚫ Offline — Shift Active'}
                  </Text>
                  <Text style={[styles.statusPillSubtitle, { color: theme.textMuted }]}>
                    {!hasActiveShift
                      ? 'Select a shift to start working'
                      : isAvailable
                      ? 'Receiving orders • Tap to go offline'
                      : 'You are offline • Tap to go online'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusActionBadge,
                    {
                      backgroundColor: !hasActiveShift
                        ? LOCAL_COLORS.emeraldGreen
                        : isAvailable
                        ? LOCAL_COLORS.danger
                        : LOCAL_COLORS.emeraldGreen,
                    },
                  ]}
                >
                  <Text style={styles.statusActionBadgeText}>
                    {!hasActiveShift ? 'Select Shift' : isAvailable ? 'Go Offline' : 'Go Online'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>'''),
(
'''                    onPress={() => {
                      if (rider?.kyc_status !== 'verified') {
                        Alert.alert('KYC Required', 'Complete your KYC verification first.');
                      } else if (!isAvailable) {
                        Alert.alert('Offline', 'You must be Online to select a shift. Turn your status to Online first.');
                      } else {
                        setShiftModalVisible(true);
                      }
                    }}
                    style={[styles.actionBtn, { backgroundColor: isAvailable ? LOCAL_COLORS.emeraldGreen : '#9CA3AF' }]}
                  >
                    <Text style={styles.actionBtnText}>Select / Reserve Shift</Text>''',
'''                    onPress={() => {
                      if (rider?.kyc_status !== 'verified') {
                        Alert.alert('KYC Required', 'Complete your KYC verification first.');
                      } else {
                        setShiftModalVisible(true);
                      }
                    }}
                    style={[styles.actionBtn, { backgroundColor: LOCAL_COLORS.emeraldGreen }]}
                  >
                    <Text style={styles.actionBtnText}>Select / Reserve Shift</Text>'''),
(
'''    { title: 'Operational Status', desc: 'Securely switch online or offline to manage incoming dispatches.' },''',
'''    { title: 'Shift & Availability', desc: 'Select a shift to start working, then go offline or online anytime during that shift.' },'''),
(
'''  statusPillSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },''',
'''  statusPillSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 10,
  },
  statusActionBadgeText: {
    color: LOCAL_COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },'''),
]

for index, (old, new) in enumerate(replacements, 1):
    if old not in text:
        raise SystemExit(f'Patch anchor {index} not found')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Rider availability UX patch applied successfully.')
