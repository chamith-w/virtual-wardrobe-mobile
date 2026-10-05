import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';

import { db } from './client';
import migrations from './migrations/migrations';
import { hasAnyWardrobe, seedDemoWardrobe } from './seed';

type Status = 'migrating' | 'seeding' | 'ready' | 'error';

/**
 * Runs migrations, then loads the demo wardrobe on first launch. Children
 * render only once the database is ready; until then the splash stays up.
 *
 * Phase 1 auto-seeds so every screen has data. Once onboarding exists it will
 * offer "Load demo wardrobe" vs "Start empty" instead.
 */
export function DatabaseGate({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  const { success, error: migrationError } = useMigrations(db, migrations);
  const [status, setStatus] = useState<Status>('migrating');
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus('seeding');
        if (!(await hasAnyWardrobe())) await seedDemoWardrobe();
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, attempt]);

  const failure = migrationError ?? error;

  useEffect(() => {
    if (status === 'ready' || failure) onReady();
  }, [status, failure, onReady]);

  if (failure) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-6">
        <Text variant="eyebrow" tone="danger">
          Database
        </Text>
        <Text variant="display3">Your closet couldn’t open.</Text>
        <Text variant="bodySm" tone="muted" selectable>
          {failure.message}
        </Text>
        <Button
          label="Try again"
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  if (status !== 'ready') return null;
  return children;
}
