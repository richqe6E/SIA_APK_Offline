import DateTimePicker from '@react-native-community/datetimepicker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useLockOrientation } from '@/hooks/use-orientation';
import { Colors } from '@/constants/theme';

type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

interface ReportData {
  total: number;
  count: number;
  average: number;
  topProducts: { name: string; qty: number; total: number }[];
  hours: { hour: number; total: number; count: number }[];
  days: { day: number; label: string; total: number; count: number }[];
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function ReportsScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [period, setPeriod] = useState<Period>('daily');
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async (p: Period) => {
    const fmtDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    };
    setPeriod(p);
    setLoading(true);

    let dateFilter = '';
    const params: any[] = [];

    switch (p) {
      case 'daily':
        dateFilter = "WHERE date(t.created_at) = date('now','localtime')";
        break;
      case 'weekly':
        dateFilter = "WHERE t.created_at >= datetime('now','localtime','-7 days')";
        break;
      case 'monthly':
        dateFilter = "WHERE strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now','localtime')";
        break;
      case 'custom':
        dateFilter = 'WHERE date(t.created_at) BETWEEN ? AND ?';
        params.push(fmtDate(customStart), fmtDate(customEnd));
        break;
    }

    const summary = await db.getFirstAsync<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(t.total),0) as total, COUNT(*) as count FROM transactions t ${dateFilter}`,
      ...params
    );

    const dayCount = p === 'daily' ? 1 : p === 'weekly' ? 7 : p === 'monthly' ? 30 : 0;
    const dayCountParam = p === 'custom'
      ? Math.max(1, Math.ceil((customEnd.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : dayCount;

    const total = summary?.total ?? 0;
    const count = summary?.count ?? 0;
    const average = dayCountParam > 0 ? total / dayCountParam : total;

    const topProducts = await db.getAllAsync<{ name: string; qty: number; total: number }>(
      `SELECT ti.product_name as name, SUM(ti.quantity) as qty, SUM(ti.subtotal) as total
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       ${dateFilter}
       GROUP BY ti.product_name
       ORDER BY total DESC
       LIMIT 10`,
      ...params
    );

    const hours = await db.getAllAsync<{ hour: number; total: number; count: number }>(
      `SELECT CAST(strftime('%H', t.created_at) AS INTEGER) as hour,
              COALESCE(SUM(t.total),0) as total,
              COUNT(*) as count
       FROM transactions t
       ${dateFilter}
       GROUP BY CAST(strftime('%H', t.created_at) AS INTEGER)
       ORDER BY hour ASC`,
      ...params
    );

    const daysRaw = await db.getAllAsync<{ day: number; total: number; count: number }>(
      `SELECT CAST(strftime('%w', t.created_at) AS INTEGER) as day,
              COALESCE(SUM(t.total),0) as total,
              COUNT(*) as count
       FROM transactions t
       ${dateFilter}
       GROUP BY CAST(strftime('%w', t.created_at) AS INTEGER)
       ORDER BY day ASC`,
      ...params
    );

    const days = daysRaw.map((d) => ({
      ...d,
      label: DAY_LABELS[d.day] ?? `Hari ${d.day}`,
    }));

    setData({ total, count, average, topProducts, hours, days });
    setLoading(false);
  }, [db, customStart, customEnd]);

  const periods: { key: Period; label: string }[] = [
    { key: 'daily', label: 'Hari Ini' },
    { key: 'weekly', label: '7 Hari' },
    { key: 'monthly', label: '30 Hari' },
    { key: 'custom', label: 'Kustom' },
  ];

  const maxProductTotal = data ? Math.max(...data.topProducts.map((i) => i.total), 1) : 1;
  const maxHourTotal = data ? Math.max(...data.hours.map((h) => h.total), 1) : 1;
  const maxDayTotal = data ? Math.max(...data.days.map((d) => d.total), 1) : 1;

  return (
    <ThemedView style={[styles.container, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      <ThemedText type="title" style={{ marginBottom: 16 }}>Laporan</ThemedText>

      <View style={styles.periodRow}>
        {periods.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => loadReport(p.key)}
          >
            <ThemedText style={period === p.key ? { color: '#fff', fontWeight: '600' } : {}}>
              {p.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {period === 'custom' && (
        <View style={styles.customDateRow}>
          <Pressable onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
            <ThemedText style={styles.dateLabel}>Mulai</ThemedText>
            <ThemedText style={styles.dateValue}>{customStart.toLocaleDateString('id-ID')}</ThemedText>
          </Pressable>
          <ThemedText>{'\u{2192}'}</ThemedText>
          <Pressable onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
            <ThemedText style={styles.dateLabel}>Selesai</ThemedText>
            <ThemedText style={styles.dateValue}>{customEnd.toLocaleDateString('id-ID')}</ThemedText>
          </Pressable>
        </View>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_, date) => {
            setShowStartPicker(false);
            if (date) setCustomStart(date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_, date) => {
            setShowEndPicker(false);
            if (date) setCustomEnd(date);
          }}
        />
      )}

      {loading && (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 40 }} />
      )}

      {data && !loading && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Section 1: Ringkasan */}
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.sectionHeader}>
              <ThemedText style={{ fontSize: 18, lineHeight: 22 }}>{'\u{1F4CA}'}</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Ringkasan</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryIcon}>{'\u{1F4B5}'}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Total</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
                  Rp {data.total.toLocaleString()}
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryIcon}>{'\u{1F4CB}'}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Transaksi</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
                  {data.count}x
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryIcon}>{'\u{1F4C8}'}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Rata-rata/Hari</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
                  Rp {Math.round(data.average).toLocaleString()}
                </ThemedText>
              </View>
            </View>
          </Card>

          {/* Section 2: Produk Terlaris */}
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.sectionHeader}>
              <ThemedText style={{ fontSize: 18, lineHeight: 22 }}>{'\u{1F3C6}'}</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Produk Terlaris</ThemedText>
            </View>
            {data.topProducts.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={styles.rankBadge}>
                  <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#fff' }}>{i + 1}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 12 }}>{item.name}</ThemedText>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${(item.total / maxProductTotal) * 100}%` }]} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>
                    Rp {item.total.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: Colors.placeholder }}>
                    {item.qty} pcs
                  </ThemedText>
                </View>
              </View>
            ))}
            {data.topProducts.length === 0 && (
              <ThemedText style={{ textAlign: 'center', color: Colors.muted, marginTop: 8, fontSize: 12 }}>
                Belum ada data penjualan
              </ThemedText>
            )}
          </Card>

          {/* Section 3: Jam Sibuk */}
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.sectionHeader}>
              <ThemedText style={{ fontSize: 18, lineHeight: 22 }}>{'\u{1F552}'}</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Jam Sibuk</ThemedText>
            </View>
            {data.hours.length > 0 ? (
              <>
                {data.hours.map((h) => (
                  <View key={h.hour} style={styles.hourRow}>
                    <ThemedText style={styles.hourLabel}>
                      {String(h.hour).padStart(2, '0')}:00
                    </ThemedText>
                    <View style={styles.hourBarBg}>
                      <View style={[styles.hourBarFill, { width: `${(h.total / maxHourTotal) * 100}%` }]} />
                    </View>
                    <ThemedText style={styles.hourValue}>
                      Rp {h.total.toLocaleString()}
                    </ThemedText>
                  </View>
                ))}
                <ThemedText style={{ fontSize: 11, color: Colors.placeholder, marginTop: 4 }}>
                  * Jam dengan transaksi tertinggi:{' '}
                  <ThemedText style={{ fontWeight: '600' }}>
                    {String(data.hours.sort((a, b) => b.total - a.total)[0]?.hour).padStart(2, '0')}:00
                  </ThemedText>
                </ThemedText>
              </>
            ) : (
              <ThemedText style={{ textAlign: 'center', color: Colors.muted, marginTop: 8, fontSize: 12 }}>
                Belum ada data
              </ThemedText>
            )}
          </Card>

          {/* Section 4: Hari Sibuk */}
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.sectionHeader}>
              <ThemedText style={{ fontSize: 18, lineHeight: 22 }}>{'\u{1F4C5}'}</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Hari Sibuk</ThemedText>
            </View>
            {data.days.length > 0 ? (
              <>
                {data.days.map((d) => (
                  <View key={d.day} style={styles.hourRow}>
                    <ThemedText style={styles.hourLabel}>{d.label}</ThemedText>
                    <View style={styles.hourBarBg}>
                      <View style={[styles.hourBarFill, { width: `${(d.total / maxDayTotal) * 100}%` }]} />
                    </View>
                    <ThemedText style={styles.hourValue}>
                      Rp {d.total.toLocaleString()}
                    </ThemedText>
                  </View>
                ))}
                <ThemedText style={{ fontSize: 11, color: Colors.placeholder, marginTop: 4 }}>
                  * Hari dengan transaksi tertinggi:{' '}
                  <ThemedText style={{ fontWeight: '600' }}>
                    {data.days.sort((a, b) => b.total - a.total)[0]?.label}
                  </ThemedText>
                </ThemedText>
              </>
            ) : (
              <ThemedText style={{ textAlign: 'center', color: Colors.muted, marginTop: 8, fontSize: 12 }}>
                Belum ada data
              </ThemedText>
            )}
          </Card>
        </ScrollView>
      )}

      {!data && !loading && (
        <EmptyState
          icon={'\u{1F4CA}'}
          title="Pilih periode"
          subtitle="Pilih periode untuk melihat laporan"
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: Colors.tint },
  customDateRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  dateBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  dateLabel: { fontSize: 10, color: Colors.placeholder },
  dateValue: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryIcon: { fontSize: 20, lineHeight: 26 },
  summaryLabel: { fontSize: 10, color: Colors.placeholder, textAlign: 'center' },
  summaryValue: { fontSize: 13, textAlign: 'center' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 5,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    marginTop: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 5,
    backgroundColor: Colors.tint,
    borderRadius: 3,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  hourLabel: {
    width: 36,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.placeholder,
  },
  hourBarBg: {
    flex: 1,
    height: 14,
    backgroundColor: Colors.borderLight,
    borderRadius: 7,
    overflow: 'hidden',
  },
  hourBarFill: {
    height: 14,
    backgroundColor: Colors.tint,
    borderRadius: 7,
    opacity: 0.7,
  },
  hourValue: {
    width: 80,
    fontSize: 10,
    textAlign: 'right',
    fontWeight: '500',
  },
});