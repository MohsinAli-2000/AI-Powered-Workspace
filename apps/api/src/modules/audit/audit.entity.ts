export interface AuditLog {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface AuditActor {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogWithActor extends AuditLog {
  actor?: AuditActor | null;
}

export interface CreateAuditLogInput {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogFilterOptions {
  action?: string;
  resourceType?: string;
  actorUserId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
