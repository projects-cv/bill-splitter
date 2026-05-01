import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useReceipt } from '../store/ReceiptContext';
import { Colors } from '../theme/colors';
import { Check, ArrowRight } from 'lucide-react-native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ItemAssignment'>;
};

export default function ItemAssignmentScreen({ navigation }: Props) {
  const { receipt, assignItem, unassignItem } = useReceipt();
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(
    receipt?.participants?.[0]?.id || null
  );

  if (!receipt) return null;

  const toggleAssignment = (itemId: string, assignedTo: string[]) => {
    if (!selectedParticipantId) return;
    
    if (assignedTo.includes(selectedParticipantId)) {
      unassignItem(itemId, selectedParticipantId);
    } else {
      assignItem(itemId, selectedParticipantId);
    }
  };

  const handleNext = () => {
    navigation.navigate('Summary', {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tap items to claim</Text>
        <Text style={styles.subtitle}>Select a person and tap their items.</Text>
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
            <TouchableOpacity 
              style={[
                styles.itemCard,
                isAssignedToSelected && styles.itemCardSelected
              ]}
              activeOpacity={0.7}
              onPress={() => toggleAssignment(item.id, item.assignedTo)}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
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
          );
        }}
      />

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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
  itemInfo: {
    flex: 1,
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
});
