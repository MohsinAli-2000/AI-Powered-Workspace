import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { closePool } from '../../db/pool.js';
import { AuthService } from './auth.service.js';
import { InvitationService } from '../invitations/invitation.service.js';
import {
  generateEmailVerificationToken,
  generateInvitationToken,
  generateAccessToken,
} from '../../utils/jwt.js';
import { hashToken } from '../../utils/crypto.js';
import { hashPassword } from '../../utils/password.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, BadRequestError } from '../../errors/app-error.js';
import type { User, CreateUserInput } from '../users/user.entity.js';
import type { UserRepository } from '../users/user.repository.js';
import type { EmailVerification, CreateEmailVerificationInput, EmailVerificationRepository } from './email-verification.repository.js';
import type { EmailService, SendVerificationEmailInput, SendInvitationEmailInput } from '../email/email.service.js';
import type { Invitation, CreateInvitationInput } from '../invitations/invitation.entity.js';
import type { InvitationRepository } from '../invitations/invitation.repository.js';
import type { OrganizationRepository } from '../organizations/organization.repository.js';
import type { OrganizationMembershipRepository } from '../organizations/organization-membership.repository.js';
import type { Organization, OrganizationMembership } from '../organizations/organization.entity.js';
import type { AuditService } from '../audit/audit.service.js';

// --- Mocks ---

class MockUserRepository implements Partial<UserRepository> {
  public users: User[] = [];

  public async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  public async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email: input.email.toLowerCase(),
      password_hash: input.password_hash,
      name: input.name,
      email_verified_at: input.email_verified_at !== undefined ? input.email_verified_at : new Date(),
      is_platform_admin: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.users.push(user);
    return user;
  }

  public async markEmailVerified(userId: string): Promise<User | null> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.email_verified_at = new Date();
    }
    return user || null;
  }
}

class MockEmailVerificationRepository implements Partial<EmailVerificationRepository> {
  public verifications: EmailVerification[] = [];

  public async create(input: CreateEmailVerificationInput): Promise<EmailVerification> {
    const verification: EmailVerification = {
      id: `ev_${Math.random().toString(36).substring(2, 9)}`,
      email: input.email.toLowerCase(),
      token_hash: input.token_hash,
      status: 'PENDING',
      expires_at: input.expires_at,
      created_at: new Date(),
      verified_at: null,
      consumed_at: null,
    };
    this.verifications.push(verification);
    return verification;
  }

  public async findByTokenHash(tokenHash: string): Promise<EmailVerification | null> {
    return this.verifications.find((v) => v.token_hash === tokenHash) || null;
  }

  public async markVerified(id: string): Promise<EmailVerification | null> {
    const v = this.verifications.find((item) => item.id === id);
    if (v && v.status === 'PENDING') {
      v.status = 'VERIFIED';
      v.verified_at = new Date();
    }
    return v || null;
  }

  public async transitionToConsumed(id: string): Promise<EmailVerification | null> {
    const v = this.verifications.find((item) => item.id === id);
    if (v && (v.status === 'PENDING' || v.status === 'VERIFIED')) {
      v.status = 'CONSUMED';
      v.consumed_at = new Date();
      return v;
    }
    return null;
  }
}

class MockEmailService implements Partial<EmailService> {
  public sentVerificationEmails: SendVerificationEmailInput[] = [];
  public sentInvitationEmails: SendInvitationEmailInput[] = [];

  public async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    this.sentVerificationEmails.push(input);
  }

  public async sendOrganizationInvitationEmail(input: SendInvitationEmailInput): Promise<void> {
    this.sentInvitationEmails.push(input);
  }
}

class MockInvitationRepository implements Partial<InvitationRepository> {
  public invitations: Invitation[] = [];

  public async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.invitations.find((i) => i.token_hash === tokenHash) || null;
  }

  public async transitionFromPending(id: string, newStatus: 'ACCEPTED' | 'REVOKED'): Promise<Invitation | null> {
    const inv = this.invitations.find((i) => i.id === id);
    if (inv && inv.status === 'PENDING') {
      inv.status = newStatus;
      if (newStatus === 'ACCEPTED') inv.accepted_at = new Date();
      return inv;
    }
    return null;
  }
}

class MockOrganizationRepository implements Partial<OrganizationRepository> {
  public orgs: Organization[] = [];

