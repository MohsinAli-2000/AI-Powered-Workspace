import { create } from 'zustand';
import { Organization, Project } from '@/types/api.types';

interface OrgState {
  organizations: Organization[];
  activeOrg: Organization | null;
  projects: Project[];
  activeProject: Project | null;
  isLoadingOrgs: boolean;
  isLoadingProjects: boolean;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrg: (org: Organization | null) => void;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;
  resetAll: () => void;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  organizations: [],
  activeOrg: null,
  projects: [],
  activeProject: null,
  isLoadingOrgs: false,
  isLoadingProjects: false,

  setOrganizations: (organizations: Organization[]) => {
    set({ organizations });
    const currentActive = get().activeOrg;
    if (!currentActive && organizations.length > 0) {
      set({ activeOrg: organizations[0] });
    } else if (currentActive) {
      const refreshed = organizations.find((o) => o.id === currentActive.id);
      set({ activeOrg: refreshed || organizations[0] || null });
    }
  },

  setActiveOrg: (org: Organization | null) => {
    // Invariant: Changing organization completely clears project state to prevent cross-tenant data leakage
    set({
      activeOrg: org,
      projects: [],
      activeProject: null,
    });
  },

  setProjects: (projects: Project[]) => {
    set({ projects });
    const currentActive = get().activeProject;
    if (!currentActive && projects.length > 0) {
      set({ activeProject: projects[0] });
    } else if (currentActive) {
      const refreshed = projects.find((p) => p.id === currentActive.id);
      set({ activeProject: refreshed || projects[0] || null });
    }
  },

  setActiveProject: (project: Project | null) => {
    set({ activeProject: project });
  },

  resetAll: () => {
    set({
      organizations: [],
      activeOrg: null,
      projects: [],
      activeProject: null,
      isLoadingOrgs: false,
      isLoadingProjects: false,
    });
  },
}));
