import React, { useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Share, 
  Modal, 
  TextInput, 
  Platform, 
  KeyboardAvoidingView 
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, PromoSplitMethod } from '../types';
import { useReceipt } from '../store/ReceiptContext';
import { Colors } from '../theme/colors';
import { CheckCircle2, Home, MessageCircle, Pencil, Tag, Plus, Trash2, X, Check } from 'lucide-react-native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Summary'>;
};

export default function SummaryScreen({ navigation }: Props) {
  const { receipt, reset, applyPromoCode, removePromoCode, setPromoSplitMethod } = useReceipt();

  // Promo Code Modal State
  const [isPromoModalVisible, setIsPromoModalVisible] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoAmountInput, setPromoAmountInput] = useState('');
  const [modalSplitMethod, setModalSplitMethod] = useState<PromoSplitMethod>('item_cost_percent');
  const [promoError, setPromoError] = useState<string | null>(null);

  const calculations = useMemo(() => {
    if (!receipt) {
      return { 
        totalsByPerson: [], 
        calculatedTotal: 0, 
        calculatedSubtotal: 0,
        totalAssignedItemCount: 0,
        promoDiscount: 0,
        splitMethod: 'item_cost_percent' as PromoSplitMethod
      };
    }

    const personSubtotals: Record<string, number> = {};
    const personItemCounts: Record<string, number> = {};
    
    // Initialize
    receipt.participants.forEach(p => {
      personSubtotals[p.id] = 0;
      personItemCounts[p.id] = 0;
    });

    // Calculate subtotals and item counts
    let calculatedSubtotal = 0;
    let totalAssignedItemCount = 0;

    receipt.items.forEach(item => {
      if (item.assignedTo.length > 0) {
        const splitPrice = item.price / item.assignedTo.length;
        const splitCount = 1 / item.assignedTo.length;

        item.assignedTo.forEach(pid => {
          if (personSubtotals[pid] !== undefined) {
            personSubtotals[pid] += splitPrice;
            personItemCounts[pid] += splitCount;
          }
        });
        calculatedSubtotal += item.price;
        totalAssignedItemCount += 1;
      }
    });

    const taxAndFees = receipt.tax + receipt.fees;
    const promoDiscount = receipt.promoDiscount || 0;
    const splitMethod: PromoSplitMethod = receipt.promoSplitMethod || 'item_cost_percent';

    // Calculate promo shares for each person
    const participantsWithItems = receipt.participants.filter(p => (personSubtotals[p.id] || 0) > 0);
    const numParticipantsWithItems = participantsWithItems.length;
    const totalParticipants = receipt.participants.length;

    const personShares: Record<string, number> = {};

    receipt.participants.forEach(p => {
      const pSubtotal = personSubtotals[p.id] || 0;
      const pCount = personItemCounts[p.id] || 0;
      let shareRatio = 0;

      if (splitMethod === 'item_cost_percent') {
        // Proportion based on each person's share of assigned item cost
        if (calculatedSubtotal > 0) {
          shareRatio = pSubtotal / calculatedSubtotal;
        } else if (totalParticipants > 0) {
          shareRatio = 1 / totalParticipants;
        }
      } else if (splitMethod === 'item_count_percent') {
        // Proportion based on each person's share of assigned item count
        if (totalAssignedItemCount > 0) {
          shareRatio = pCount / totalAssignedItemCount;
        } else if (totalParticipants > 0) {
          shareRatio = 1 / totalParticipants;
        }
      } else {
        // 'equal' split among participating friends
        const divisor = numParticipantsWithItems > 0 ? numParticipantsWithItems : totalParticipants;
        if (divisor > 0 && (numParticipantsWithItems === 0 || pSubtotal > 0)) {
          shareRatio = 1 / divisor;
        } else {
          shareRatio = 0;
        }
      }

      personShares[p.id] = shareRatio;
    });

    // Allocate exact promo discount cents to avoid float rounding discrepancies
    const personDiscounts: Record<string, { discount: number; percent: number }> = {};
    if (promoDiscount > 0) {
      const activeParticipants = receipt.participants.filter(p => (personShares[p.id] || 0) > 0);
      let allocatedDiscount = 0;

      receipt.participants.forEach(p => {
        const share = personShares[p.id] || 0;
        const percent = share * 100;
        if (share <= 0) {
          personDiscounts[p.id] = { discount: 0, percent: 0 };
          return;
        }

        const isLastActive = activeParticipants.length > 0 && activeParticipants[activeParticipants.length - 1].id === p.id;
        let discount = 0;
        if (isLastActive) {
          discount = Math.max(0, parseFloat((promoDiscount - allocatedDiscount).toFixed(2)));
        } else {
          discount = parseFloat((share * promoDiscount).toFixed(2));
          allocatedDiscount += discount;
        }

        personDiscounts[p.id] = { discount, percent };
      });
    } else {
      receipt.participants.forEach(p => {
        personDiscounts[p.id] = { discount: 0, percent: 0 };
      });
    }

    // Calculate final totals proportional to subtotal, minus promo discount
    let calculatedTotal = 0;
    const totalsByPerson = receipt.participants.map(p => {
      const subtotal = personSubtotals[p.id] || 0;
      const proportion = calculatedSubtotal > 0 ? (subtotal / calculatedSubtotal) : 0;
      const additional = proportion * taxAndFees;
      const promoInfo = personDiscounts[p.id] || { discount: 0, percent: 0 };
      const total = Math.max(0, subtotal + additional - promoInfo.discount);
      
      calculatedTotal += total;

      return {
        ...p,
        subtotal,
        additional,
        discount: promoInfo.discount,
        discountPercent: promoInfo.percent,
        itemCount: personItemCounts[p.id] || 0,
        total
      };
    });

    return { 
      totalsByPerson, 
      calculatedTotal, 
      calculatedSubtotal,
      totalAssignedItemCount,
      promoDiscount,
      splitMethod
    };
  }, [receipt]);

  if (!receipt) return null;

  const { totalsByPerson, calculatedTotal, promoDiscount, splitMethod } = calculations;
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
      let message = `Hey ${person.name}, you owe $${amount} for ${receipt.storeName}.`;
      if (person.discount > 0) {
        message += ` (Includes -$${person.discount.toFixed(2)} promo discount!)`;
      }
      message += ` You can pay me here: ${venmoLink}`;
      
      await Share.share({
        message,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleOpenPromoModal = () => {
    setPromoCodeInput(receipt.promoCode || '');
    setPromoAmountInput(receipt.promoDiscount ? receipt.promoDiscount.toFixed(2) : '');
    setModalSplitMethod(receipt.promoSplitMethod || 'item_cost_percent');
    setPromoError(null);
    setIsPromoModalVisible(true);
  };

  const handleSavePromo = () => {
    const cleanedAmountStr = promoAmountInput.replace(/[^0-9.]/g, '');
    const parsedAmount = parseFloat(cleanedAmountStr);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setPromoError('Please enter a valid discount amount greater than $0.00');
      return;
    }

    const code = promoCodeInput.trim() || 'PROMO';
    applyPromoCode(parsedAmount, code, modalSplitMethod);
    setIsPromoModalVisible(false);
  };

  const handleRemovePromo = () => {
    removePromoCode();
    setIsPromoModalVisible(false);
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
          {promoDiscount > 0 && (
            <View style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.rowLabel, { color: Colors.success, fontWeight: '600' }]}>
                  Promo Code ({receipt.promoCode || 'PROMO'})
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: Colors.success, fontWeight: '700' }]}>
                -${promoDiscount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${receipt.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Promo Code & Discount Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Tag stroke={Colors.primary} size={18} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Promo Code</Text>
            </View>
            {promoDiscount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity 
                  style={[styles.smallActionButton, { marginRight: 8 }]} 
                  onPress={handleOpenPromoModal}
                  activeOpacity={0.7}
                >
                  <Pencil stroke={Colors.primary} size={13} style={{ marginRight: 4 }} />
                  <Text style={styles.smallActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.smallDangerButton} 
                  onPress={handleRemovePromo}
                  activeOpacity={0.7}
                >
                  <Trash2 stroke={Colors.danger} size={13} style={{ marginRight: 4 }} />
                  <Text style={styles.smallDangerText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addPromoButton} 
                onPress={handleOpenPromoModal}
                activeOpacity={0.7}
              >
                <Plus stroke={Colors.primary} size={14} style={{ marginRight: 4 }} />
                <Text style={styles.addPromoButtonText}>Add Promo Code</Text>
              </TouchableOpacity>
            )}
          </View>

          {promoDiscount > 0 ? (
            <View>
              {/* Promo Banner Info */}
              <View style={styles.activePromoBanner}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.promoCodeBadge}>{receipt.promoCode || 'PROMO'}</Text>
                    <Text style={styles.activePromoAmount}>-${promoDiscount.toFixed(2)} off</Text>
                  </View>
                  <Text style={styles.activePromoDescription}>
                    {splitMethod === 'item_cost_percent' && 'Split by % of item spend per person'}
                    {splitMethod === 'item_count_percent' && 'Split by % of item count per person'}
                    {splitMethod === 'equal' && 'Split equally among participants'}
                  </Text>
                </View>
              </View>

              {/* Split Option Selector */}
              <Text style={styles.splitOptionHeader}>Split promo code by:</Text>
              <View style={styles.splitMethodButtonGroup}>
                <TouchableOpacity 
                  style={[
                    styles.splitMethodButton, 
                    splitMethod === 'item_cost_percent' && styles.splitMethodButtonActive
                  ]}
                  onPress={() => setPromoSplitMethod('item_cost_percent')}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {splitMethod === 'item_cost_percent' && (
                      <Check stroke={Colors.primary} size={14} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[
                      styles.splitMethodButtonText,
                      splitMethod === 'item_cost_percent' && styles.splitMethodButtonTextActive
                    ]}>
                      % of Items ($)
                    </Text>
                  </View>
                  <Text style={styles.splitMethodButtonSubtext}>By item spend</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.splitMethodButton, 
                    splitMethod === 'item_count_percent' && styles.splitMethodButtonActive
                  ]}
                  onPress={() => setPromoSplitMethod('item_count_percent')}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {splitMethod === 'item_count_percent' && (
                      <Check stroke={Colors.primary} size={14} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[
                      styles.splitMethodButtonText,
                      splitMethod === 'item_count_percent' && styles.splitMethodButtonTextActive
                    ]}>
                      % of Items (Qty)
                    </Text>
                  </View>
                  <Text style={styles.splitMethodButtonSubtext}>By item count</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.splitMethodButton, 
                    splitMethod === 'equal' && styles.splitMethodButtonActive
                  ]}
                  onPress={() => setPromoSplitMethod('equal')}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {splitMethod === 'equal' && (
                      <Check stroke={Colors.primary} size={14} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[
                      styles.splitMethodButtonText,
                      splitMethod === 'equal' && styles.splitMethodButtonTextActive
                    ]}>
                      Split Equally
                    </Text>
                  </View>
                  <Text style={styles.splitMethodButtonSubtext}>Evenly divided</Text>
                </TouchableOpacity>
              </View>

              {/* Promo Breakdown Preview */}
              <View style={styles.promoBreakdownContainer}>
                <Text style={styles.promoBreakdownHeader}>Discount breakdown per person:</Text>
                {totalsByPerson.map(person => (
                  <View key={person.id} style={styles.promoBreakdownItem}>
                    <View style={[styles.miniAvatar, { backgroundColor: person.color }]}>
                      <Text style={styles.miniAvatarText}>{person.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.promoBreakdownName} numberOfLines={1}>{person.name}</Text>
                    <Text style={styles.promoBreakdownPercent}>
                      {splitMethod === 'item_cost_percent' && `${person.discountPercent.toFixed(0)}% of items ($${person.subtotal.toFixed(2)})`}
                      {splitMethod === 'item_count_percent' && `${person.discountPercent.toFixed(0)}% of items (${person.itemCount % 1 === 0 ? person.itemCount : person.itemCount.toFixed(1)} items)`}
                      {splitMethod === 'equal' && `${person.discountPercent.toFixed(0)}% equal share`}
                    </Text>
                    <Text style={styles.promoBreakdownAmount}>-${person.discount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.noPromoContainer}>
              <Text style={styles.noPromoText}>
                Have a coupon or promo code from Uber Eats, DoorDash, or the store? Add it here to discount everyone's share.
              </Text>
            </View>
          )}
        </View>

        {/* Individual Breakdowns */}
        <Text style={styles.sectionTitleOuter}>Who owes what</Text>
        {totalsByPerson.map(person => (
          <View key={person.id} style={styles.personCard}>
            <View style={styles.personHeader}>
              <View style={[styles.avatar, { backgroundColor: person.color }]}>
                <Text style={styles.avatarText}>{person.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personSubtext}>
                  Items: ${person.subtotal.toFixed(2)}  •  Tax/Fees: ${person.additional.toFixed(2)}
                </Text>
                {person.discount > 0 && (
                  <Text style={styles.personPromoSubtext}>
                    Promo: -${person.discount.toFixed(2)} ({person.discountPercent.toFixed(0)}% off)
                  </Text>
                )}
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

      {/* Add / Edit Promo Code Modal */}
      <Modal
        visible={isPromoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPromoModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {receipt.promoDiscount && receipt.promoDiscount > 0 ? 'Edit Promo Code' : 'Add Promo Code'}
              </Text>
              <TouchableOpacity 
                onPress={() => setIsPromoModalVisible(false)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X stroke={Colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            {promoError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{promoError}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Promo Code Name (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. SAVE20 or 20OFF"
                placeholderTextColor={Colors.textLight}
                value={promoCodeInput}
                onChangeText={setPromoCodeInput}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Discount Amount ($)</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textLight}
                  value={promoAmountInput}
                  onChangeText={setPromoAmountInput}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>How should this promo code be split?</Text>
              
              <TouchableOpacity 
                style={[
                  styles.modalOptionCard, 
                  modalSplitMethod === 'item_cost_percent' && styles.modalOptionCardSelected
                ]}
                onPress={() => setModalSplitMethod('item_cost_percent')}
                activeOpacity={0.7}
              >
                <View style={styles.modalOptionRadio}>
                  {modalSplitMethod === 'item_cost_percent' && <View style={styles.modalOptionRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitle}>% of Items (by Item Cost) ★ Recommended</Text>
                  <Text style={styles.modalOptionSubtitle}>
                    Splits discount based on each person's share of item spend ($).
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.modalOptionCard, 
                  modalSplitMethod === 'item_count_percent' && styles.modalOptionCardSelected
                ]}
                onPress={() => setModalSplitMethod('item_count_percent')}
                activeOpacity={0.7}
              >
                <View style={styles.modalOptionRadio}>
                  {modalSplitMethod === 'item_count_percent' && <View style={styles.modalOptionRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitle}>% of Items (by Item Count)</Text>
                  <Text style={styles.modalOptionSubtitle}>
                    Splits discount based on the number of items assigned to each person.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.modalOptionCard, 
                  modalSplitMethod === 'equal' && styles.modalOptionCardSelected
                ]}
                onPress={() => setModalSplitMethod('equal')}
                activeOpacity={0.7}
              >
                <View style={styles.modalOptionRadio}>
                  {modalSplitMethod === 'equal' && <View style={styles.modalOptionRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitle}>Split Equally</Text>
                  <Text style={styles.modalOptionSubtitle}>
                    Divides the promo code equally among participating friends.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              {receipt.promoDiscount && receipt.promoDiscount > 0 ? (
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={handleRemovePromo}
                  activeOpacity={0.7}
                >
                  <Trash2 stroke={Colors.danger} size={18} style={{ marginRight: 6 }} />
                  <Text style={styles.deleteButtonText}>Remove Promo Code</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setIsPromoModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalSaveButton}
                  onPress={handleSavePromo}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalSaveButtonText}>Apply Promo Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    marginBottom: 24,
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
  addPromoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
  },
  addPromoButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  smallActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
  },
  smallActionText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  smallDangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.dangerSoft,
  },
  smallDangerText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  activePromoBanner: {
    backgroundColor: Colors.successSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  promoCodeBadge: {
    backgroundColor: '#059669',
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
    overflow: 'hidden',
  },
  activePromoAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  activePromoDescription: {
    fontSize: 13,
    color: '#047857',
    marginTop: 2,
  },
  splitOptionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitMethodButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  splitMethodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitMethodButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  splitMethodButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  splitMethodButtonTextActive: {
    color: Colors.primary,
  },
  splitMethodButtonSubtext: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  promoBreakdownContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promoBreakdownHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  promoBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  miniAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  promoBreakdownName: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  promoBreakdownPercent: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  promoBreakdownAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.success,
  },
  noPromoContainer: {
    paddingVertical: 8,
  },
  noPromoText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
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
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  personTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  personSubtext: {
    fontSize: 12,
    color: Colors.textLight,
  },
  personPromoSubtext: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  errorBanner: {
    backgroundColor: Colors.dangerSoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: Colors.surface,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    height: 48,
  },
  modalOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 8,
    backgroundColor: Colors.white,
  },
  modalOptionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  modalOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  modalOptionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  modalOptionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  modalActions: {
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.dangerSoft,
    marginBottom: 12,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCancelButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  modalCancelButtonText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1.4,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
