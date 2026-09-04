import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { ModerationQueue } from '../components/moderation-queue';

export default function ModerationPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><ModerationQueue user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
