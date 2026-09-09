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
}

export function RealtimeClockBadge({ compact = false }: RealtimeClockBadgeProps) {
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
      <View style={styles.compactContainer}>
        <ThemedText style={styles.compactText}>
          {dayName}, {dateNum} {monthName} • {hours}:{minutes}:{seconds}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.clockRow}>
        <ThemedText style={styles.dateText}>
          📅 {dayName}, {dateNum} {monthName} {year}
        </ThemedText>
        <View style={styles.divider} />
        <ThemedText style={styles.timeText}>
          🕒 {hours}:{minutes}:{seconds}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignSelf: 'stretch',
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tint,
  },
  compactContainer: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
});
