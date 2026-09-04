import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { SystemPanel } from '../dashboard';

export default function SystemPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><SystemPanel user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
