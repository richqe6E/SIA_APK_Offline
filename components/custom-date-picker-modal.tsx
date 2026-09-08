import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';

interface CustomDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  initialDate?: string | null; // format YYYY-MM-DD
  mode?: 'expired' | 'due_date' | 'general';
  onSelectDate: (dateStr: string) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function CustomDatePickerModal({
  visible,
  onClose,
  title = 'Pilih Tanggal',
  initialDate,
  mode = 'general',
  onSelectDate,
}: CustomDatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      if (initialDate && initialDate.includes('-')) {
        const parts = initialDate.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) {
          setSelectedDate(dt);
          return;
        }
      }
      setSelectedDate(new Date());
    }
  }, [visible, initialDate]);

  const addDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  const addMonths = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setSelectedDate(d);
  };

  const adjustDate = (field: 'day' | 'month' | 'year', delta: number) => {
    const d = new Date(selectedDate);
    if (field === 'day') {
      d.setDate(d.getDate() + delta);
    } else if (field === 'month') {
      d.setMonth(d.getMonth() + delta);
    } else if (field === 'year') {
      d.setFullYear(d.getFullYear() + delta);
    }
    setSelectedDate(d);
  };

  const yyyy = selectedDate.getFullYear();
  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const dd = String(selectedDate.getDate()).padStart(2, '0');
  const dateIsoString = `${yyyy}-${mm}-${dd}`;

  const formattedDisplay = `${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  const handleConfirm = () => {
    onSelectDate(dateIsoString);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={22}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>📅 {title}</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Quick Presets */}
          <ThemedText style={styles.presetLabel}>Pilihan Cepat:</ThemedText>
          <View style={styles.presetRow}>
            {mode === 'expired' ? (
              <>
                <TouchableOpacity style={styles.presetChip} onPress={() => addMonths(1)}>
                  <ThemedText style={styles.presetChipText}>+1 Bulan</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addMonths(3)}>
                  <ThemedText style={styles.presetChipText}>+3 Bulan</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addMonths(6)}>
                  <ThemedText style={styles.presetChipText}>+6 Bulan</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addMonths(12)}>
                  <ThemedText style={styles.presetChipText}>+1 Tahun</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addMonths(24)}>
                  <ThemedText style={styles.presetChipText}>+2 Tahun</ThemedText>
                </TouchableOpacity>
              </>
            ) : mode === 'due_date' ? (
              <>
                <TouchableOpacity style={styles.presetChip} onPress={() => addDays(1)}>
                  <ThemedText style={styles.presetChipText}>1 Hari</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addDays(3)}>
                  <ThemedText style={styles.presetChipText}>3 Hari</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addDays(7)}>
                  <ThemedText style={styles.presetChipText}>7 Hari (1 Minggu)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addDays(14)}>
                  <ThemedText style={styles.presetChipText}>14 Hari (2 Minggu)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addDays(30)}>
                  <ThemedText style={styles.presetChipText}>30 Hari (1 Bulan)</ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.presetChip} onPress={() => setSelectedDate(new Date())}>
                  <ThemedText style={styles.presetChipText}>Hari Ini</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addDays(7)}>
                  <ThemedText style={styles.presetChipText}>+7 Hari</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => addMonths(1)}>
                  <ThemedText style={styles.presetChipText}>+1 Bulan</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Stepper Selector for Day, Month, Year */}
          <View style={styles.stepperContainer}>
            {/* Tanggal / Day */}
            <View style={styles.stepperCol}>
              <TouchableOpacity style={styles.stepArrow} onPress={() => adjustDate('day', 1)}>
                <ThemedText style={styles.stepArrowText}>▲</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.stepValue}>{selectedDate.getDate()}</ThemedText>
              <ThemedText style={styles.stepLabel}>Hari</ThemedText>
              <TouchableOpacity style={styles.stepArrow} onPress={() => adjustDate('day', -1)}>
                <ThemedText style={styles.stepArrowText}>▼</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Bulan / Month */}
            <View style={[styles.stepperCol, { flex: 1.6 }]}>
              <TouchableOpacity style={styles.stepArrow} onPress={() => adjustDate('month', 1)}>
                <ThemedText style={styles.stepArrowText}>▲</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.stepValue} numberOfLines={1}>
                {MONTH_NAMES[selectedDate.getMonth()]}
              </ThemedText>
              <ThemedText style={styles.stepLabel}>Bulan</ThemedText>
              <TouchableOpacity style={styles.stepArrow} onPress={() => adjustDate('month', -1)}>
                <ThemedText style={styles.stepArrowText}>▼</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Tahun / Year */}
            <View style={styles.stepperCol}>
              <TouchableOpacity style={styles.stepArrow} onPress={() => adjustDate('year', 1)}>
                <ThemedText style={styles.stepArrowText}>▲</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.stepValue}>{selectedDate.getFullYear()}</ThemedText>
              <ThemedText style={styles.stepLabel}>Tahun</ThemedText>
              <TouchableOpacity style={styles.stepArrow} onPress={() => adjustDate('year', -1)}>
                <ThemedText style={styles.stepArrowText}>▼</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Result Box */}
          <View style={styles.previewBox}>
            <ThemedText style={styles.previewTitle}>Tanggal Terpilih:</ThemedText>
            <ThemedText style={styles.previewDate}>{formattedDisplay}</ThemedText>
          </View>

          {/* Buttons */}
          <View style={styles.actionRow}>
            <Button
              title="Batal"
              variant="outline"
              style={{ flex: 1 }}
              onPress={onClose}
            />
            <Button
              title="Pilih Tanggal"
              style={{ flex: 1.5, backgroundColor: Colors.tintDark }}
              onPress={handleConfirm}
            />
          </View>
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  presetChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepperCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepArrow: {
    padding: 6,
  },
  stepArrowText: {
    fontSize: 14,
    color: Colors.tint,
    fontWeight: '800',
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 2,
    textAlign: 'center',
  },
  stepLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  previewBox: {
    alignItems: 'center',
    marginVertical: 14,
    padding: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  previewTitle: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  previewDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
