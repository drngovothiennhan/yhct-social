'use client';

import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { SecurityPanel } from '../dashboard';

export default function SecurityPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><SecurityPanel user={session.user} /></AccShell>}</AuthGate>;
}
