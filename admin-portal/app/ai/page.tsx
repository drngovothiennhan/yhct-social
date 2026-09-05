'use client';

import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { AiControlCenter } from '../components/ai-control-center';

export default function AiPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><AiControlCenter user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
