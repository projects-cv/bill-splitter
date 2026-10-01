import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MessageCircle, Receipt } from 'lucide-react-native';
import { sendLoginLink } from '../auth/authClient';
import { AuthError } from '../auth/authCore';
import { useAuth } from '../store/AuthContext';
import { Colors } from '../theme/colors';

export default function LoginScreen() {
  const { loading, error: authError, canRetry, retry, isConfigured } = useAuth();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const send = async () => {
    if (pending.current || Date.now() < resendAt || !isConfigured) return;
    pending.current = true;
    setSending(true);
    setError(null);
    try {
      const number = await sendLoginLink(phone);
      setSentTo(number);
      setNow(Date.now());
      setResendAt(Date.now() + 60_000);
    } catch (cause) {
      setError(cause instanceof AuthError ? cause.message : 'Could not send your text. Check your connection and try again.');
    } finally { pending.current = false; setSending(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.icon}><Receipt stroke={Colors.primary} size={34} /></View>
            <Text style={styles.brand}>Bill Splitter</Text>
            <Text style={styles.title}>{loading ? 'One moment…' : sentTo ? 'Check your texts' : 'Split the bill. Skip the hassle.'}</Text>
            {loading ? <ActivityIndicator color={Colors.primary} size="large" accessibilityLabel="Checking your session" /> : (
              <>
                <Text style={styles.description}>
                  {sentTo ? `We sent a login link to ${sentTo}. Tap it to finish signing in.`
                    : 'Enter your phone number to sign up or log in. We’ll text you a secure link—no password needed.'}
                </Text>
                {sentTo ? (
                  <View style={styles.sentNote}>
                    <MessageCircle stroke={Colors.primary} size={22} />
                    <Text style={styles.noteText}>Open the link on the device where you want to use Bill Splitter.</Text>
                  </View>
                ) : (
                  <View style={styles.field}>
                    <Text style={styles.label}>Phone number</Text>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={value => { setPhone(value); setError(null); }}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      placeholder="+1 415 555 0123"
                      placeholderTextColor={Colors.textLight}
                      accessibilityLabel="Phone number including country code"
                      editable={!sending}
                      returnKeyType="send"
                      onSubmitEditing={() => { void send(); }}
                    />
                    <Text style={styles.hint}>Include your country code (for example, +1 for the US).</Text>
                  </View>
                )}
                {(error || authError || !isConfigured) && (
                  <Text style={styles.error} accessibilityRole="alert">
                    {error || authError || 'Sign-in is not available yet. Please try again later.'}
                  </Text>
                )}
                {canRetry && (
                  <TouchableOpacity style={styles.secondary} accessibilityRole="button" onPress={() => { void retry(); }}>
                    <Text style={styles.secondaryText}>Try again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.primary, (sending || remaining > 0 || !isConfigured) && styles.disabled]}
                  disabled={sending || remaining > 0 || !isConfigured}
                  accessibilityRole="button"
                  onPress={() => { void send(); }}
                >
                  {sending ? <ActivityIndicator color={Colors.white} /> : (
                    <Text style={styles.primaryText}>{remaining > 0 ? `Resend in ${remaining}s` : sentTo ? 'Resend login link' : 'Text me a login link'}</Text>
                  )}
                </TouchableOpacity>
                {sentTo && (
                  <TouchableOpacity style={styles.secondary} disabled={sending} accessibilityRole="button" onPress={() => { setSentTo(null); setError(null); }}>
                    <Text style={styles.secondaryText}>Use a different number</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.finePrint}>By continuing, you agree to receive a text for this login. Message and data rates may apply.</Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440 },
  icon: { width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  brand: { fontSize: 16, color: Colors.primary, fontWeight: '700', marginBottom: 12 },
  title: { fontSize: 30, lineHeight: 36, color: Colors.text, fontWeight: '700', marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 24, color: Colors.textMuted, marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  input: { height: 56, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, fontSize: 18, color: Colors.text, backgroundColor: Colors.surface },
  hint: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  primary: { height: 56, backgroundColor: Colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  error: { color: Colors.danger, backgroundColor: Colors.dangerSoft, padding: 12, borderRadius: 8, marginBottom: 16, lineHeight: 20 },
  sentNote: { flexDirection: 'row', gap: 12, backgroundColor: Colors.primarySoft, padding: 16, borderRadius: 12, marginBottom: 24 },
  noteText: { flex: 1, color: Colors.textMuted, lineHeight: 21 },
  finePrint: { fontSize: 12, lineHeight: 18, color: Colors.textMuted, marginTop: 20, textAlign: 'center' },
});
