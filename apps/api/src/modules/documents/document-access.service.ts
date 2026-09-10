import {
  documentRepository,
  type DocumentRepository,
} from './document.repository.js';
import {
  documentAccessRepository,
  type DocumentAccessRepository,
} from './document-access.repository.js';
import {
  organizationMembershipRepository,
  type OrganizationMembershipRepository,
} from '../organizations/organization-membership.repository.js';
import {
  projectMembershipRepository,
  type ProjectMembershipRepository,
} from '../projects/project-membership.repository.js';
import {
  groupRepository,
  type GroupRepository,
} from '../groups/group.repository.js';
import type {
  DocumentAccessMode,
} from './document.entity.js';
import type {
  DocumentEffect,
  DocumentUserAccess,
  DocumentGroupAccess,
  DocumentOrgRoleAccess,
  DocumentProjectRoleAccess,
  DocumentAccessRulesSummary,
  AccessEvaluationResult,
} from './document-access.entity.js';
import type { OrganizationRole } from '../organizations/organization.entity.js';
import type { ProjectRole } from '../projects/project.entity.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../errors/app-error.js';
import { logger } from '../../utils/logger.js';

export class DocumentAccessService {
  constructor(
    private readonly documentRepo: DocumentRepository = documentRepository,
    private readonly accessRepo: DocumentAccessRepository = documentAccessRepository,
    private readonly orgMembershipRepo: OrganizationMembershipRepository = organizationMembershipRepository,
    private readonly projectMembershipRepo: ProjectMembershipRepository = projectMembershipRepository,
    private readonly groupRepo: GroupRepository = groupRepository
  ) {}

