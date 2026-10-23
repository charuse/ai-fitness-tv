import React, { useState, useCallback, forwardRef } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp, View, LayoutChangeEvent } from 'react-native';

interface Props {
  onPress: () => void;
  title: string;
  style?: StyleProp<ViewStyle>;
  onFocus?: () => void;
  onBlur?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
}

export const FocusableButton = forwardRef<View, Props>(({ 
  onPress, title, style, onFocus, onBlur, onLayout, hasTVPreferredFocus, disabled,
  nextFocusUp, nextFocusDown, nextFocusLeft, nextFocusRight 
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleFocus = useCallback(() => { setIsFocused(true); if (onFocus) onFocus(); }, [onFocus]);
  const handleBlur = useCallback(() => { setIsFocused(false); if (onBlur) onBlur(); }, [onBlur]);

  return (
    <Pressable
      ref={ref as any}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onLayout={onLayout}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={disabled}
      // @ts-ignore
      nextFocusUp={nextFocusUp}
      // @ts-ignore
      nextFocusDown={nextFocusDown}
      // @ts-ignore
      nextFocusLeft={nextFocusLeft}
      // @ts-ignore
      nextFocusRight={nextFocusRight}
      style={[styles.button, isFocused && !disabled && styles.focusedButton, style]}
    >
      <Text style={[styles.text, isFocused && !disabled && styles.focusedText]}>{title}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: { padding: 24, backgroundColor: '#334155', borderRadius: 12, margin: 15, minWidth: 300 },
  focusedButton: { backgroundColor: '#3b82f6', transform: [{ scale: 1.05 }] },
  text: { color: '#f8fafc', fontSize: 36, textAlign: 'center' },
  focusedText: { fontWeight: 'bold' }
});