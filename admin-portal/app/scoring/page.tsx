'use client';

import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { ScoringControl } from '../components/governance-ops';

export default function ScoringPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><ScoringControl user={session.user} /></AccShell>}</AuthGate>;
}
