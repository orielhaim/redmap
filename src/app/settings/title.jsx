'use client';

import { useDevModeUnlock } from '@/components/settings/settings';

export default function SettingsPageTitle() {
  const handleClick = useDevModeUnlock();

  return (
    <button
      type="button"
      className="text-lg font-semibold cursor-default select-none text-left p-0 bg-transparent border-0"
      onClick={handleClick}
    >
      Settings
    </button>
  );
}
