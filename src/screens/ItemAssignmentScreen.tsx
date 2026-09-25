import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ScrollView, 
  SafeAreaView, 
  Modal, 
  TextInput, 
  Alert, 
  Platform, 
  KeyboardAvoidingView 
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, LineItem } from '../types';
import { useReceipt } from '../store/ReceiptContext';
import { Colors } from '../theme/colors';
import { Check, ArrowRight, Plus, Pencil, Trash2, X } from 'lucide-react-native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ItemAssignment'>;
};

export default function ItemAssignmentScreen({ navigation }: Props) {
  const { receipt, assignItem, unassignItem, addItem, updateItem, removeItem } = useReceipt();
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(
    receipt?.participants?.[0]?.id || null
  );

  // Item edit / add modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [selectedItemToEdit, setSelectedItemToEdit] = useState<LineItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!receipt) return null;

  const toggleAssignment = (itemId: string, assignedTo: string[]) => {
    if (!selectedParticipantId) return;
    
    if (assignedTo.includes(selectedParticipantId)) {
      unassignItem(itemId, selectedParticipantId);
    } else {
      assignItem(itemId, selectedParticipantId);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedItemToEdit(null);
    setNameInput('');
    setPriceInput('');
    setErrorMessage(null);
    setModalMode('add');
  };

  const handleOpenEditModal = (item: LineItem) => {
    setSelectedItemToEdit(item);
    setNameInput(item.name);
    setPriceInput(item.price.toFixed(2));
    setErrorMessage(null);
    setModalMode('edit');
  };

  const handleSaveItem = () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter an item name');
      return;
    }

    const cleanedPriceStr = priceInput.replace(/[^0-9.]/g, '');
    const parsedPrice = parseFloat(cleanedPriceStr);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMessage('Please enter a valid price (e.g. 9.99)');
      return;
    }

    if (modalMode === 'add') {
      addItem(trimmedName, parsedPrice);
    } else if (modalMode === 'edit' && selectedItemToEdit) {
      updateItem(selectedItemToEdit.id, {
        name: trimmedName,
        price: parsedPrice,
      });
    }

    setModalMode(null);
    setSelectedItemToEdit(null);
  };

  const handleDeleteItem = () => {
    if (!selectedItemToEdit) return;

    const performDelete = () => {
      removeItem(selectedItemToEdit.id);
      setModalMode(null);
      setSelectedItemToEdit(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove "${selectedItemToEdit.name}"?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Remove Item',
        `Are you sure you want to remove "${selectedItemToEdit.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const handleNext = () => {
    navigation.navigate('Summary', {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.title}>Tap items to claim</Text>
            <Text style={styles.subtitle}>Select a person and tap their items.</Text>
          </View>
          <TouchableOpacity 
            style={styles.headerAddButton}
            onPress={handleOpenAddModal}
            activeOpacity={0.8}
          >
            <Plus stroke="#fff" size={18} style={{ marginRight: 4 }} />
            <Text style={styles.headerAddButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Participants Horizontal List */}
      <View style={styles.participantsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsScroll}>
          {receipt.participants.map(p => {
            const isSelected = p.id === selectedParticipantId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.participantPill,
                  isSelected && styles.participantPillSelected,
                  { borderColor: p.color }
                ]}
                onPress={() => setSelectedParticipantId(p.id)}
              >
                <View style={[styles.avatar, { backgroundColor: p.color }]}>
                  <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.participantName, isSelected && styles.participantNameSelected]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Items Vertical List */}
      <FlatList
        data={receipt.items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.itemsList}
        renderItem={({ item }) => {
          const isAssignedToSelected = selectedParticipantId && item.assignedTo.includes(selectedParticipantId);
          const assignedParticipants = item.assignedTo.map(id => 
            receipt.participants.find(p => p.id === id)
          ).filter(Boolean);

          return (
            <View 
              key={item.id}
              style={[
                styles.itemCard,
                isAssignedToSelected && styles.itemCardSelected
              ]}
            >
              <TouchableOpacity 
                style={styles.itemMainTouchable}
                activeOpacity={0.7}
                onPress={() => toggleAssignment(item.id, item.assignedTo)}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                </View>

                <View style={styles.assignmentArea}>
                  {assignedParticipants.length > 0 ? (
                    <View style={styles.assignedAvatars}>
                      {assignedParticipants.map((p, index) => p && (
                        <View 
                          key={p.id} 
                          style={[
                            styles.smallAvatar, 
                            { backgroundColor: p.color, marginLeft: index > 0 ? -10 : 0 }
                          ]}
                        >
                          <Text style={styles.smallAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.checkbox}>
                      {isAssignedToSelected && <Check stroke="#fff" size={16} />}
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleOpenEditModal(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Pencil stroke={Colors.textMuted} size={18} />
              </TouchableOpacity>
            </View>
          );
        }}
        ListFooterComponent={
          receipt.items.length > 0 ? (
            <TouchableOpacity 
              style={styles.addMoreButton} 
              onPress={handleOpenAddModal}
              activeOpacity={0.7}
            >
              <Plus stroke={Colors.primary} size={18} style={{ marginRight: 6 }} />
              <Text style={styles.addMoreButtonText}>Add Missing Item</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No items found</Text>
            <Text style={styles.emptyStateSubtitle}>
              The OCR scan didn't find any items on this receipt. You can add items manually.
            </Text>
            <TouchableOpacity 
              style={styles.emptyAddButton} 
              onPress={handleOpenAddModal}
              activeOpacity={0.8}
            >
              <Plus stroke="#fff" size={18} style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddButtonText}>Add First Item</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add / Edit Item Modal */}
      <Modal
        visible={modalMode !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalMode(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? 'Add Item' : 'Edit Item'}
              </Text>
              <TouchableOpacity 
                onPress={() => setModalMode(null)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X stroke={Colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Item Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Cheeseburger"
                placeholderTextColor={Colors.textLight}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus={true}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Price ($)</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textLight}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveItem}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              {modalMode === 'edit' && (
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={handleDeleteItem}
                  activeOpacity={0.7}
                >
                  <Trash2 stroke={Colors.danger} size={18} style={{ marginRight: 6 }} />
                  <Text style={styles.deleteButtonText}>Remove Item</Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setModalMode(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalSaveButton}
                  onPress={handleSaveItem}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalSaveButtonText}>
                    {modalMode === 'add' ? 'Add Item' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Calculate Totals</Text>
          <ArrowRight stroke="#fff" size={20} style={{ marginLeft: 8 }} />
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  headerAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  participantsContainer: {
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  participantsScroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  participantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 2,
    marginRight: 12,
    backgroundColor: Colors.white,
  },
  participantPillSelected: {
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  participantNameSelected: {
    color: Colors.text,
  },
  itemsList: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  itemCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  itemMainTouchable: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  assignmentArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  assignedAvatars: {
    flexDirection: 'row',
  },
  smallAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  smallAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  editButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderStyle: 'dashed',
    backgroundColor: Colors.primarySoft,
    marginTop: 4,
    marginBottom: 16,
  },
  addMoreButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
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
    maxWidth: 400,
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
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
