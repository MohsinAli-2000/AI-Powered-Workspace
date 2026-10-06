'use client';

import React from 'react';
import Link from 'next/link';
import { useOrgStore } from '@/stores/org.store';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { YourAccessCard } from '@/components/access/your-access-card';
import { ORG_ROLE_INFO } from '@/lib/permissions';
import type { OrganizationRole } from '@/types/api.types';
import {
  Building2,
  Mail,
  FolderKanban,
  UserPlus,
  UploadCloud,
  Bot,
  Check,
  Minus,
  Lock,
  Globe,
  ShieldAlert,
} from 'lucide-react';

const WORKFLOW = [
  {
    icon: Building2,
    title: '1. Create or join an organization',
    who: 'Anyone',
    text: 'An organization is your company workspace. Create one, or accept an invitation sent to your email address.',
    href: undefined,
  },
  {
    icon: Mail,
    title: '2. Invite people to the organization',
    who: 'Owner, Admin',
    text: 'Invite colleagues by email. They become organization Members, but that alone does not show them any documents.',
    href: '/settings/invitations',
  },
  {
    icon: FolderKanban,
    title: '3. Create a project',
    who: 'Anyone',
    text: 'Documents live inside projects. Whoever creates a project becomes its Project Manager.',
    href: '/projects',
  },
  {
    icon: UserPlus,
    title: '4. Add people to the project',
    who: 'Project Manager, Owner',
    text: 'Open the project → Project Members → Add Member. Only people added here can see the project and its documents.',
    href: '/projects',
  },
  {
    icon: UploadCloud,
    title: '5. Upload documents (and restrict if needed)',
    who: 'Project members',
    text: 'Upload PDF, DOCX, XLSX, PPTX or TXT. Wait for the status to become Ready. Managers can restrict a document to specific people.',
    href: '/projects',
  },
  {
    icon: Bot,
    title: '6. Ask the AI assistant',
    who: 'Anyone with project access',
    text: 'Answers come only from documents you are allowed to see, with clickable sources.',
    href: '/chat',
  },
];

type Cell = boolean | 'partial';

const ORG_MATRIX: Array<{ label: string; owner: Cell; admin: Cell; member: Cell; note?: string }> = [
  { label: 'See every project and document', owner: true, admin: false, member: false, note: 'Admins and Members only see projects they were added to' },
  { label: 'Create projects', owner: true, admin: true, member: true },
  { label: 'Invite people to the organization', owner: true, admin: true, member: false },
  { label: 'Change member roles', owner: true, admin: 'partial', member: false, note: 'Admins can only change Members, not other Admins' },
  { label: 'Remove members', owner: true, admin: false, member: false },
  { label: 'Create and manage groups', owner: true, admin: true, member: false },
  { label: 'View the audit log', owner: true, admin: true, member: false },
  { label: 'Rename the organization', owner: true, admin: true, member: false },
  { label: 'Transfer or delete the organization', owner: true, admin: false, member: false },
];

const PROJECT_MATRIX: Array<{ label: string; manager: boolean; member: boolean }> = [
  { label: 'View, download and chat with documents they are allowed to see', manager: true, member: true },
  { label: 'Upload documents', manager: true, member: true },
  { label: 'Rename, delete or retry documents', manager: true, member: false },
  { label: 'Restrict a document / choose who can see it', manager: true, member: false },
  { label: 'Add or remove project members and change their roles', manager: true, member: false },
  { label: 'Edit or delete the project', manager: true, member: false },
];

const FAQ = [
  {
    q: "I joined an organization but I can't see any projects or documents.",
    a: 'Being in the organization is not enough. A Project Manager (or the Owner) must add you to the project: Projects → the project → Project Members → Add Member. Ask them, then refresh.',
  },
  {
    q: "I'm in the project but I can't see one document.",
    a: 'That document is probably Restricted. Only people (or groups/roles) that a manager explicitly allowed can see it. Ask a Project Manager to open the document\'s shield icon and add an ALLOW rule for you.',
  },
  {
    q: 'The AI assistant says it could not find sufficient information.',
    a: 'Either the answer is not in the documents you can access, or the relevant document is still being processed (status must be Ready), or it is restricted for you. Check the document status in the project, and the "Searching in" scope at the top of the chat.',
  },
  {
    q: "A document shows 'Failed'.",
    a: 'Processing did not finish (for example the AI provider was busy, or the file has no extractable text). A Project Manager can click the retry icon next to it. Scanned image-only PDFs cannot be read and need a text version.',
  },
  {
    q: 'I restricted a document but my teammate still cannot open it.',
    a: 'Restricted means "only people I explicitly allow". Add an ALLOW rule for them (or their group/role) AND make sure they are a member of the project. A DENY rule always wins over ALLOW.',
  },
  {
    q: "Why can't I invite people / see the audit log?",
    a: 'Those are Owner and Admin features. The locked items in the left menu show what needs a higher role. Ask your organization Owner or an Admin.',
  },
];

