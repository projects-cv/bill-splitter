export type AuthSession = {
  user: { id: string; phone: string };
  sessionToken: string;
  refreshToken: string;
  expiresAt: number;
};

export class AuthError extends Error {
  constructor(message: string, public invalidSession = false) { super(message); }
}

export function normalizePhone(input: string): string {
  const phone = input.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new AuthError('Enter your phone number with its country code, like +1 415 555 0123.');
  }
  return phone;
}

export function getLoginToken(url: string | null, redirectUrl: string): string | null {
  if (!url) return null;
  try {
    const incoming = new URL(url);
    const expected = new URL(redirectUrl);
    if (incoming.protocol !== expected.protocol || incoming.host !== expected.host
      || incoming.pathname !== expected.pathname || incoming.username || incoming.password) return null;
    const tokens = incoming.searchParams.getAll('t');
    return tokens.length === 1 && tokens[0].length > 0 && tokens[0].length <= 4096 ? tokens[0] : null;
  } catch { return null; }
}

type AuthApi = {
  verify: (token: string) => Promise<AuthSession>;
  refresh: (token: string) => Promise<AuthSession>;
  logout: (token: string) => Promise<void>;
};
type TokenStorage = {
  read: () => Promise<string | null>;
  write: (token: string | null) => Promise<void>;
};
type AuthState = { session: AuthSession | null; loading: boolean; error: string | null; canRetry: boolean };

// Keep authentication transitions independent of React renders. In-flight requests
// cannot restore a session after logout or replace a newer login.
export class AuthManager {
  private state: AuthState = { session: null, loading: true, error: null, canRetry: false };
  private listeners = new Set<() => void>();
  private generation = 0;
  private refreshInFlight = false;
  private pendingToken: string | null = null;
  private lastToken: string | null = null;
  private pendingSignOut: string | null | undefined;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private api: AuthApi, private storage: TokenStorage) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private publish(state: AuthState) {
    this.state = state;
    clearTimeout(this.expiryTimer);
    if (state.session) {
      this.expiryTimer = setTimeout(() => {
        this.publish({ session: null, loading: false, error: 'Your session needs to be refreshed. Please reconnect to continue.', canRetry: true });
      }, Math.max(0, state.session.expiresAt - Date.now()));
    }
    this.listeners.forEach(listener => listener());
  }

  private async accept(session: AuthSession, generation: number) {
    if (generation !== this.generation) return;
    await this.storage.write(session.refreshToken);
    if (generation !== this.generation) return;
    this.pendingToken = null;
    this.pendingSignOut = undefined;
    this.publish({ session, loading: false, error: null, canRetry: false });
  }

  private async fail(error: unknown, generation: number, preserveSession = false) {
    if (generation !== this.generation) return;
    const invalid = error instanceof AuthError && error.invalidSession;
    if (invalid) {
      this.pendingToken = null;
      await this.storage.write(null).catch(() => undefined);
    }
    if (generation !== this.generation) return;
    const session = preserveSession && !invalid && this.state.session && this.state.session.expiresAt > Date.now()
      ? this.state.session : null;
    this.publish({ session, loading: false,
      error: error instanceof AuthError ? error.message : 'Could not connect to sign-in. Please try again.',
      canRetry: !invalid });
  }

  restore = async () => {
    const generation = ++this.generation;
    this.publish({ session: null, loading: true, error: null, canRetry: false });
    try {
      const token = await this.storage.read();
      if (generation !== this.generation) return;
      if (!token) { this.publish({ session: null, loading: false, error: null, canRetry: false }); return; }
      await this.accept(await this.api.refresh(token), generation);
    } catch (error) { await this.fail(error, generation); }
  };

  verify = async (token: string, retry = false) => {
    if (token === this.lastToken && !retry) return;
    this.lastToken = token;
    this.pendingToken = token;
    const generation = ++this.generation;
    this.publish({ session: null, loading: true, error: null, canRetry: false });
    try { await this.accept(await this.api.verify(token), generation); }
    catch (error) { await this.fail(error, generation); }
  };

  retry = () => this.pendingSignOut !== undefined ? this.signOut()
    : this.pendingToken ? this.verify(this.pendingToken, true) : this.restore();

  refreshIfNeeded = async () => {
    const session = this.state.session;
    if (!session || session.expiresAt - Date.now() > 60_000 || this.refreshInFlight) return;
    this.refreshInFlight = true;
    const generation = this.generation;
    try { await this.accept(await this.api.refresh(session.refreshToken), generation); }
    catch (error) { await this.fail(error, generation, true); }
    finally { this.refreshInFlight = false; }
  };

  signOut = async () => {
    const token = this.pendingSignOut ?? this.state.session?.refreshToken ?? null;
    this.pendingSignOut = token;
    const generation = ++this.generation;
    this.pendingToken = null;
    this.publish({ session: null, loading: true, error: null, canRetry: false });
    try {
      await this.storage.write(null);
      if (token) await this.api.logout(token);
      if (generation === this.generation) {
        this.pendingSignOut = undefined;
        this.publish({ session: null, loading: false, error: null, canRetry: false });
      }
    } catch {
      if (generation === this.generation) this.publish({ session: null, loading: false,
        error: 'Could not finish signing out. Please reconnect and try again.', canRetry: true });
    }
  };

  dispose = () => { ++this.generation; clearTimeout(this.expiryTimer); };
}
