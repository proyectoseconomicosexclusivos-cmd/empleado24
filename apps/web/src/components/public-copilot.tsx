'use client';

import { usePathname } from 'next/navigation';
import { HelpCenter } from '@/components/help-center';
import { LauraSalesAssistant } from '@/components/laura-sales-assistant';

export function PublicCopilot() {
  const pathname = usePathname();
  if (pathname.startsWith('/app') || pathname.startsWith('/ops')) return null;
  if (pathname === '/') return <LauraSalesAssistant />;
  return <HelpCenter />;
}
