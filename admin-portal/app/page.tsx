import { AccShell } from './acc-shell';
import { AuthGate } from './auth-gate';
import { Dashboard } from './dashboard';

export default function Page() {
  return <AuthGate>{(session) => <AccShell role={session.role}><Dashboard user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
