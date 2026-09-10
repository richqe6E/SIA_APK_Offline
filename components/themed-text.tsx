import { StyleSheet, Text, type TextProps, Platform } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const flattened = StyleSheet.flatten(style);

  // Jika style menentukan fontSize kustom tanpa lineHeight, sesuaikan lineHeight proporsional
  // agar font/angka/emoji di Android tidak terpotong bagian atas dan bawahnya.
  const customLineHeight =
    flattened?.fontSize && !flattened?.lineHeight
      ? { lineHeight: Math.round(flattened.fontSize * 1.32) }
      : undefined;

  return (
    <Text
      style={[
        { color },
        styles.base,
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        customLineHeight,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
    }),
  },
  default: {
    fontSize: 13,
    lineHeight: 18,
  },
  defaultSemiBold: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  link: {
    lineHeight: 20,
    fontSize: 13,
    color: '#0a7ea4',
  },
});
