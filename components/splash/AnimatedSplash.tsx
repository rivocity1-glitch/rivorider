import React, { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Base sizes dynamically scaled relative to screen width
const CONTAINER_SIZE = Math.min(SCREEN_WIDTH * 0.65, 260);
const HELMET_SIZE = CONTAINER_SIZE * 0.55;

// Relative rivet coordinates on the helmet image container (percent based)
const RIVET_X_RATIO = 0.68;
const RIVET_Y_RATIO = 0.52;

// SVG Pin Path starting from the bottom tip (which aligns near the rivet)
const PIN_PATH = `M 100 180 C 100 180 30 115 30 75 C 30 36.3 61.3 5 100 5 C 138.7 5 170 36.3 170 75 C 170 115 100 180 100 180 Z`;

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  onAnimationComplete,
}) => {
  const [pathLength, setPathLength] = useState<number>(0);

  // Animation shared values
  const helmetOpacity = useSharedValue(0);
  const helmetScale = useSharedValue(0.95);
  const helmetRotation = useSharedValue(0);

  const dotOpacity = useSharedValue(0);
  const dotScale = useSharedValue(0.5);

  const pathProgress = useSharedValue(1); // 1 = fully hidden, 0 = fully drawn

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.5);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(12);

  useEffect(() => {
    // Premium Uber-like cubic bezier easings
    const easeOutCubic = Easing.bezier(0.215, 0.61, 0.355, 1.0);
    const easeInOutCubic = Easing.bezier(0.645, 0.045, 0.355, 1.0);

    // 1. Helmet enters with spring scale, subtle rotation, and smooth fade
    helmetOpacity.value = withTiming(1, { duration: 350, easing: easeOutCubic });
    helmetScale.value = withSpring(1, { damping: 14, stiffness: 100, mass: 0.8 });
    helmetRotation.value = withSequence(
      withTiming(-1.8, { duration: 200, easing: easeOutCubic }),
      withSpring(0, { damping: 12, stiffness: 90 })
    );

    // 2. Glowing dot appears at rivet location with double pulse
    dotOpacity.value = withDelay(400, withTiming(1, { duration: 200, easing: easeOutCubic }));
    dotScale.value = withDelay(
      400,
      withSequence(
        withSpring(1, { damping: 8, stiffness: 120 }),
        withTiming(1.6, { duration: 220, easing: easeOutCubic }),
        withTiming(1.0, { duration: 220, easing: easeOutCubic }),
        withTiming(1.5, { duration: 220, easing: easeOutCubic }),
        withTiming(1.0, { duration: 220, easing: easeOutCubic })
      )
    );

    // 3. Animate SVG pin starting directly from the rivet (bottom tip)
    pathProgress.value = withDelay(
      1400,
      withTiming(0, { duration: 900, easing: easeInOutCubic })
    );

    // 4. View-based glow expansion upon pin completion
    glowOpacity.value = withDelay(2250, withTiming(0.6, { duration: 500, easing: easeOutCubic }));
    glowScale.value = withDelay(2250, withTiming(1, { duration: 600, easing: easeOutCubic }));

    // 5. Title smooth fade & rise
    titleOpacity.value = withDelay(2400, withTiming(1, { duration: 450, easing: easeOutCubic }));
    titleTranslateY.value = withDelay(2400, withTiming(0, { duration: 450, easing: easeOutCubic }));

    // 6. Subtitle smooth fade & rise
    subtitleOpacity.value = withDelay(2550, withTiming(1, { duration: 450, easing: easeOutCubic }));
    subtitleTranslateY.value = withDelay(2550, withTiming(0, { duration: 450, easing: easeOutCubic }));

    // 7. Hold for 600ms after completion (~3000ms + 600ms = 3600ms total)
    const timer = setTimeout(() => {
      onAnimationComplete();
    }, 3600);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  // Animated Styles
  const helmetStyle = useAnimatedStyle(() => ({
    opacity: helmetOpacity.value,
    transform: [
      { scale: helmetScale.value },
      { rotate: `${helmetRotation.value}deg` },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * pathProgress.value,
  }));

  // Dynamically calculated positions for exact alignment on all screens
  const helmetOffsetTop = (CONTAINER_SIZE - HELMET_SIZE) / 2;
  const helmetOffsetLeft = (CONTAINER_SIZE - HELMET_SIZE) / 2;

  const rivetX = helmetOffsetLeft + HELMET_SIZE * RIVET_X_RATIO;
  const rivetY = helmetOffsetTop + HELMET_SIZE * RIVET_Y_RATIO;

  const dotSize = Math.max(8, CONTAINER_SIZE * 0.035);
  const glowSize = CONTAINER_SIZE * 1.1;

  return (
    <View style={styles.container}>
      <View style={[styles.logoContainer, { width: CONTAINER_SIZE, height: CONTAINER_SIZE }]}>
        {/* Android-safe Animated View Glow */}
        <Animated.View
          style={[
            styles.animatedGlow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
            },
            glowStyle,
          ]}
        />

        {/* Dynamic Location Pin Outline SVG */}
        <Svg
          height={CONTAINER_SIZE}
          width={CONTAINER_SIZE}
          viewBox="0 0 200 200"
          style={styles.absoluteLayer}
        >
          <AnimatedPath
            d={PIN_PATH}
            fill="none"
            stroke="#10B981"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={pathLength || 1000}
            animatedProps={animatedPathProps}
            onLayout={(e) => {
              const path = e.target as any;
              if (path && typeof path.getTotalLength === 'function') {
                const calculatedLength = path.getTotalLength();
                if (calculatedLength > 0) {
                  setPathLength(calculatedLength);
                }
              } else {
                setPathLength(520);
              }
            }}
          />
        </Svg>

        {/* Helmet Image */}
        <Animated.View
          style={[
            styles.helmetContainer,
            {
              width: HELMET_SIZE,
              height: HELMET_SIZE,
              top: helmetOffsetTop,
              left: helmetOffsetLeft,
            },
            helmetStyle,
          ]}
        >
          <Image
            source={require('../../assets/helmet.png')}
            style={styles.helmetImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Green Glowing Dot directly positioned over helmet rivet */}
        <Animated.View
          style={[
            styles.glowingDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              top: rivetY - dotSize / 2,
              left: rivetX - dotSize / 2,
            },
            dotStyle,
          ]}
        />
      </View>

      {/* Typography */}
      <View style={styles.textContainer}>
        <Animated.Text style={[styles.title, titleStyle]}>
          Rivo.City Rider
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          Delivering Your City
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  absoluteLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  animatedGlow: {
    position: 'absolute',
    backgroundColor: '#22CC71',
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 20,
  },
  helmetContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helmetImage: {
    width: '100%',
    height: '100%',
  },
  glowingDot: {
    position: 'absolute',
    backgroundColor: '#34D399',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 12,
  },
  textContainer: {
    marginTop: 36,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: Math.min(SCREEN_WIDTH * 0.07, 28),
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: Math.min(SCREEN_WIDTH * 0.038, 15),
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default AnimatedSplash;