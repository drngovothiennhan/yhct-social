export type AuditRole = 'mod' | 'super_mod' | 'admin';
export type AuditTargetType = 'post' | 'comment' | 'report' | 'verification' | 'member' | 'system' | 'recovery';

export interface AuditEventInput {
  operationId: string;
  actorUid: string;
  actorRole: AuditRole;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

function cleanText(value: string, field: string, max: number): string {
  const result = value.trim();
  if (!result || result.length > max || result.includes('/')) throw new Error(`${field.toUpperCase()}_INVALID`);
  return result;
}

export function buildAuditEvent(input: AuditEventInput) {
  return {
    operationId: cleanText(input.operationId, 'operationId', 120),
    actorUid: cleanText(input.actorUid, 'actorUid', 128),
    actorRole: input.actorRole,
    action: cleanText(input.action, 'action', 100),
    targetType: input.targetType,
    targetId: cleanText(input.targetId, 'targetId', 256),
    reason: cleanText(input.reason, 'reason', 2000),
    before: input.before,
    after: input.after,
  };
}
