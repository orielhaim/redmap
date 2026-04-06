'use client';

import { useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePreferencesStore } from '@/stores/preferences-store';

const DEV_CLICKS = 10;
const DEV_WINDOW_MS = 10_000;

export function useDevModeUnlock() {
  const devModeEnabled = usePreferencesStore((s) => s.devModeEnabled);
  const setDevModeEnabled = usePreferencesStore((s) => s.setDevModeEnabled);
  const clickTimestamps = useRef([]);

  return useCallback(() => {
    if (devModeEnabled) return;

    const now = Date.now();
    clickTimestamps.current.push(now);
    clickTimestamps.current = clickTimestamps.current.filter(
      (t) => now - t <= DEV_WINDOW_MS,
    );

    if (clickTimestamps.current.length >= DEV_CLICKS) {
      clickTimestamps.current = [];
      setDevModeEnabled(true);
    }
  }, [devModeEnabled, setDevModeEnabled]);
}

export default function Settings() {
  const realtimeAlertsEnabled = usePreferencesStore(
    (s) => s.realtimeAlertsEnabled,
  );
  const devModeEnabled = usePreferencesStore((s) => s.devModeEnabled);
  const useTestSocket = usePreferencesStore((s) => s.useTestSocket);
  const setRealtimeAlertsEnabled = usePreferencesStore(
    (s) => s.setRealtimeAlertsEnabled,
  );
  const setDevModeEnabled = usePreferencesStore((s) => s.setDevModeEnabled);
  const setUseTestSocket = usePreferencesStore((s) => s.setUseTestSocket);

  function exitDevMode() {
    setUseTestSocket(false);
    setDevModeEnabled(false);
  }

  return (
    <div className="space-y-5">
      <SettingRow
        id="realtime-alerts"
        label="התראות בזמן אמת"
        description="קבל התראות על אירועי חירום ברגע שהם מתרחשים"
        checked={realtimeAlertsEnabled}
        onCheckedChange={setRealtimeAlertsEnabled}
      />

      {devModeEnabled && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Developer
            </p>
            <button
              type="button"
              onClick={exitDevMode}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Exit dev mode
            </button>
          </div>

          <SettingRow
            id="test-socket"
            label="Test Realtime Alert"
            description="Connect to /test namespace instead of production"
            checked={useTestSocket}
            onCheckedChange={setUseTestSocket}
          />
        </div>
      )}
    </div>
  );
}

function SettingRow({ id, label, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
