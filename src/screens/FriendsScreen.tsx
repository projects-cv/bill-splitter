import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useReceipt } from '../store/ReceiptContext';
import { Colors, ParticipantColors } from '../theme/colors';
import { Plus, X, ArrowRight, User } from 'lucide-react-native';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Friends'>;
};

export default function FriendsScreen({ navigation }: Props) {
  const { receipt, addParticipant, removeParticipant } = useReceipt();
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      // Pick a random color for the participant avatar
      const color = ParticipantColors[Math.floor(Math.random() * ParticipantColors.length)];
      addParticipant(name.trim(), color);
      setName('');
    }
  };

  const handleNext = () => {
    if (receipt?.participants.length && receipt.participants.length > 0) {
      navigation.navigate('ItemAssignment', {});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Who's paying?</Text>
          <Text style={styles.subtitle}>Add everyone involved in this bill.</Text>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <User stroke={Colors.textLight} size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter friend's name"
              placeholderTextColor={Colors.textLight}
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
          </View>
          <TouchableOpacity 
            style={[styles.addButton, !name.trim() && styles.addButtonDisabled]} 
            onPress={handleAdd}
            disabled={!name.trim()}
          >
            <Plus stroke="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={receipt?.participants || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No friends added yet.</Text>
              <Text style={styles.emptyStateSubtext}>Add yourself and others to split the items.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.participantCard}>
              <View style={styles.participantInfo}>
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.participantName}>{item.name}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => removeParticipant(item.id)}
                style={styles.removeButton}
              >
                <X stroke={Colors.textLight} size={20} />
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[
              styles.nextButton, 
              (!receipt?.participants || receipt.participants.length === 0) && styles.nextButtonDisabled
            ]}
            onPress={handleNext}
            disabled={!receipt?.participants || receipt.participants.length === 0}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <ArrowRight stroke="#fff" size={20} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: Colors.text,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  removeButton: {
    padding: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 0 : 24,
    paddingTop: 16,
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
  nextButtonDisabled: {
    backgroundColor: Colors.border,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
