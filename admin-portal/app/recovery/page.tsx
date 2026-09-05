'use client';

import { AccShell } from '../acc-shell';
import { AuthGate } from '../auth-gate';
import { RecoveryControlCenter } from '../components/recovery-control-center';

export default function RecoveryPage() {
  return (
    <AuthGate>
      {(session) => (
        <AccShell role={session.role}>
          <RecoveryControlCenter user={session.user} role={session.role} />
        </AccShell>
      )}
    </AuthGate>
  );
}