  /**
   * Helper to verify document existence and ensure caller has permission to manage access rules.
   * Only Organization OWNER or the project's PROJECT_MANAGER can manage rules.
   */
  private async getDocumentAndVerifyManager(
    documentId: string,
    callerUserId: string
  ) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found.');
    }

    const orgMembership = await this.orgMembershipRepo.findByUserAndOrg(
      callerUserId,
      document.organization_id
    );

    if (!orgMembership) {
      throw new ForbiddenError('You do not belong to the organization that owns this document.');
    }

    if (orgMembership.role === 'OWNER') {
      return document;
    }

    const projectMembership = await this.projectMembershipRepo.findByUserAndProject(
      callerUserId,
      document.project_id
    );

    if (!projectMembership || projectMembership.role !== 'PROJECT_MANAGER') {
      throw new ForbiddenError(
        'Insufficient permissions. Only a PROJECT_MANAGER or organization OWNER can manage document access.'
      );
    }

    return document;
  }

  /**
   * Updates document access mode between PROJECT and RESTRICTED.
   */
  public async setAccessMode(
    documentId: string,
    callerUserId: string,
    accessMode: DocumentAccessMode
  ) {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const updated = await this.documentRepo.updateAccessMode(documentId, accessMode);
    if (!updated) {
      throw new NotFoundError('Document not found.');
    }
    logger.info({ documentId, accessMode, callerUserId }, 'Updated document access mode.');
    return updated;
  }

  /**
   * Returns all access rules configured for a document.
   */
  public async getDocumentRules(
    documentId: string,
    callerUserId: string
  ): Promise<DocumentAccessRulesSummary> {
    const document = await this.getDocumentAndVerifyManager(documentId, callerUserId);
    return this.accessRepo.getAllRulesForDocument(document.id, document.access_mode);
  }

  /**
   * Adds or updates a direct user access rule on a document.
   * Validates that the target user belongs to the document's organization (cross-tenant safety).
   */
  public async setUserRule(
    documentId: string,
    callerUserId: string,
    targetUserId: string,
    effect: DocumentEffect
  ): Promise<DocumentUserAccess> {
    const document = await this.getDocumentAndVerifyManager(documentId, callerUserId);

    // Cross-tenant verification: Target user must belong to the same organization
    const targetOrgMembership = await this.orgMembershipRepo.findByUserAndOrg(
      targetUserId,
      document.organization_id
    );

    if (!targetOrgMembership) {
      throw new BadRequestError(
        'Cannot assign access rule: Target user does not belong to this organization.'
      );
    }

    const rule = await this.accessRepo.upsertUserAccess(documentId, targetUserId, effect);
    logger.info({ documentId, targetUserId, effect }, 'Set user document access rule.');
    return rule;
  }

  /**
   * Removes a direct user access rule from a document.
   */
  public async deleteUserRule(
    documentId: string,
    callerUserId: string,
    targetUserId: string
  ): Promise<void> {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const removed = await this.accessRepo.removeUserAccess(documentId, targetUserId);
    if (!removed) {
      throw new NotFoundError('User access rule not found.');
    }
    logger.info({ documentId, targetUserId }, 'Removed user document access rule.');
  }

  /**
   * Adds or updates a group access rule on a document.
   * Validates that the target group belongs to the document's organization (cross-tenant safety).
   */
  public async setGroupRule(
    documentId: string,
    callerUserId: string,
    targetGroupId: string,
    effect: DocumentEffect
  ): Promise<DocumentGroupAccess> {
    const document = await this.getDocumentAndVerifyManager(documentId, callerUserId);

    // Cross-tenant verification: Target group must belong to the document's organization
    const targetGroup = await this.groupRepo.findById(targetGroupId);
    if (!targetGroup || targetGroup.organization_id !== document.organization_id) {
      throw new BadRequestError(
        'Cannot assign access rule: Target group does not belong to this organization.'
      );
    }

    const rule = await this.accessRepo.upsertGroupAccess(documentId, targetGroupId, effect);
    logger.info({ documentId, targetGroupId, effect }, 'Set group document access rule.');
    return rule;
  }

  /**
   * Removes a group access rule from a document.
   */
  public async deleteGroupRule(
    documentId: string,
    callerUserId: string,
    targetGroupId: string
  ): Promise<void> {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const removed = await this.accessRepo.removeGroupAccess(documentId, targetGroupId);
    if (!removed) {
      throw new NotFoundError('Group access rule not found.');
    }
    logger.info({ documentId, targetGroupId }, 'Removed group document access rule.');
  }

  /**
   * Adds or updates an organization role access rule on a document.
   */
  public async setOrgRoleRule(
    documentId: string,
    callerUserId: string,
    role: OrganizationRole,
    effect: DocumentEffect
  ): Promise<DocumentOrgRoleAccess> {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const rule = await this.accessRepo.upsertOrgRoleAccess(documentId, role, effect);
    logger.info({ documentId, role, effect }, 'Set org role document access rule.');
    return rule;
  }

  /**
   * Removes an organization role access rule from a document.
   */
  public async deleteOrgRoleRule(
    documentId: string,
    callerUserId: string,
    role: OrganizationRole
  ): Promise<void> {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const removed = await this.accessRepo.removeOrgRoleAccess(documentId, role);
    if (!removed) {
      throw new NotFoundError('Organization role access rule not found.');
    }
    logger.info({ documentId, role }, 'Removed org role document access rule.');
  }

  /**
   * Adds or updates a project role access rule on a document.
   */
  public async setProjectRoleRule(
    documentId: string,
    callerUserId: string,
    role: ProjectRole,
    effect: DocumentEffect
  ): Promise<DocumentProjectRoleAccess> {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const rule = await this.accessRepo.upsertProjectRoleAccess(documentId, role, effect);
    logger.info({ documentId, role, effect }, 'Set project role document access rule.');
    return rule;
  }

  /**
   * Removes a project role access rule from a document.
   */
  public async deleteProjectRoleRule(
    documentId: string,
    callerUserId: string,
    role: ProjectRole
  ): Promise<void> {
    await this.getDocumentAndVerifyManager(documentId, callerUserId);
    const removed = await this.accessRepo.removeProjectRoleAccess(documentId, role);
    if (!removed) {
      throw new NotFoundError('Project role access rule not found.');
    }
    logger.info({ documentId, role }, 'Removed project role document access rule.');
  }

  /**
   * Evaluates access for a specific user against a document following the 6-step pipeline.
   */
  public async evaluateAccess(
    documentId: string,
    userId: string,
    orgId: string,
    projectId: string,
    isOrgOwner: boolean,
    accessMode: DocumentAccessMode
  ): Promise<AccessEvaluationResult> {
    return this.accessRepo.evaluateUserAccess(
      documentId,
      userId,
      orgId,
      projectId,
      isOrgOwner,
      accessMode
    );
  }
}

export const documentAccessService = new DocumentAccessService();
