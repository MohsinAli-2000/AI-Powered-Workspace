import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type { OrganizationRole } from '../organizations/organization.entity.js';
import type { ProjectRole } from '../projects/project.entity.js';
import type {
  DocumentEffect,
  DocumentUserAccess,
  DocumentGroupAccess,
  DocumentOrgRoleAccess,
  DocumentProjectRoleAccess,
  DocumentAccessRulesSummary,
  AccessEvaluationResult,
} from './document-access.entity.js';
import type { DocumentAccessMode } from './document.entity.js';

export class DocumentAccessRepository extends BaseRepository<DocumentUserAccess> {
  protected readonly tableName = 'document_user_access';

  // ---------------------------------------------------------------------------
  // 1. User Access Rules
  // ---------------------------------------------------------------------------

  public async upsertUserAccess(
    documentId: string,
    userId: string,
    effect: DocumentEffect,
    client?: PoolClient
  ): Promise<DocumentUserAccess> {
    const sql = `
      INSERT INTO document_user_access (document_id, user_id, effect)
      VALUES ($1, $2, $3)
      ON CONFLICT (document_id, user_id)
      DO UPDATE SET effect = EXCLUDED.effect
      RETURNING *;
    `;
    const rows = await this.query<DocumentUserAccess>(
      sql,
      [documentId, userId, effect],
      client
    );
    return rows[0];
  }

  public async removeUserAccess(
    documentId: string,
    userId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      DELETE FROM document_user_access
      WHERE document_id = $1 AND user_id = $2;
    `;
    const result = await this.execute(sql, [documentId, userId], client);
    return (result.rowCount ?? 0) > 0;
  }

  public async listUserAccess(
    documentId: string,
    client?: PoolClient
  ): Promise<DocumentUserAccess[]> {
    const sql = `
      SELECT
        dua.id,
        dua.document_id,
        dua.user_id,
        dua.effect,
        dua.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM document_user_access dua
      JOIN users u ON dua.user_id = u.id
      WHERE dua.document_id = $1
      ORDER BY dua.created_at ASC;
    `;
    return this.query<DocumentUserAccess>(sql, [documentId], client);
  }

  // ---------------------------------------------------------------------------
  // 2. Group Access Rules
  // ---------------------------------------------------------------------------

  public async upsertGroupAccess(
    documentId: string,
    groupId: string,
    effect: DocumentEffect,
    client?: PoolClient
  ): Promise<DocumentGroupAccess> {
    const sql = `
      INSERT INTO document_group_access (document_id, group_id, effect)
      VALUES ($1, $2, $3)
      ON CONFLICT (document_id, group_id)
      DO UPDATE SET effect = EXCLUDED.effect
      RETURNING *;
    `;
    const rows = await this.query<DocumentGroupAccess>(
      sql,
      [documentId, groupId, effect],
      client
    );
    return rows[0];
  }

  public async removeGroupAccess(
    documentId: string,
    groupId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      DELETE FROM document_group_access
      WHERE document_id = $1 AND group_id = $2;
    `;
    const result = await this.execute(sql, [documentId, groupId], client);
    return (result.rowCount ?? 0) > 0;
  }

  public async listGroupAccess(
    documentId: string,
    client?: PoolClient
  ): Promise<DocumentGroupAccess[]> {
    const sql = `
      SELECT
        dga.id,
        dga.document_id,
        dga.group_id,
        dga.effect,
        dga.created_at,
        g.name AS group_name
      FROM document_group_access dga
      JOIN groups g ON dga.group_id = g.id
      WHERE dga.document_id = $1
      ORDER BY dga.created_at ASC;
    `;
    return this.query<DocumentGroupAccess>(sql, [documentId], client);
  }

  // ---------------------------------------------------------------------------
  // 3. Organization Role Access Rules
  // ---------------------------------------------------------------------------

  public async upsertOrgRoleAccess(
    documentId: string,
    role: OrganizationRole,
    effect: DocumentEffect,
    client?: PoolClient
  ): Promise<DocumentOrgRoleAccess> {
    const sql = `
      INSERT INTO document_org_role_access (document_id, role, effect)
      VALUES ($1, $2, $3)
      ON CONFLICT (document_id, role)
      DO UPDATE SET effect = EXCLUDED.effect
      RETURNING *;
    `;
    const rows = await this.query<DocumentOrgRoleAccess>(
      sql,
      [documentId, role, effect],
      client
    );
    return rows[0];
  }

  public async removeOrgRoleAccess(
    documentId: string,
    role: OrganizationRole,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      DELETE FROM document_org_role_access
      WHERE document_id = $1 AND role = $2;
    `;
    const result = await this.execute(sql, [documentId, role], client);
    return (result.rowCount ?? 0) > 0;
  }

  public async listOrgRoleAccess(
    documentId: string,
    client?: PoolClient
  ): Promise<DocumentOrgRoleAccess[]> {
    const sql = `
      SELECT id, document_id, role, effect, created_at
      FROM document_org_role_access
      WHERE document_id = $1
      ORDER BY created_at ASC;
    `;
    return this.query<DocumentOrgRoleAccess>(sql, [documentId], client);
  }

  // ---------------------------------------------------------------------------
  // 4. Project Role Access Rules
  // ---------------------------------------------------------------------------

  public async upsertProjectRoleAccess(
    documentId: string,
    role: ProjectRole,
    effect: DocumentEffect,
    client?: PoolClient
  ): Promise<DocumentProjectRoleAccess> {
    const sql = `
      INSERT INTO document_project_role_access (document_id, role, effect)
      VALUES ($1, $2, $3)
      ON CONFLICT (document_id, role)
      DO UPDATE SET effect = EXCLUDED.effect
      RETURNING *;
    `;
    const rows = await this.query<DocumentProjectRoleAccess>(
      sql,
      [documentId, role, effect],
      client
    );
    return rows[0];
  }

  public async removeProjectRoleAccess(
    documentId: string,
    role: ProjectRole,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      DELETE FROM document_project_role_access
      WHERE document_id = $1 AND role = $2;
    `;
    const result = await this.execute(sql, [documentId, role], client);
    return (result.rowCount ?? 0) > 0;
  }

