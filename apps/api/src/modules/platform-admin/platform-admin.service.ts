import { BadRequestError, ConflictError, NotFoundError } from '../../errors/app-error.js';
import { logger } from '../../utils/logger.js';
import { auditService, type AuditService } from '../audit/audit.service.js';
import { documentVersionRepository } from '../documents/document-version.repository.js';
import { emailService } from '../email/email.service.js';
import type { Organization } from '../organizations/organization.entity.js';
import { storageService } from '../storage/storage.service.js';
import {
  platformAdminRepository,
  type PlatformAdminRepository,
  type AdminOrganizationSummary,
  type AdminPlatformStats,
  type ListOrganizationsFilter,
} from './platform-admin.repository.js';

export class PlatformAdminService {
  constructor(
    private readonly repo: PlatformAdminRepository = platformAdminRepository,
    private readonly audit: AuditService = auditService
  ) {}

  public getStats(): Promise<AdminPlatformStats> {
    return this.repo.getStats();
  }

  public async listOrganizations(filter: ListOrganizationsFilter): Promise<{
    organizations: AdminOrganizationSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { organizations, total } = await this.repo.listOrganizations(filter);
    return {
      organizations,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.limit)),
      },
    };
  }

  public async suspendOrganization(
    organizationId: string,
    adminUserId: string,
    reason: string | null
  ): Promise<Organization> {
    const organization = await this.repo.findOrganization(organizationId);
    if (!organization) throw new NotFoundError('Organization not found.');
    if (organization.status === 'SUSPENDED') {
      throw new ConflictError('This organization is already suspended.');
    }

    const owner = await this.repo.getOrganizationOwner(organizationId);

    const updated = await this.repo.setStatus(organizationId, 'SUSPENDED', adminUserId, reason);
    if (!updated) throw new NotFoundError('Organization not found.');

    // Recorded in the organization's own audit log, so its OWNER/ADMINs can see when and why it happened.
    await this.audit.record({
      organizationId,
      actorUserId: adminUserId,
      action: 'organization.suspended',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { reason, by: 'platform_admin' },
    });

    // Notify organization owner via email
    if (owner?.email) {
      void emailService.sendOrganizationSuspendedEmail({
        recipientEmail: owner.email,
        recipientName: owner.name || 'Organization Owner',
        organizationName: organization.name,
        reason: reason ?? 'Violation of platform terms or administrative policy.',
      });
    }

    return updated;
  }

  public async reactivateOrganization(
    organizationId: string,
    adminUserId: string
  ): Promise<Organization> {
    const organization = await this.repo.findOrganization(organizationId);
    if (!organization) throw new NotFoundError('Organization not found.');
    if (organization.status === 'ACTIVE') {
      throw new ConflictError('This organization is already active.');
    }

    const updated = await this.repo.setStatus(organizationId, 'ACTIVE', adminUserId, null);
    if (!updated) throw new NotFoundError('Organization not found.');

    await this.audit.record({
      organizationId,
      actorUserId: adminUserId,
      action: 'organization.reactivated',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { previous_reason: organization.suspension_reason, by: 'platform_admin' },
    });
    return updated;
  }

  /**
   * Permanently deletes a suspended organization and completely purges all associated
   * database data (projects, documents, chunks, vectors, chats) and object storage files.
   * Sends a final notification email to the organization owner.
   */
  public async deleteSuspendedOrganization(
    organizationId: string,
    adminUserId: string
  ): Promise<{ id: string; name: string; purgedFiles: number }> {
    const organization = await this.repo.findOrganization(organizationId);
    if (!organization) throw new NotFoundError('Organization not found.');

    if (organization.status !== 'SUSPENDED') {
      throw new BadRequestError(
        'Only suspended organizations can be permanently deleted. Please suspend the organization first.'
      );
    }

    // 1. Fetch owner details before records are cascaded
    const owner = await this.repo.getOrganizationOwner(organizationId);

    // 2. Fetch all S3/MinIO storage keys for all versions of all documents in the organization
    const storageKeys = await documentVersionRepository.listStorageKeysByOrganization(organizationId);

    // 3. Delete organization record from PostgreSQL.
    // All dependent rows (projects, memberships, documents, versions, chunks, conversations, audit_logs)
    // are cascade-deleted at the DB level.
    await this.repo.deleteOrganization(organizationId);

    // 4. Purge all object storage files from S3/MinIO
    if (storageKeys.length > 0) {
      void storageService.deleteFiles(storageKeys);
    }

    logger.info(
      { organizationId, adminUserId, purgedFiles: storageKeys.length, orgName: organization.name },
      'Platform admin permanently deleted suspended organization and purged all data'
    );

    // 5. Send notification email to the owner
    if (owner?.email) {
      void emailService.sendOrganizationDeletedEmail({
        recipientEmail: owner.email,
        recipientName: owner.name || 'Organization Owner',
        organizationName: organization.name,
      });
    }

    return {
      id: organization.id,
      name: organization.name,
      purgedFiles: storageKeys.length,
    };
  }
}


export const platformAdminService = new PlatformAdminService();
