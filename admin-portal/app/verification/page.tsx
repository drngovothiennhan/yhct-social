import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { VerificationQueue } from '../components/verification-queue';

export default function VerificationPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><VerificationQueue user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
