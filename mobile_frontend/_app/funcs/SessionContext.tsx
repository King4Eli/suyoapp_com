// SessionManager.ts
export type SessionTypes = {
  x_omi_payload: string | null;
  x_omi_payload_hash: string | null;
};

type Subscriber = (session: SessionTypes | null) => void;

class SessionManager {
  private static instance: SessionManager;
  private session: SessionTypes | null = null;
  private subscribers: Subscriber[] = [];

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Get current session (sync)
  getCurrentSession(): SessionTypes | null {
    return this.session;
  }

  // Update session and notify subscribers
  async updateSession(newSession: SessionTypes | null) {
    this.session = newSession;
    this.notifySubscribers();
  }

  // Subscribe to session changes
  subscribe(callback: Subscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this.session));
  }
}

export const sessionManager = SessionManager.getInstance();