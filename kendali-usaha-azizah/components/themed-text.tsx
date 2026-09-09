import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { Colors } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'caption' | 'bold';
};

export function ThemedText({
  style,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  return (
    <Text
      style={[
        styles.base,
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'defaultSemiBold' && styles.defaultSemiBold,
        type === 'subtitle' && styles.subtitle,
        type === 'caption' && styles.caption,
        type === 'bold' && styles.bold,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: Colors.text,
  },
  default: {
    fontSize: 14,
    lineHeight: 20,
  },
  defaultSemiBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  bold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
  },
});
