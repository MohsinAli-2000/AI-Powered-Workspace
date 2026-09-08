import { BaseRepository } from '../../db/base.repository.js';
import { type PoolClient } from '../../db/pool.js';
import type { Invitation, InvitationDetail } from './invitation.entity.js';
import type { OrganizationRole } from '../organizations/organization.entity.js';

export class InvitationRepository extends BaseRepository<Invitation> {
  protected readonly tableName = 'invitations';

  /**
   * Creates a new invitation record.
   */
  public async create(
    invitationData: {
      organization_id: string;
      email: string;
      role: OrganizationRole;
      invited_by: string;
      token_hash: string;
      status: string;
      expires_at: Date;
    },
    databaseClient?: PoolClient
  ): Promise<Invitation> {
    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (organization_id, email, role, invited_by, token_hash, status, expires_at)
      VALUES ($1, LOWER($2), $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const createdRows = await this.query<Invitation>(
      sqlQuery,
      [
        invitationData.organization_id,
        invitationData.email,
        invitationData.role,
        invitationData.invited_by,
        invitationData.token_hash,
        invitationData.status,
        invitationData.expires_at,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds an invitation by its hashed token value.
   * Used during the accept/reject flow to look up the invitation from the raw JWT.
   */
  public async findByTokenHash(
    tokenHash: string,
    databaseClient?: PoolClient
  ): Promise<Invitation | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE token_hash = $1
      LIMIT 1;
    `;
    return this.queryOne<Invitation>(sqlQuery, [tokenHash], databaseClient);
  }

  /**
   * Finds an active (PENDING and not yet expired) invitation for a specific email and organization.
   * Used to enforce FR-MEMBER-004 — prevent duplicate active invitations.
   */
  public async findActiveByEmailAndOrg(
    email: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<Invitation | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(email) = LOWER($1)
        AND organization_id = $2
        AND status = 'PENDING'
        AND expires_at > NOW()
      LIMIT 1;
    `;
    return this.queryOne<Invitation>(sqlQuery, [email, organizationId], databaseClient);
  }

  /**
   * Lists all invitations for an organization with inviter details.
   * Returns most recent invitations first.
   */
  public async findByOrganization(
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<InvitationDetail[]> {
    const sqlQuery = `
      SELECT
        i.*,
        o.name AS organization_name,
        u.name AS inviter_name,
        u.email AS inviter_email
      FROM ${this.tableName} i
      INNER JOIN organizations o ON o.id = i.organization_id
      INNER JOIN users u ON u.id = i.invited_by
      WHERE i.organization_id = $1
      ORDER BY i.created_at DESC;
    `;
    return this.query<InvitationDetail>(sqlQuery, [organizationId], databaseClient);
  }

  /**
   * Finds a specific invitation scoped to an organization.
   * Prevents cross-tenant access by requiring both identifiers.
   */
  public async findByIdAndOrg(
    invitationId: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<Invitation | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1 AND organization_id = $2
      LIMIT 1;
    `;
    return this.queryOne<Invitation>(
      sqlQuery,
      [invitationId, organizationId],
      databaseClient
    );
  }

  /**
   * Updates the token hash for an invitation.
   * Used during the two-step creation flow: record is created first,
   * then the JWT (which embeds the invitation ID) is generated and its hash is stored.
   */
  public async updateTokenHash(
    invitationId: string,
    tokenHash: string,
    databaseClient?: PoolClient
  ): Promise<Invitation | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET token_hash = $1
      WHERE id = $2
      RETURNING *;
    `;
    return this.queryOne<Invitation>(sqlQuery, [tokenHash, invitationId], databaseClient);
  }

  /**
   * Updates the status of an invitation.
   * Optionally sets `accepted_at` when the status transitions to ACCEPTED.
   */
  public async updateStatus(
    invitationId: string,
    newStatus: string,
    databaseClient?: PoolClient
  ): Promise<Invitation | null> {
    const acceptedAtClause = newStatus === 'ACCEPTED' ? ', accepted_at = NOW()' : '';
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET status = $1${acceptedAtClause}
      WHERE id = $2
      RETURNING *;
    `;
    return this.queryOne<Invitation>(sqlQuery, [newStatus, invitationId], databaseClient);
  }
}

export const invitationRepository = new InvitationRepository();
