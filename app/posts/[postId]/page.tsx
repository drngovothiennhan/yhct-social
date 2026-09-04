import { PortalShell } from '@/components/portal/portal-shell';
import { PostDetailScreen } from '@/components/portal/post-detail-screen';

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <PortalShell><PostDetailScreen postId={postId} /></PortalShell>;
}
