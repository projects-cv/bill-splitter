import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Share } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useReceipt } from '../store/ReceiptContext';
import { Colors } from '../theme/colors';
import { CheckCircle2, Home, MessageCircle, Pencil } from 'lucide-react-native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Summary'>;
};

export default function SummaryScreen({ navigation }: Props) {
  const { receipt, reset } = useReceipt();

  const calculations = useMemo(() => {
    if (!receipt) return { totalsByPerson: [], calculatedTotal: 0 };

    const personSubtotals: Record<string, number> = {};
    
    // Initialize
    receipt.participants.forEach(p => {
      personSubtotals[p.id] = 0;
    });

    // Calculate subtotals
    let calculatedSubtotal = 0;
    receipt.items.forEach(item => {
      if (item.assignedTo.length > 0) {
        const splitPrice = item.price / item.assignedTo.length;
        item.assignedTo.forEach(pid => {
          if (personSubtotals[pid] !== undefined) {
            personSubtotals[pid] += splitPrice;
          }
        });
        calculatedSubtotal += item.price;
      }
    });

    const taxAndFees = receipt.tax + receipt.fees;

    // Calculate final totals proportional to subtotal
    let calculatedTotal = 0;
    const totalsByPerson = receipt.participants.map(p => {
      const subtotal = personSubtotals[p.id];
      // Proportion of tax/fees based on their share of the assigned subtotal
      // If nothing is assigned yet, we handle divide by 0
      const proportion = calculatedSubtotal > 0 ? (subtotal / calculatedSubtotal) : 0;
      const additional = proportion * taxAndFees;
      const total = subtotal + additional;
      
      calculatedTotal += total;

      return {
        ...p,
        subtotal,
        additional,
        total
      };
    });

    return { totalsByPerson, calculatedTotal };
  }, [receipt]);

  if (!receipt) return null;

  const { totalsByPerson, calculatedTotal } = calculations;
  const isMatch = Math.abs(calculatedTotal - receipt.total) < 0.05; // allow small float rounding diff

  const handleFinish = () => {
    reset();
    navigation.popToTop(); // Go back to Dashboard
  };

  const handleShare = async (person: any) => {
    try {
      const amount = person.total.toFixed(2);
      const note = encodeURIComponent(`Receipt from ${receipt.storeName}`);
      const venmoLink = `https://venmo.com/?txn=pay&amount=${amount}&note=${note}`;
      const message = `Hey ${person.name}, you owe $${amount} for ${receipt.storeName}. You can pay me here: ${venmoLink}`;
      
      await Share.share({
        message,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Verification Banner */}
        <View style={[styles.verificationBanner, isMatch ? styles.matchBanner : styles.mismatchBanner]}>
          <CheckCircle2 stroke={isMatch ? Colors.success : Colors.warning} size={24} />
          <View style={styles.verificationTextContainer}>
            <Text style={[styles.verificationTitle, { color: isMatch ? Colors.success : Colors.warning }]}>
              {isMatch ? "Totals Match!" : "Totals Don't Match"}
            </Text>
            <Text style={styles.verificationSubtitle}>
              {isMatch 
                ? "Everything looks good to go." 
                : `Calculated: $${calculatedTotal.toFixed(2)} | Receipt: $${receipt.total.toFixed(2)}`}
            </Text>
            {!isMatch && (
              <TouchableOpacity 
                style={styles.fixItemsButton} 
                onPress={() => navigation.navigate('ItemAssignment', {})}
                activeOpacity={0.7}
              >
                <Pencil stroke="#B45309" size={13} style={{ marginRight: 4 }} />
                <Text style={styles.fixItemsButtonText}>Edit Items or Prices</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Receipt Overview */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Receipt Summary</Text>
            <TouchableOpacity 
              style={styles.editItemsLink} 
              onPress={() => navigation.navigate('ItemAssignment', {})}
              activeOpacity={0.7}
            >
              <Pencil stroke={Colors.primary} size={13} style={{ marginRight: 4 }} />
              <Text style={styles.editItemsLinkText}>Edit Items</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.rowValue}>${receipt.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tax</Text>
            <Text style={styles.rowValue}>${receipt.tax.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fees & Tip</Text>
            <Text style={styles.rowValue}>${receipt.fees.toFixed(2)}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${receipt.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Individual Breakdowns */}
        <Text style={styles.sectionTitleOuter}>Who owes what</Text>
        {totalsByPerson.map(person => (
          <View key={person.id} style={styles.personCard}>
            <View style={styles.personHeader}>
              <View style={[styles.avatar, { backgroundColor: person.color }]}>
                <Text style={styles.avatarText}>{person.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personSubtext}>
                  Items: ${person.subtotal.toFixed(2)}  •  Tax/Fees: ${person.additional.toFixed(2)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.personTotal}>${person.total.toFixed(2)}</Text>
                <TouchableOpacity 
                  style={styles.shareButton} 
                  onPress={() => handleShare(person)}
                >
                  <MessageCircle stroke={Colors.primary} size={14} style={{ marginRight: 4 }} />
                  <Text style={styles.shareText}>Text Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
          <Home stroke="#fff" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.finishButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  matchBanner: {
    backgroundColor: Colors.successSoft,
    borderColor: '#A7F3D0',
  },
  mismatchBanner: {
    backgroundColor: Colors.dangerSoft,
    borderColor: '#FECACA',
  },
  verificationTextContainer: {
    marginLeft: 12,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editItemsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
  },
  editItemsLinkText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  fixItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  fixItemsButtonText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitleOuter: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  rowValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  personCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  personName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  personTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  personSubtext: {
    fontSize: 13,
    color: Colors.textLight,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
  shareText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  finishButton: {
    backgroundColor: Colors.text,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
