import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

interface RealtimeClockBadgeProps {
  compact?: boolean;
  textColor?: string;
  backgroundColor?: string;
}

export function RealtimeClockBadge({
  compact = false,
  textColor,
  backgroundColor,
}: RealtimeClockBadgeProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dayName = HARI[time.getDay()];
  const dateNum = String(time.getDate()).padStart(2, '0');
  const monthName = BULAN[time.getMonth()];
  const year = time.getFullYear();

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');

  if (compact) {
    return (
      <View style={[styles.compactContainer, backgroundColor ? { backgroundColor } : null]}>
        <ThemedText style={[styles.compactDate, textColor ? { color: textColor } : null]}>
          📅 {dayName}, {dateNum} {monthName}
        </ThemedText>
        <View style={styles.compactDivider} />
        <ThemedText style={[styles.compactTime, textColor ? { color: textColor } : null]}>
          ⏰ {hours}:{minutes}:{seconds}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : null]}>
      <View style={styles.leftInfo}>
        <ThemedText style={[styles.dateText, textColor ? { color: textColor } : null]}>
          📅 {dayName}, {dateNum} {monthName} {year}
        </ThemedText>
      </View>
      <View style={styles.clockPill}>
        <View style={styles.livePulseDot} />
        <ThemedText style={[styles.timeText, textColor ? { color: textColor } : null]}>
          {hours}:{minutes}:{seconds}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  clockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    fontVariant: ['tabular-nums'],
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactDate: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  compactDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#cbd5e1',
  },
  compactTime: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
});
