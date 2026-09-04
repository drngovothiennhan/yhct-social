'use client';

import { PortalShell } from '@/components/portal/portal-shell';
import { SocialFeed } from '@/components/portal/social-feed';

export function AppShell() {
  return <PortalShell><SocialFeed /></PortalShell>;
}
