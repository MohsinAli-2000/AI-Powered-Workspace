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
    const raw = organizations as unknown as { organizations?: Organization[] };
    const list = Array.isArray(organizations)
      ? organizations
      : raw?.organizations || [];
    set({ organizations: list });
    const currentActive = get().activeOrg;
    if (!currentActive && list.length > 0) {
      set({ activeOrg: list[0] });
    } else if (currentActive) {
      const refreshed = list.find((o: Organization) => o.id === currentActive.id);
      set({ activeOrg: refreshed || list[0] || null });
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
    const raw = projects as unknown as { projects?: Project[] };
    const list = Array.isArray(projects)
      ? projects
      : raw?.projects || [];
    set({ projects: list });
    const currentActive = get().activeProject;
    if (!currentActive && list.length > 0) {
      set({ activeProject: list[0] });
    } else if (currentActive) {
      const refreshed = list.find((p: Project) => p.id === currentActive.id);
      set({ activeProject: refreshed || list[0] || null });
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
