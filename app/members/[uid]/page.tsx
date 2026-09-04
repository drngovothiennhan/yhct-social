import { PortalShell } from '@/components/portal/portal-shell';
import { MemberProfileScreen } from '@/components/portal/member-screens';

export default async function MemberPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return <PortalShell><MemberProfileScreen uid={uid} /></PortalShell>;
}
