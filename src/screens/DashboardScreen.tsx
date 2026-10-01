import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { Camera, Receipt as ReceiptIcon, ChevronRight } from 'lucide-react-native';
import packageJson from '../../package.json';
import { useReceipt } from '../store/ReceiptContext';
import { useAuth } from '../store/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

export default function DashboardScreen({ navigation }: Props) {
  const { session, signOut } = useAuth();
  const { savedReceipts, setReceipt, isHistoryLoading, historyError, retryHistory,
    hasLegacyReceipts, isImportingHistory, importLegacyReceipts } = useReceipt();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.accountRow}>
          <Text style={styles.accountPhone}>{session?.user.phone}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.signOutButton}>
            <Text style={styles.retryText}>Sign out</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>Your bill splits</Text>
        <Text style={styles.subtitle}>Let's split some bills!</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Camera')}
          activeOpacity={0.8}
        >
          <Camera stroke="#fff" size={28} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Scan New Receipt</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Recent Splits</Text>
      </View>

      {hasLegacyReceipts && (
        <View style={styles.historyMessage}>
          <Text style={styles.subtitle}>Have splits saved here before accounts were added? Import them if they’re yours.</Text>
          <TouchableOpacity style={styles.signOutButton} accessibilityRole="button" disabled={isImportingHistory}
            onPress={() => { void importLegacyReceipts(); }}>
            <Text style={styles.retryText}>{isImportingHistory ? 'Importing…' : 'Import old splits into my account'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {historyError && (
        <View style={styles.historyMessage}>
          <Text style={styles.errorText} accessibilityRole="alert">{historyError}</Text>
          <TouchableOpacity onPress={retryHistory} accessibilityRole="button" disabled={isHistoryLoading}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={savedReceipts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.receiptCard}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open split from ${item.storeName}, ${item.date}, $${item.total.toFixed(2)}`}
            onPress={() => {
              setReceipt(item);
              navigation.navigate('Summary', { receiptId: item.id });
            }}
          >
            <View style={styles.iconContainer}>
              <ReceiptIcon stroke={Colors.primary} size={24} />
            </View>
            <View style={styles.receiptInfo}>
              <Text style={styles.storeName}>{item.storeName}</Text>
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
            <View style={styles.amountInfo}>
              <Text style={styles.amountText}>${item.total.toFixed(2)}</Text>
              <Text style={styles.participantText}>
                {item.participants.length} {item.participants.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
            <ChevronRight stroke={Colors.border} size={20} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.storeName}>
              {isHistoryLoading ? 'Loading recent splits…' : historyError ? 'Saved splits unavailable' : 'No recent splits yet'}
            </Text>
            {!isHistoryLoading && !historyError && (
              <Text style={styles.subtitle}>Scan a receipt and calculate the split to save it here.</Text>
            )}
          </View>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.versionText}>v{packageJson.version}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  accountPhone: { color: Colors.textMuted, fontSize: 14 },
  signOutButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  actionContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  retryText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  historyMessage: {
    marginHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
  },
  emptyState: {
    paddingVertical: 24,
    gap: 8,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  receiptInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  amountInfo: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  participantText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
});
