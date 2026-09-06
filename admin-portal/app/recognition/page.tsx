'use client';

import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { RecognitionControl } from '../components/governance-ops';

export default function RecognitionPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><RecognitionControl user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
