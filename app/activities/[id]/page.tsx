import { PortalShell } from '@/components/portal/portal-shell';
import { ActivityDetailScreen } from '@/components/portal/activity-screens';

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalShell><ActivityDetailScreen activityId={id} /></PortalShell>;
}
