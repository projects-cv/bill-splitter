import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { useReceipt } from '../store/ReceiptContext';
import { Colors } from '../theme/colors';

export default function PaymentDetailsButton() {
  const { session, requestLogin } = useAuth();
  const { paymentDetails, savePaymentDetails, isPaymentLoading, paymentError } = useReceipt();
  const [visible, setVisible] = useState(false);
  const [venmo, setVenmo] = useState('');
  const [zelle, setZelle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = () => {
    if (!session) { requestLogin(); return; }
    setVenmo(paymentDetails.venmo); setZelle(paymentDetails.zelle); setError(null); setVisible(true);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try { await savePaymentDetails({ venmo, zelle }); setVisible(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save payment details. Please try again.'); }
    finally { setSaving(false); }
  };
  return <>
    <TouchableOpacity style={styles.button} accessibilityRole="button" onPress={open} disabled={isPaymentLoading}>
      <Text style={styles.link}>{session ? 'Payment details' : 'Sign in to add Venmo / Zelle'}</Text>
    </TouchableOpacity>
    <Modal visible={visible && !!session} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Payment details</Text>
          <Text style={styles.description}>Include these in your text requests. Saved for your account on this device.</Text>
          <Text style={styles.label}>Venmo username (optional)</Text>
          <TextInput style={styles.input} accessibilityLabel="Venmo username" value={venmo} onChangeText={setVenmo} placeholder="@your-name" autoCapitalize="none" autoCorrect={false} editable={!saving} />
          <Text style={styles.label}>Zelle email or phone (optional)</Text>
          <TextInput style={styles.input} accessibilityLabel="Zelle email or phone" value={zelle} onChangeText={setZelle} placeholder="Email or phone number" autoCapitalize="none" autoCorrect={false} editable={!saving} />
          {(error || paymentError) && <Text style={styles.error} accessibilityRole="alert">{error || paymentError}</Text>}
          <TouchableOpacity style={styles.button} accessibilityRole="button" disabled={saving} onPress={() => { void save(); }}><Text style={styles.link}>{saving ? 'Saving…' : 'Save payment details'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.button} accessibilityRole="button" disabled={saving} onPress={() => setVisible(false)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </View>
      </ScrollView></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center' },
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.white, padding: 24, borderRadius: 20, width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: { color: Colors.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  description: { color: Colors.textMuted, lineHeight: 22, marginBottom: 16 },
  label: { color: Colors.text, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, marginBottom: 16, color: Colors.text, backgroundColor: Colors.surface },
  error: { color: Colors.danger, marginBottom: 12 },
});
