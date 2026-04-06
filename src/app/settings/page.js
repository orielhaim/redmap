import SettingsContent from '@/components/settings/settings';
import { Settings } from 'lucide-react';
import SettingsPageTitle from './title';

export const metadata = {
  title: 'Settings - RedMap',
};

export default function SettingsPage() {
  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center size-9 rounded-lg bg-muted border border-border">
          <Settings size={16} className="text-muted-foreground" />
        </div>
        <div>
          <SettingsPageTitle />
          <p className="text-sm text-muted-foreground">
            Configure your dashboard preferences
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <SettingsContent />
      </div>
    </div>
  );
}
