import React from 'react';
import { View, type ViewProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export function ThemedView({ style, ...otherProps }: ViewProps) {
  return <View style={[styles.base, style]} {...otherProps} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.background,
  },
});
