import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { Sentry } from './config/sentry.js';
import { httpLogger } from './middlewares/logger.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { healthRouter } from './modules/health/health.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { organizationRouter } from './modules/organizations/organization.router.js';
import {
  invitationOrgRouter,
  invitationPublicRouter,
} from './modules/invitations/invitation.router.js';
import {
  organizationProjectsRouter,
  projectRouter,
} from './modules/projects/project.router.js';
import {
  organizationGroupsRouter,
  groupRouter,
} from './modules/groups/group.router.js';
import {
  projectDocumentsRouter,
  documentRouter,
} from './modules/documents/document.router.js';
import {
  organizationConversationsRouter,
  conversationRouter,
} from './modules/conversations/conversation.router.js';

const app: Application = express();

app.use(httpLogger);

// Core standard middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Application routes
app.use('/health', healthRouter);
app.use(`${env.API_PREFIX}/health`, healthRouter);
app.use(`${env.API_PREFIX}/auth`, authRouter);
app.use(`${env.API_PREFIX}/organizations`, organizationRouter);
app.use(`${env.API_PREFIX}/organizations`, invitationOrgRouter);
app.use(`${env.API_PREFIX}/organizations`, organizationProjectsRouter);
app.use(`${env.API_PREFIX}/organizations`, organizationGroupsRouter);
app.use(`${env.API_PREFIX}/organizations`, organizationConversationsRouter);
app.use(`${env.API_PREFIX}/invitations`, invitationPublicRouter);
app.use(`${env.API_PREFIX}/projects`, projectRouter);
app.use(`${env.API_PREFIX}/projects`, projectDocumentsRouter);
app.use(`${env.API_PREFIX}/groups`, groupRouter);
app.use(`${env.API_PREFIX}/documents`, documentRouter);
app.use(`${env.API_PREFIX}/conversations`, conversationRouter);

// Not found route handler
app.use(notFoundHandler);

// Sentry error handler (captures unhandled server errors)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
