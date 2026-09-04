export interface CommentTimestampLike {
  toDate(): Date;
}

export interface FlatComment {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  authorPhotoURL: string;
  parentId: string;
  depth: number;
  content: string;
  status: 'active' | 'hidden' | 'deleted';
  createdAt: CommentTimestampLike | null;
  updatedAt: CommentTimestampLike | null;
}

export interface CommentNode extends FlatComment {
  children: CommentNode[];
}

export function getReplyDepth(parentDepth: number): number {
  if (!Number.isInteger(parentDepth) || parentDepth < 0) {
    throw new Error('Độ sâu bình luận không hợp lệ.');
  }

  if (parentDepth >= 3) {
    throw new Error('Đã đạt độ sâu thảo luận tối đa.');
  }

  return parentDepth + 1;
}

export function buildCommentTree(comments: FlatComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();

  for (const comment of comments) {
    byId.set(comment.id, { ...comment, children: [] });
  }

  const roots: CommentNode[] = [];

  for (const comment of comments) {
    const node = byId.get(comment.id);
    if (!node) continue;

    if (!comment.parentId) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(comment.parentId);
    if (parent && comment.depth === parent.depth + 1) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