  public async findById(id: string): Promise<Organization | null> {
    return this.orgs.find((o) => o.id === id) || null;
  }
}

class MockOrganizationMembershipRepository implements Partial<OrganizationMembershipRepository> {
  public memberships: OrganizationMembership[] = [];

  public async create(input: { organization_id: string; user_id: string; role: any }): Promise<OrganizationMembership> {
    const membership: OrganizationMembership = {
      id: `mem_${Math.random().toString(36).substring(2, 9)}`,
      organization_id: input.organization_id,
      user_id: input.user_id,
      role: input.role,
      created_at: new Date(),
    };
    this.memberships.push(membership);
    return membership;
  }

  public async findByUserAndOrg(userId: string, orgId: string): Promise<OrganizationMembership | null> {
    return this.memberships.find((m) => m.user_id === userId && m.organization_id === orgId) || null;
  }
}

class MockAuditService implements Partial<AuditService> {
  public records: any[] = [];
  public async record(input: any): Promise<any> {
    this.records.push(input);
    return null;
  }
}

// --- Test Suites ---

describe('Authentication & Email Verification Improvements', () => {
  describe('Self-Registration Flow (Pre-registration Email Verification & Auto-Login)', () => {
    it('1. Initiate registration sends verification email without creating a user account in DB', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      const email = 'newuser@example.com';
      await authService.initiateRegistration({ email });

      // Verification email must have been sent
      assert.equal((mailer as unknown as MockEmailService).sentVerificationEmails.length, 1);
      assert.equal((mailer as unknown as MockEmailService).sentVerificationEmails[0].recipientEmail, email);

      // CRITICAL: User record MUST NOT exist in DB prior to verification
      const existingUser = await userStore.findByEmail(email);
      assert.equal(existingUser, null, 'No user record should be created before verification');

      // Email verification record was created with PENDING status
      const verifications = (verificationStore as unknown as MockEmailVerificationRepository).verifications;
      assert.equal(verifications.length, 1);
      assert.equal(verifications[0].status, 'PENDING');
      assert.equal(verifications[0].email, email);
    });

    it('2. Initiate registration rejects already registered emails', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      await userStore.create({
        email: 'existing@example.com',
        name: 'Existing User',
        password_hash: await hashPassword('password123'),
        email_verified_at: new Date(),
      });

      await assert.rejects(
        async () => {
          await authService.initiateRegistration({ email: 'existing@example.com' });
        },
        ConflictError
      );
    });

    it('3. Verify email validates the token and marks it as verified', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      const email = 'verify-me@example.com';
      await authService.initiateRegistration({ email });
      const rawToken = (mailer as unknown as MockEmailService).sentVerificationEmails[0].verificationToken;

      const result = await authService.verifyUserEmail({ token: rawToken });
      assert.equal(result.email, email);
      assert.equal(result.verified, true);

      // Status transitioned to VERIFIED
      const v = (verificationStore as unknown as MockEmailVerificationRepository).verifications[0];
      assert.equal(v.status, 'VERIFIED');
    });

    it('4. Completing registration creates the user account and automatically authenticates', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      const email = 'complete-me@example.com';
      await authService.initiateRegistration({ email });
      const rawToken = (mailer as unknown as MockEmailService).sentVerificationEmails[0].verificationToken;

      // Complete registration with token and password
      const authResult = await authService.registerUser({
        token: rawToken,
        name: 'Alice Wonder',
        password: 'Password123!',
      });

      // User record was created
      assert.ok(authResult.authenticatedUser);
      assert.equal(authResult.authenticatedUser.email, email);
      assert.equal(authResult.authenticatedUser.name, 'Alice Wonder');
      assert.ok(authResult.authenticatedUser.email_verified_at, 'Newly created user must be marked verified');

      // Tokens were generated for automatic login
      assert.ok(authResult.accessTokenString, 'Access token must be generated for auto-login');
      assert.ok(authResult.refreshTokenString, 'Refresh token must be generated for auto-login');

      // Token is consumed
      const v = (verificationStore as unknown as MockEmailVerificationRepository).verifications[0];
      assert.equal(v.status, 'CONSUMED');
    });

    it('5. Verification tokens cannot be reused to create duplicate accounts', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      const email = 'no-reuse@example.com';
      await authService.initiateRegistration({ email });
      const rawToken = (mailer as unknown as MockEmailService).sentVerificationEmails[0].verificationToken;

      // First use succeeds
      await authService.registerUser({
        token: rawToken,
        name: 'First User',
        password: 'Password123!',
      });

      // Second use MUST fail with ConflictError
      await assert.rejects(
        async () => {
          await authService.registerUser({
            token: rawToken,
            name: 'Reused Attempt',
            password: 'Password123!',
          });
        },
        ConflictError
      );
    });

    it('6. Expired verification tokens are rejected', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      const email = 'expired@example.com';
      const rawToken = generateEmailVerificationToken(email);
      const tokenHash = hashToken(rawToken);

      // Create an expired verification record in store
      await verificationStore.create({
        email,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      });

      await assert.rejects(
        async () => {
          await authService.registerUser({
            token: rawToken,
            name: 'Expired User',
            password: 'Password123!',
          });
        },
        UnauthorizedError
      );
    });

    it('7. Unverified user accounts cannot login with password', async () => {
      const userStore = new MockUserRepository() as unknown as UserRepository;
      const verificationStore = new MockEmailVerificationRepository() as unknown as EmailVerificationRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const authService = new AuthService(userStore, mailer, verificationStore);

      const unverifiedUser = await userStore.create({
        email: 'unverified-login@example.com',
        name: 'Unverified User',
        password_hash: await hashPassword('Password123!'),
        email_verified_at: null,
      });

      await assert.rejects(
        async () => {
          await authService.loginUser({
            email: 'unverified-login@example.com',
            password: 'Password123!',
          });
        },
        (err: any) => {
          assert.equal(err instanceof ForbiddenError, true);
          assert.equal(err.details?.code, 'EMAIL_NOT_VERIFIED');
          return true;
        }
      );
    });
  });

  describe('Invitation-Based Registration Flow (Email Verification, Account Creation, Auto-Login)', () => {
    it('8. Retrieves invitation details for public acceptance page', async () => {
      const invRepo = new MockInvitationRepository() as unknown as InvitationRepository;
      const orgRepo = new MockOrganizationRepository() as unknown as OrganizationRepository;
      const memRepo = new MockOrganizationMembershipRepository() as unknown as OrganizationMembershipRepository;
      const userRepo = new MockUserRepository() as unknown as UserRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const audit = new MockAuditService() as unknown as AuditService;
      const invService = new InvitationService(invRepo, orgRepo, memRepo, userRepo, mailer, audit);

      const orgId = 'org-123';
      (orgRepo as unknown as MockOrganizationRepository).orgs.push({
        id: orgId,
        name: 'Acme AI Corp',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      } as Organization);

      const invId = 'inv-123';
      const email = 'invited@example.com';
      const rawToken = generateInvitationToken(invId, email, orgId);
      const tokenHash = hashToken(rawToken);

      (invRepo as unknown as MockInvitationRepository).invitations.push({
        id: invId,
        organization_id: orgId,
        email,
        role: 'MEMBER',
        invited_by: 'inviter-id',
        token_hash: tokenHash,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
        created_at: new Date(),
      } as Invitation);

      const details = await invService.getInvitationDetails(rawToken);
      assert.equal(details.email, email);
      assert.equal(details.organizationName, 'Acme AI Corp');
      assert.equal(details.role, 'MEMBER');
      assert.equal(details.hasAccount, false);
    });

    it('9. acceptInvitationAndRegister creates account, sets verified email, joins org, and auto-authenticates', async () => {
      const invRepo = new MockInvitationRepository() as unknown as InvitationRepository;
      const orgRepo = new MockOrganizationRepository() as unknown as OrganizationRepository;
      const memRepo = new MockOrganizationMembershipRepository() as unknown as OrganizationMembershipRepository;
      const userRepo = new MockUserRepository() as unknown as UserRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const audit = new MockAuditService() as unknown as AuditService;
      const invService = new InvitationService(invRepo, orgRepo, memRepo, userRepo, mailer, audit);

      const orgId = 'org-456';
      (orgRepo as unknown as MockOrganizationRepository).orgs.push({
        id: orgId,
        name: 'Beta Labs',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      } as Organization);

      const invId = 'inv-456';
      const email = 'new-invitee@example.com';
      const rawToken = generateInvitationToken(invId, email, orgId);
      const tokenHash = hashToken(rawToken);

      (invRepo as unknown as MockInvitationRepository).invitations.push({
        id: invId,
        organization_id: orgId,
        email,
        role: 'ADMIN',
        invited_by: 'admin-id',
        token_hash: tokenHash,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
        created_at: new Date(),
      } as Invitation);

      const result = await invService.acceptInvitationAndRegister({
        token: rawToken,
        name: 'Bob Invitee',
        password: 'Password123!',
      });

      // User account was created with verified email
      assert.ok(result.authenticatedUser);
      assert.equal(result.authenticatedUser.email, email);
      assert.equal(result.authenticatedUser.name, 'Bob Invitee');
      assert.ok(result.authenticatedUser.email_verified_at, 'Invited email is verified');

      // Membership was created with assigned role
      assert.ok(result.membership);
      assert.equal(result.membership.role, 'ADMIN');
      assert.equal(result.membership.organization_id, orgId);

      // Auto-authenticated tokens are returned
      assert.ok(result.accessTokenString, 'Access token generated for immediate login');
      assert.ok(result.refreshTokenString, 'Refresh token generated for immediate login');

      // Invitation is marked ACCEPTED
      const inv = (invRepo as unknown as MockInvitationRepository).invitations[0];
      assert.equal(inv.status, 'ACCEPTED');
    });

    it('10. Invitation token cannot be reused', async () => {
      const invRepo = new MockInvitationRepository() as unknown as InvitationRepository;
      const orgRepo = new MockOrganizationRepository() as unknown as OrganizationRepository;
      const memRepo = new MockOrganizationMembershipRepository() as unknown as OrganizationMembershipRepository;
      const userRepo = new MockUserRepository() as unknown as UserRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const audit = new MockAuditService() as unknown as AuditService;
      const invService = new InvitationService(invRepo, orgRepo, memRepo, userRepo, mailer, audit);

      const orgId = 'org-789';
      (orgRepo as unknown as MockOrganizationRepository).orgs.push({
        id: orgId,
        name: 'Gamma Systems',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      } as Organization);

      const invId = 'inv-789';
      const email = 'no-reuse-invitee@example.com';
      const rawToken = generateInvitationToken(invId, email, orgId);
      const tokenHash = hashToken(rawToken);

      (invRepo as unknown as MockInvitationRepository).invitations.push({
        id: invId,
        organization_id: orgId,
        email,
        role: 'MEMBER',
        invited_by: 'admin-id',
        token_hash: tokenHash,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
        created_at: new Date(),
      } as Invitation);

      // First acceptance
      await invService.acceptInvitationAndRegister({
        token: rawToken,
        name: 'Gamma User',
        password: 'Password123!',
      });

      // Second acceptance MUST fail
      await assert.rejects(
        async () => {
          await invService.acceptInvitationAndRegister({
            token: rawToken,
            name: 'Reused Attempt',
            password: 'Password123!',
          });
        },
        BadRequestError // Already accepted
      );
    });

    it('11. Invitation cannot be claimed by another email when logged in', async () => {
      const invRepo = new MockInvitationRepository() as unknown as InvitationRepository;
      const orgRepo = new MockOrganizationRepository() as unknown as OrganizationRepository;
      const memRepo = new MockOrganizationMembershipRepository() as unknown as OrganizationMembershipRepository;
      const userRepo = new MockUserRepository() as unknown as UserRepository;
      const mailer = new MockEmailService() as unknown as EmailService;
      const audit = new MockAuditService() as unknown as AuditService;
      const invService = new InvitationService(invRepo, orgRepo, memRepo, userRepo, mailer, audit);

      const orgId = 'org-999';
      (orgRepo as unknown as MockOrganizationRepository).orgs.push({
        id: orgId,
        name: 'Delta Corp',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      } as Organization);

      const invId = 'inv-999';
      const targetEmail = 'target@example.com';
      const rawToken = generateInvitationToken(invId, targetEmail, orgId);
      const tokenHash = hashToken(rawToken);

      (invRepo as unknown as MockInvitationRepository).invitations.push({
        id: invId,
        organization_id: orgId,
        email: targetEmail,
        role: 'MEMBER',
        invited_by: 'admin-id',
        token_hash: tokenHash,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
        created_at: new Date(),
      } as Invitation);

      // Logged in user with DIFFERENT email attempts to accept
      await assert.rejects(
        async () => {
          await invService.acceptInvitation(rawToken, 'intruder-id', 'intruder@example.com');
        },
        ForbiddenError
      );
    });
  });

  after(async () => {
    await closePool();
  });
});
