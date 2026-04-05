'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Home,
  Map as MapIcon,
  TrendingUp,
  Settings,
  AlertTriangle,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import SettingsContent from '@/components/settings/settings';

const NAV_LINKS = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/map', label: 'Map', icon: MapIcon },
  { href: '/prediction', label: 'Prediction', icon: TrendingUp },
];

function NavLink({ href, label, icon: Icon, onClick }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {isActive && (
        <motion.span
          layoutId="nav-indicator"
          className="absolute inset-0 rounded-md bg-white/8"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <Icon size={15} className="relative z-10 shrink-0" />
      <span className="relative z-10">{label}</span>
      {isActive && (
        <span className="absolute bottom-0 left-3 right-3 h-px bg-primary rounded-full" />
      )}
    </Link>
  );
}

function SettingsTrigger() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    if (window.innerWidth >= 768) {
      setDialogOpen(true);
    } else {
      router.push('/settings');
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
        aria-label="Settings"
        type="button"
      >
        <Settings size={16} />
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Settings
            </DialogTitle>
          </DialogHeader>
          <SettingsContent />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex items-center justify-center size-7 rounded-md bg-primary/15 border border-primary/30">
            <AlertTriangle
              size={14}
              className="text-primary fill-primary/20"
              strokeWidth={2}
            />
            <span className="absolute inset-0 rounded-md bg-primary/10 animate-pulse" />
          </div>
          <span className="font-semibold text-sm tracking-tight">
            Red<span className="text-primary">Map</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <SettingsTrigger />

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="md:hidden flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
              aria-label="Menu"
              type="button"
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-64 bg-card border-border pt-12"
            >
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    {...link}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
