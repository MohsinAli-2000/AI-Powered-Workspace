import { BaseRepository } from '../../db/base.repository.js';
import {
  projectRepository,
  type ProjectRepository,
} from './project.repository.js';
import {
  projectMembershipRepository,
  type ProjectMembershipRepository,
} from './project-membership.repository.js';
import {
  organizationRepository,
  type OrganizationRepository,
} from '../organizations/organization.repository.js';
import {
  organizationMembershipRepository,
  type OrganizationMembershipRepository,
} from '../organizations/organization-membership.repository.js';
import {
  userRepository,
  type UserRepository,
} from '../users/user.repository.js';
import type {
  Project,
  ProjectMembership,
  ProjectWithMembership,
  ProjectMemberDetail,
  ProjectRole,
} from './project.entity.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  AddProjectMemberInput,
} from './project.schema.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '../../errors/app-error.js';

export class ProjectService {
  constructor(
    private readonly projectRepo: ProjectRepository = projectRepository,
    private readonly projectMembershipRepo: ProjectMembershipRepository = projectMembershipRepository,
    private readonly organizationRepo: OrganizationRepository = organizationRepository,
    private readonly organizationMembershipRepo: OrganizationMembershipRepository = organizationMembershipRepository,
    private readonly userRepo: UserRepository = userRepository
  ) {}

