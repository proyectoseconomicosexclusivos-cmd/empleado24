'use client';

import { usePathname } from 'next/navigation';
import { HelpCenter } from '@/components/help-center';

export function PublicCopilot() {
  const pathname = usePathname();
  if (pathname.startsWith('/app') || pathname.startsWith('/ops')) return null;
  return <HelpCenter />;
}
