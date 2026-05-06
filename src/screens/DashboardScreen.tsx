import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { Camera, Receipt as ReceiptIcon, ChevronRight } from 'lucide-react-native';
import packageJson from '../../package.json';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

const MOCK_RECEIPTS = [
  { id: '1', store: 'Olive Garden', date: 'Oct 15, 2023', amount: 85.50, youOwe: 28.50 },
  { id: '2', store: 'Target', date: 'Oct 12, 2023', amount: 120.00, youOwe: 45.00 },
  { id: '3', store: 'Shell Gas', date: 'Oct 10, 2023', amount: 45.00, youOwe: 22.50 },
];

export default function DashboardScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, Casey 👋</Text>
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
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={MOCK_RECEIPTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.receiptCard} activeOpacity={0.7}>
            <View style={styles.iconContainer}>
              <ReceiptIcon stroke={Colors.primary} size={24} />
            </View>
            <View style={styles.receiptInfo}>
              <Text style={styles.storeName}>{item.store}</Text>
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
            <View style={styles.amountInfo}>
              <Text style={styles.amountText}>${item.amount.toFixed(2)}</Text>
              <Text style={styles.oweText}>You owe ${item.youOwe.toFixed(2)}</Text>
            </View>
            <ChevronRight stroke={Colors.border} size={20} />
          </TouchableOpacity>
        )}
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
  seeAll: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
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
  oweText: {
    fontSize: 13,
    color: Colors.warning,
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