const CellIcon: React.FC<{ value: Cell }> = ({ value }) => {
  if (value === true) return <Check className="w-4 h-4 text-emerald-400 mx-auto" aria-label="Yes" />;
  if (value === 'partial') return <Check className="w-4 h-4 text-amber-400 mx-auto" aria-label="Partly" />;
  return <Minus className="w-4 h-4 text-slate-600 mx-auto" aria-label="No" />;
};

export default function HelpPage() {
  const role = useOrgStore((state) => state.activeOrg?.role) as OrganizationRole | undefined;
  const highlight = (r: OrganizationRole) => (role === r ? 'bg-indigo-500/10' : '');

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="Help & Roles"
        description="How the workspace fits together, who can do what, and how document access works. Locked items elsewhere in the app link back here."
      />

      <YourAccessCard />

      {/* Workflow */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">The workflow, step by step</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WORKFLOW.map((step) => {
            const Icon = step.icon;
            const body = (
              <Card hoverEffect={Boolean(step.href)} className="h-full">
                <CardContent className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{step.title}</p>
                    <p className="text-[11px] text-indigo-300 mt-0.5">Who: {step.who}</p>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{step.text}</p>
                  </div>
                </CardContent>
              </Card>
            );
            return step.href ? (
              <Link key={step.title} href={step.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={step.title}>{body}</div>
            );
          })}
        </div>
      </section>

      {/* Organization roles */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Organization roles</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="p-3 text-left font-medium">What you can do</th>
                  {(['OWNER', 'ADMIN', 'MEMBER'] as OrganizationRole[]).map((r) => (
                    <th key={r} className={`p-3 text-center font-medium ${highlight(r)}`}>
                      {ORG_ROLE_INFO[r].label}
                      {role === r && <span className="block text-[10px] text-indigo-300">(you)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ORG_MATRIX.map((row) => (
                  <tr key={row.label}>
                    <td className="p-3 text-slate-300">
                      {row.label}
                      {row.note && <span className="block text-[11px] text-slate-500">{row.note}</span>}
                    </td>
                    <td className={`p-3 ${highlight('OWNER')}`}><CellIcon value={row.owner} /></td>
                    <td className={`p-3 ${highlight('ADMIN')}`}><CellIcon value={row.admin} /></td>
                    <td className={`p-3 ${highlight('MEMBER')}`}><CellIcon value={row.member} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Project roles */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Project roles</h2>
        <p className="text-xs text-slate-400">
          Inside each project you also have a project role. The organization Owner counts as a Project Manager everywhere.
        </p>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="p-3 text-left font-medium">In a project</th>
                  <th className="p-3 text-center font-medium">Project Manager</th>
                  <th className="p-3 text-center font-medium">Project Member</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {PROJECT_MATRIX.map((row) => (
                  <tr key={row.label}>
                    <td className="p-3 text-slate-300">{row.label}</td>
                    <td className="p-3"><CellIcon value={row.manager} /></td>
                    <td className="p-3"><CellIcon value={row.member} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Document visibility */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Who can see a document?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" /> Whole project <Badge variant="brand" size="sm">default</Badge>
              </CardTitle>
              <CardDescription>
                Everyone who is a member of the project can view, download, search and chat with it.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" /> Restricted <Badge variant="warning" size="sm">managers set this</Badge>
              </CardTitle>
              <CardDescription>
                Only the people, groups or roles a manager explicitly <strong className="text-slate-200">allows</strong> can
                see it. Everyone else in the project is blocked, including in AI answers.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <Notice variant="info" title="How to restrict a document">
          Project → click the <strong>shield icon</strong> on the document → choose <strong>Restricted</strong> → add{' '}
          <strong>ALLOW</strong> rules for the people, groups or roles who should see it. A <strong>DENY</strong> rule
          always overrides any ALLOW. The Owner can always see everything.
        </Notice>
        <Notice variant="warning" title="Two layers, both needed">
          To see a restricted document someone must (1) be a <strong>member of the project</strong> and (2) be{' '}
          <strong>allowed</strong> by the document&apos;s rules. Allowing a person who is not in the project does nothing.
        </Notice>
      </section>

      {/* FAQ */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-400" /> Common questions
        </h2>
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-xl border border-white/10 bg-slate-900/50 open:bg-slate-900/80">
              <summary className="cursor-pointer list-none p-3.5 text-xs font-semibold text-slate-100 flex items-center justify-between gap-3">
                {item.q}
                <span className="text-slate-500 group-open:rotate-45 transition-transform text-base leading-none">+</span>
              </summary>
              <p className="px-3.5 pb-3.5 text-xs text-slate-400 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
