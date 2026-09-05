'use client';

import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { MembersPanel } from '../dashboard';

export default function MembersPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><MembersPanel user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
