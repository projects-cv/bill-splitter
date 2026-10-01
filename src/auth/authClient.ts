import createSdk, { JWTResponse } from '@descope/core-js-sdk';
import { Platform } from 'react-native';
import { AuthError, AuthSession, normalizePhone } from './authCore';

export const authProjectId = process.env.EXPO_PUBLIC_DESCOPE_PROJECT_ID?.trim() || '';
export const authRedirectUrl = Platform.OS === 'web'
  ? (process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || 'https://cvbillsplitter.netlify.app/')
  : 'billsplitter://login';
export const isAuthConfigured = Boolean(authProjectId);
const sdk = authProjectId ? createSdk({ projectId: authProjectId, cookiePolicy: 'omit',
  fetch: async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try { return await fetch(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  },
}) : null;

function client() {
  if (!sdk) throw new AuthError('Sign-in is not available yet. Please try again later.');
  return sdk;
}

function check<T>(response: { ok: boolean; code?: number; data?: T }, message: string): T {
  if (!response.ok) {
    if (response.code === 429) throw new AuthError('Too many requests. Please wait a minute before trying again.');
    if (!response.code || response.code >= 500) throw new AuthError('Sign-in is temporarily unavailable. Please try again.');
    throw new AuthError(message, [400, 401, 403].includes(response.code || 0));
  }
  return response.data as T;
}

async function toSession(data: JWTResponse, previousToken?: string): Promise<AuthSession> {
  const refreshToken = data.refreshJwt || previousToken;
  if (!data.sessionJwt || !refreshToken || !Number.isFinite(data.sessionExpiration)
    || data.sessionExpiration * 1000 <= Date.now()) throw new AuthError('Please request a new login link.', true);
  const user = data.user || check(await client().me(refreshToken), 'Your session has ended. Please sign in again.');
  if (!user?.userId || !user.phone || !user.verifiedPhone) {
    throw new AuthError('Please sign in with a verified phone number.', true);
  }
  return { user: { id: user.userId, phone: user.phone }, sessionToken: data.sessionJwt,
    refreshToken, expiresAt: data.sessionExpiration * 1000 };
}

export async function sendLoginLink(input: string): Promise<string> {
  const phone = normalizePhone(input);
  check(await client().magicLink.signUpOrIn.sms(phone, authRedirectUrl),
    'We could not send your login text. Please try again later.');
  return phone;
}

export const authApi = {
  async verify(token: string) {
    const response = await client().magicLink.verify(token);
    return toSession(check(response, 'This login link has expired or was already used. Request a new one.'));
  },
  async refresh(token: string) {
    return toSession(check(await client().refresh(token), 'Your session has ended. Please sign in again.'), token);
  },
  async logout(token: string) {
    const response = await client().logout(token);
    if (!response.ok && response.code !== 401) throw new AuthError('Could not end your session.');
  },
};
