import { useState, useEffect } from "react";

const STORAGE_KEY = "elo_rater_session";

interface StoredSession {
  token: string;
  name: string;
  roomCode: string;
}

export function useRaterSession() {
  const [session, setSession] = useState<StoredSession | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const save = (data: StoredSession) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  return { session, save, clear };
}