  public async listProjectRoleAccess(
    documentId: string,
    client?: PoolClient
  ): Promise<DocumentProjectRoleAccess[]> {
    const sql = `
      SELECT id, document_id, role, effect, created_at
      FROM document_project_role_access
      WHERE document_id = $1
      ORDER BY created_at ASC;
    `;
    return this.query<DocumentProjectRoleAccess>(sql, [documentId], client);
  }

  // ---------------------------------------------------------------------------
  // 5. Aggregated Rules Summary
  // ---------------------------------------------------------------------------

  public async getAllRulesForDocument(
    documentId: string,
    accessMode: DocumentAccessMode,
    client?: PoolClient
  ): Promise<DocumentAccessRulesSummary> {
    const [userRules, groupRules, orgRoleRules, projectRoleRules] =
      await Promise.all([
        this.listUserAccess(documentId, client),
        this.listGroupAccess(documentId, client),
        this.listOrgRoleAccess(documentId, client),
        this.listProjectRoleAccess(documentId, client),
      ]);

    return {
      document_id: documentId,
      access_mode: accessMode,
      user_rules: userRules,
      group_rules: groupRules,
      org_role_rules: orgRoleRules,
      project_role_rules: projectRoleRules,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Access Evaluation Pipeline Execution
  // ---------------------------------------------------------------------------

  /**
   * Evaluates user access to a specific document following the 6-step pipeline:
   * 1. Check if user is Organization OWNER -> Global access.
   * 2. Check if Document is in PROJECT mode -> All project members have access.
   * 3. Document is in RESTRICTED mode:
   *    Collect all applicable rules (user, groups, org role, project role).
   *    If ANY rule is DENY -> DENY (DENY precedence).
   *    If ANY rule is ALLOW -> ALLOW.
   *    Else -> DEFAULT DENY.
   */
  public async evaluateUserAccess(
    documentId: string,
    userId: string,
    orgId: string,
    projectId: string,
    isOrgOwner: boolean,
    accessMode: DocumentAccessMode,
    client?: PoolClient
  ): Promise<AccessEvaluationResult> {
    // Step 1: Organization OWNER has global access
    if (isOrgOwner) {
      return {
        allowed: true,
        reason: 'Organization OWNER has full administrative access.',
        ruleSource: 'OWNER_BYPASS',
      };
    }

    // Step 2: PROJECT mode grants access to all project members
    if (accessMode === 'PROJECT') {
      return {
        allowed: true,
        reason: 'Document is in PROJECT mode and user is an authorized project member.',
        ruleSource: 'PROJECT_MODE',
      };
    }

    // Step 3: RESTRICTED mode - Query all matching rules for this user
    const sql = `
      SELECT 'USER' AS source, effect FROM document_user_access
      WHERE document_id = $1 AND user_id = $2

      UNION ALL

      SELECT 'GROUP' AS source, dga.effect FROM document_group_access dga
      JOIN group_memberships gm ON dga.group_id = gm.group_id
      WHERE dga.document_id = $1 AND gm.user_id = $2

      UNION ALL

      SELECT 'ORG_ROLE' AS source, dora.effect FROM document_org_role_access dora
      JOIN organization_memberships om ON dora.role = om.role
      WHERE dora.document_id = $1 AND om.user_id = $2 AND om.organization_id = $3

      UNION ALL

      SELECT 'PROJECT_ROLE' AS source, dpra.effect FROM document_project_role_access dpra
      JOIN project_memberships pm ON dpra.role = pm.role
      WHERE dpra.document_id = $1 AND pm.user_id = $2 AND pm.project_id = $4;
    `;

    interface RuleRow {
      source: 'USER' | 'GROUP' | 'ORG_ROLE' | 'PROJECT_ROLE';
      effect: DocumentEffect;
    }

    const matchingRules = await this.query<RuleRow>(
      sql,
      [documentId, userId, orgId, projectId],
      client
    );

    // DENY Precedence: Any DENY rule overrides all ALLOW rules
    const denyRule = matchingRules.find((r) => r.effect === 'DENY');
    if (denyRule) {
      return {
        allowed: false,
        reason: `Access denied by explicit ${denyRule.source} DENY rule (DENY precedence).`,
        matchedEffect: 'DENY',
        ruleSource: denyRule.source,
      };
    }

    // If at least one ALLOW rule matches
    const allowRule = matchingRules.find((r) => r.effect === 'ALLOW');
    if (allowRule) {
      return {
        allowed: true,
        reason: `Access granted by matching ${allowRule.source} ALLOW rule.`,
        matchedEffect: 'ALLOW',
        ruleSource: allowRule.source,
      };
    }

    // Default Deny for RESTRICTED documents
    return {
      allowed: false,
      reason: 'Document is RESTRICTED and no matching ALLOW rule exists for this user.',
      ruleSource: 'DEFAULT_DENY',
    };
  }
}

export const documentAccessRepository = new DocumentAccessRepository();