  /**
   * Creates a new project in an organization.
   * Atomically establishes the creator as the initial PROJECT_MANAGER (FR-PROJ-001, FR-PROJ-002).
   */
  public async createProject(
    organizationId: string,
    creatorUserId: string,
    input: CreateProjectInput
  ): Promise<ProjectWithMembership> {
    const organization = await this.organizationRepo.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found.');
    }

    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      creatorUserId,
      organizationId
    );
    if (!orgMembership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    return BaseRepository.withTransaction(async (transactionClient) => {
      // 1. Insert project record
      const createdProject = await this.projectRepo.create(
        {
          organization_id: organizationId,
          name: input.name,
          description: input.description,
          created_by: creatorUserId,
        },
        transactionClient
      );

      // 2. Automatically assign creator as initial PROJECT_MANAGER
      await this.projectMembershipRepo.create(
        {
          organization_id: organizationId,
          project_id: createdProject.id,
          user_id: creatorUserId,
          role: 'PROJECT_MANAGER',
        },
        transactionClient
      );

      return {
        ...createdProject,
        user_role: 'PROJECT_MANAGER',
        member_count: 1,
      };
    });
  }

  /**
   * Retrieves all projects the user is authorized to access within an organization (FR-PROJ-003, FR-AUTHZ-002).
   * - Organization OWNER sees all projects in the organization.
   * - Regular organization members only see projects they explicitly belong to.
   */
  public async listProjects(
    organizationId: string,
    userId: string
  ): Promise<ProjectWithMembership[]> {
    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      userId,
      organizationId
    );
    if (!orgMembership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    const isOrgOwner = orgMembership.role === 'OWNER';
    return this.projectRepo.findAuthorizedByUserAndOrg(
      organizationId,
      userId,
      isOrgOwner
    );
  }

  /**
   * Retrieves detailed project information if authorized.
   */
  public async getProjectDetails(
    projectId: string,
    userId: string
  ): Promise<ProjectWithMembership> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      userId,
      project.organization_id
    );
    if (!orgMembership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    const isOrgOwner = orgMembership.role === 'OWNER';
    const projectMembership =
      await this.projectMembershipRepo.findByUserAndProject(userId, projectId);

    if (!isOrgOwner && !projectMembership) {
      throw new ForbiddenError('You do not have access to this project.');
    }

    const memberCount = await this.projectMembershipRepo.countMembers(projectId);

    return {
      ...project,
      user_role: projectMembership?.role ?? (isOrgOwner ? 'PROJECT_MANAGER' : null),
      member_count: memberCount,
    };
  }

  /**
   * Updates project details (name, description).
   * Authorized: PROJECT_MANAGER or organization OWNER (FR-PROJ-003).
   */
  public async updateProject(
    projectId: string,
    actingUserId: string,
    input: UpdateProjectInput
  ): Promise<Project> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    await this.assertProjectManagementAuthority(project, actingUserId);

    const updatedProject = await this.projectRepo.update(projectId, input);
    if (!updatedProject) {
      throw new NotFoundError('Project not found or update failed.');
    }

    return updatedProject;
  }

  /**
   * Deletes a project and cascades all dependent records (FR-PROJ-004).
   * Authorized: PROJECT_MANAGER or organization OWNER.
   */
  public async deleteProject(
    projectId: string,
    actingUserId: string
  ): Promise<void> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    await this.assertProjectManagementAuthority(project, actingUserId);

    await this.projectRepo.delete(projectId);
  }

  /**
   * Adds an organization member to the project with an assigned role.
   * Enforces:
   * - Caller has PROJECT_MANAGER authority
   * - Target user exists and is an active member of the parent organization (FR-PROJECT-005)
   * - Target user is not already a member of the project (duplicate prevention)
   */
  public async addMember(
    projectId: string,
    actingUserId: string,
    input: AddProjectMemberInput
  ): Promise<ProjectMemberDetail> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    await this.assertProjectManagementAuthority(project, actingUserId);

    // 1. Verify target user exists
    const targetUser = await this.userRepo.findById(input.userId);
    if (!targetUser) {
      throw new NotFoundError('Target user not found.');
    }

    // 2. Enforce FR-PROJECT-005: Target user must belong to the project's parent organization
    const targetOrgMembership =
      await this.organizationMembershipRepo.findByUserAndOrg(
        input.userId,
        project.organization_id
      );
    if (!targetOrgMembership) {
      throw new BadRequestError(
        'User must be an active member of the organization before joining a project.'
      );
    }

    // 3. Prevent duplicate project membership
    const existingMembership =
      await this.projectMembershipRepo.findByUserAndProject(
        input.userId,
        projectId
      );
    if (existingMembership) {
      throw new ConflictError('This user is already a member of the project.');
    }

    const createdMembership = await this.projectMembershipRepo.create({
      organization_id: project.organization_id,
      project_id: projectId,
      user_id: input.userId,
      role: input.role,
    });

    return {
      id: createdMembership.id,
      project_id: projectId,
      user_id: targetUser.id,
      role: createdMembership.role,
      name: targetUser.name,
      email: targetUser.email,
      created_at: createdMembership.created_at,
    };
  }

  /**
   * Updates a member's role within the project.
   * Enforces FR-PROJ-009 (Project Manager Minimum Count Rule).
   */
  public async updateMemberRole(
    projectId: string,
    targetUserId: string,
    newRole: ProjectRole,
    actingUserId: string
  ): Promise<ProjectMembership> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    await this.assertProjectManagementAuthority(project, actingUserId);

    const existingMembership =
      await this.projectMembershipRepo.findByUserAndProject(
        targetUserId,
        projectId
      );
    if (!existingMembership) {
      throw new NotFoundError('User is not a member of this project.');
    }

    if (existingMembership.role === newRole) {
      throw new BadRequestError(`User already holds the ${newRole} role in this project.`);
    }

    // FR-PROJ-009: Protect the last PROJECT_MANAGER from demotion
    if (
      existingMembership.role === 'PROJECT_MANAGER' &&
      newRole === 'PROJECT_MEMBER'
    ) {
      const pmCount = await this.projectMembershipRepo.countProjectManagers(projectId);
      if (pmCount <= 1) {
        throw new BadRequestError(
          'Cannot demote the last project manager. Another member must first be promoted to PROJECT_MANAGER.'
        );
      }
    }

    const updatedMembership = await this.projectMembershipRepo.updateRole(
      projectId,
      targetUserId,
      newRole
    );
    if (!updatedMembership) {
      throw new NotFoundError('Membership record not found.');
    }

    return updatedMembership;
  }

  /**
   * Removes a member from a project.
   * Allows:
   * - Self-removal (leaving the project)
   * - Removal by a PROJECT_MANAGER or organization OWNER
   * Enforces FR-PROJ-009: Last PROJECT_MANAGER cannot be removed or leave without appointing a successor.
   */
  public async removeMember(
    projectId: string,
    targetUserId: string,
    actingUserId: string
  ): Promise<void> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const existingMembership =
      await this.projectMembershipRepo.findByUserAndProject(
        targetUserId,
        projectId
      );
    if (!existingMembership) {
      throw new NotFoundError('User is not a member of this project.');
    }

    const isSelfRemoval = actingUserId === targetUserId;
    if (!isSelfRemoval) {
      await this.assertProjectManagementAuthority(project, actingUserId);
    }

    // FR-PROJ-009: Cannot remove the last PROJECT_MANAGER
    if (existingMembership.role === 'PROJECT_MANAGER') {
      const pmCount = await this.projectMembershipRepo.countProjectManagers(projectId);
      if (pmCount <= 1) {
        throw new BadRequestError(
          'Cannot remove the last project manager. Another member must first be promoted to PROJECT_MANAGER.'
        );
      }
    }

    await this.projectMembershipRepo.delete(projectId, targetUserId);
  }

  /**
   * Lists all members of a project.
   * Authorized: Any project member or organization OWNER.
   */
  public async listProjectMembers(
    projectId: string,
    userId: string
  ): Promise<ProjectMemberDetail[]> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      userId,
      project.organization_id
    );
    if (!orgMembership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    const isOrgOwner = orgMembership.role === 'OWNER';
    const userMembership =
      await this.projectMembershipRepo.findByUserAndProject(userId, projectId);

    if (!isOrgOwner && !userMembership) {
      throw new ForbiddenError('You do not have access to this project.');
    }

    return this.projectMembershipRepo.findProjectMembers(projectId);
  }

  /**
   * Helper to verify that the acting user has project management authority:
   * either the organization OWNER or an explicit PROJECT_MANAGER of the project.
   */
  private async assertProjectManagementAuthority(
    project: Project,
    userId: string
  ): Promise<void> {
    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      userId,
      project.organization_id
    );
    if (!orgMembership) {
      throw new ForbiddenError('You do not belong to the organization that owns this project.');
    }

    // Org OWNER has super-governance authority over all projects
    if (orgMembership.role === 'OWNER') {
      return;
    }

    // Regular members must have PROJECT_MANAGER role
    const projectMembership =
      await this.projectMembershipRepo.findByUserAndProject(userId, project.id);
    if (!projectMembership || projectMembership.role !== 'PROJECT_MANAGER') {
      throw new ForbiddenError(
        'Project Manager authority is required to perform this action.'
      );
    }
  }
}

export const projectService = new ProjectService();
