import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { AuditTable } from '../components/audit-table';

export default function AuditPage() {
  return <AuthGate>{(session) => <AccShell role={session.role}><AuditTable user={session.user} role={session.role} /></AccShell>}</AuthGate>;
}
