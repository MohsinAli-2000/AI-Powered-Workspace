'use client';

import React, { useState, useEffect } from 'react';
import { useOrgStore } from '@/stores/org.store';
import { apiClient } from '@/lib/api-client';
import { Organization } from '@/types/api.types';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Building2, ChevronDown, Plus, Check, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const OrgSwitcher: React.FC = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    organizations,
    activeOrg,
    isCreateOrgOpen,
    setOrganizations,
    setActiveOrg,
    setLoadingOrgs,
    openCreateOrg,
    closeCreateOrg,
  } = useOrgStore();

  const [isOpen, setIsOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch organizations on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const orgs = await apiClient<Organization[]>('/organizations');
        setOrganizations(orgs);
      } catch (err) {
        console.error('Failed to load organizations', err);
        showToast('Could not load your organizations. Please refresh the page.', 'error');
        setLoadingOrgs(false);
      }
    };
    fetchOrgs();
  }, [setOrganizations, setLoadingOrgs, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleSelectOrg = (org: Organization) => {
    setIsOpen(false);
    if (org.id === activeOrg?.id) return;
    setActiveOrg(org);
    showToast(`Switched to organization "${org.name}"`, 'info');
    router.push('/dashboard');
  };

  const handleCloseCreate = () => {
    closeCreateOrg();
    setNewOrgName('');
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreating(true);

    try {
      const created = await apiClient<Organization>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: newOrgName.trim() }),
      });

      // The creator is always the OWNER; the create response may not include a role.
      const createdWithRole: Organization = { ...created, role: 'OWNER' };
      setOrganizations([...organizations, createdWithRole]);
      setActiveOrg(createdWithRole);
      handleCloseCreate();
      showToast(`Organization "${created.name}" created successfully!`, 'success');
      router.push('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create organization', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title="Switch organization"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/80 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all text-left cursor-pointer max-w-full"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 max-w-[110px] sm:max-w-[140px]">
            <p className="text-xs font-semibold text-slate-100 truncate">
              {activeOrg ? activeOrg.name : 'Select Organization'}
            </p>
            {activeOrg?.status === 'SUSPENDED' ? (
              <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase font-semibold">
                Suspended
              </span>
            ) : activeOrg?.role ? (
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                {activeOrg.role}
              </p>
            ) : null}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-2xl z-40">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Your organizations
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1" role="listbox">
                {(!Array.isArray(organizations) || organizations.length === 0) ? (
                  <p className="px-2.5 py-3 text-center text-xs text-slate-400">
                    No organizations found
                  </p>
                ) : (
                  organizations.map((org) => {
                    const isSelected = activeOrg?.id === org.id;
                    return (
                      <button
                        type="button"
                        key={org.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectOrg(org)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{org.name}</span>
                          {org.status === 'SUSPENDED' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Suspended
                            </span>
                          ) : org.role ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                              {org.role}
                            </span>
                          ) : null}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-1.5 mt-1.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    openCreateOrg();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-indigo-400 hover:bg-indigo-600/10 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Organization</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isCreateOrgOpen}
        onClose={handleCloseCreate}
        title="Create New Organization"
        description="Establish a new isolated organizational workspace with its own projects and members."
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <Input
            label="Organization Name"
            placeholder="e.g. Acme Corporation"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
            autoFocus
          />

          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
            <span>
              You will automatically become the exclusive <strong>OWNER</strong> of this organization, with full administrative authority.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseCreate}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create Organization
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
