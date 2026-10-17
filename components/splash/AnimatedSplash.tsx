import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  onAnimationComplete,
}) => {
  const insets = useSafeAreaInsets();
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.94)).current;
  const titleY = useRef(new Animated.Value(14)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.spring(titleScale, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1100),
      Animated.timing(titleOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onAnimationComplete();
    });

    return () => animation.stop();
  }, [onAnimationComplete, subtitleOpacity, subtitleY, titleOpacity, titleScale, titleY]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View
        style={[
          styles.titleRow,
          {
            opacity: titleOpacity,
            transform: [{ scale: titleScale }, { translateY: titleY }],
          },
        ]}
      >
        <Text style={styles.title}>RivoCity</Text>
        <Text style={styles.role}> Rider</Text>
      </Animated.View>

      <Animated.Text
        style={[
          styles.subtitle,
          { opacity: subtitleOpacity, transform: [{ translateY: subtitleY }] },
        ]}
      >
        Delivering Your City
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  role: {
    color: "#A8E63A",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 12,
    color: "#B7B7B7",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});

export default AnimatedSplash;
