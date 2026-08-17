'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Brief full-screen loader shown while the app boots — was previously an
// elaborate multi-second cycling-project-names splash; simplified to just a
// spinner that clears as soon as the page is ready to interact with.
export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 text-accent animate-spin" />
    </div>
  );
}
