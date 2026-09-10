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
  const { organizations, activeOrg, setOrganizations, setActiveOrg } = useOrgStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      }
    };
    fetchOrgs();
  }, [setOrganizations]);

  const handleSelectOrg = (org: Organization) => {
    setActiveOrg(org);
    setIsOpen(false);
    showToast(`Switched to organization "${org.name}"`, 'info');
    router.push('/dashboard');
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

      const updated = [...organizations, { ...created, role: 'OWNER' as const }];
      setOrganizations(updated);
      setActiveOrg(created);
      setIsModalOpen(false);
      setNewOrgName('');
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
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/80 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 max-w-[140px]">
            <p className="text-xs font-semibold text-slate-100 truncate">
              {activeOrg ? activeOrg.name : 'Select Organization'}
            </p>
            {activeOrg?.role && (
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                {activeOrg.role}
              </p>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-2xl z-40 animate-in fade-in zoom-in-95">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Organizations
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1">
                {(!Array.isArray(organizations) || organizations.length === 0) ? (
                  <p className="px-2.5 py-3 text-center text-xs text-slate-400">
                    No organizations found
                  </p>
                ) : (
                  organizations.map((org) => {
                    const isSelected = activeOrg?.id === org.id;
                    return (
                      <button
                        key={org.id}
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
                          {org.role && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                              {org.role}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-1.5 mt-1.5 border-t border-white/5">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Organization"
        description="Establish a new isolated organizational workspace with its own projects and members."
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <Input
            label="Organization Name"
            placeholder="e.g. Acme Corporation"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
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
