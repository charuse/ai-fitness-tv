import React, { useState, useCallback, forwardRef } from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';

interface Props {
  label: string;
  value: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
}

export const FocusableToggle = forwardRef<View, Props>(({ 
  label, value, onToggle, style, onLayout, hasTVPreferredFocus,
  nextFocusUp, nextFocusDown, nextFocusLeft, nextFocusRight
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  return (
    <Pressable
      ref={ref as any}
      onPress={onToggle}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onLayout={onLayout}
      hasTVPreferredFocus={hasTVPreferredFocus}
      // @ts-ignore
      nextFocusUp={nextFocusUp}
      // @ts-ignore
      nextFocusDown={nextFocusDown}
      // @ts-ignore
      nextFocusLeft={nextFocusLeft}
      // @ts-ignore
      nextFocusRight={nextFocusRight}
      style={[styles.container, isFocused && styles.containerFocused, style]}
    >
      <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
      
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, backgroundColor: '#334155', borderRadius: 12, margin: 15, minWidth: 450 },
  containerFocused: { backgroundColor: '#3b82f6', transform: [{ scale: 1.05 }] },
  label: { color: '#f8fafc', fontSize: 36, marginRight: 30 },
  labelFocused: { fontWeight: 'bold' },
  track: { width: 80, height: 40, borderRadius: 20, padding: 5, justifyContent: 'center' },
  trackOff: { backgroundColor: '#64748b', alignItems: 'flex-start' },
  trackOn: { backgroundColor: '#22c55e', alignItems: 'flex-end' },
  thumb: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ffffff' },
  thumbOff: {},
  thumbOn: {},
});