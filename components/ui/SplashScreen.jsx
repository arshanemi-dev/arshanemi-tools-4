'use client';

import { useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';

const noopSubscribe = () => () => {};

// Brief full-screen loader shown while the app boots — was previously an
// elaborate multi-second cycling-project-names splash; simplified to just a
// spinner that clears as soon as the page is ready to interact with.
// "Hydrated yet?" without setState-in-effect: the server snapshot (false)
// renders the spinner into the HTML, the client snapshot (true) clears it
// right after hydration.
export default function SplashScreen() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (hydrated) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 text-accent animate-spin" />
    </div>
  );
}
