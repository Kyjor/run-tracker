import React, { createContext, useContext, useEffect, useState } from 'react';
import type Database from '@tauri-apps/plugin-sql';
import { getDatabase } from '../services/database';

interface DatabaseContextValue {
  db: Database | null;
  isReady: boolean;
  error: string | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({ db: null, isReady: false, error: null });

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDatabase()
      .then(d => { setDb(d); setIsReady(true); })
      .catch(e => setError(String(e)));
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  return useContext(DatabaseContext);
}

/** Throws if db is not ready — use inside components that gate on DatabaseProvider */
export function useDb(): Database {
  const { db } = useContext(DatabaseContext);
  if (!db) throw new Error('Database not ready');
  return db;
}

