import { create } from 'zustand';
import { Organization, Project } from '@/types/api.types';
import { getActiveOrganizationId, setActiveOrganizationId } from '@/lib/api-client';

interface OrgState {
  organizations: Organization[];
  activeOrg: Organization | null;
  projects: Project[];
  activeProject: Project | null;
  isLoadingOrgs: boolean;
  isLoadingProjects: boolean;
  isCreateOrgOpen: boolean;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrg: (org: Organization | null) => void;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;
  setLoadingOrgs: (loading: boolean) => void;
  openCreateOrg: () => void;
  closeCreateOrg: () => void;
  resetAll: () => void;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  organizations: [],
  activeOrg: null,
  projects: [],
  activeProject: null,
  isLoadingOrgs: true,
  isLoadingProjects: false,
  isCreateOrgOpen: false,

  setOrganizations: (organizations: Organization[]) => {
    const raw = organizations as unknown as { organizations?: Organization[] };
    const list = Array.isArray(organizations)
      ? organizations
      : raw?.organizations || [];
    set({ organizations: list, isLoadingOrgs: false });

    const currentActive = get().activeOrg;
    if (!currentActive) {
      // Restore the selection from the previous visit before falling back to the first org.
      const storedId = getActiveOrganizationId();
      const restored = list.find((o: Organization) => o.id === storedId) || list[0] || null;
      set({ activeOrg: restored });
      setActiveOrganizationId(restored?.id ?? null);
    } else {
      const refreshed = list.find((o: Organization) => o.id === currentActive.id) || list[0] || null;
      set({ activeOrg: refreshed });
      setActiveOrganizationId(refreshed?.id ?? null);
    }
  },

  setActiveOrg: (org: Organization | null) => {
    // Invariant: Changing organization completely clears project state to prevent cross-tenant data leakage
    set({
      activeOrg: org,
      projects: [],
      activeProject: null,
    });
    setActiveOrganizationId(org?.id ?? null);
  },

  setProjects: (projects: Project[]) => {
    const raw = projects as unknown as { projects?: Project[] };
    const list = Array.isArray(projects)
      ? projects
      : raw?.projects || [];
    set({ projects: list });
    // Keep the open project fresh, but never auto-select one: "active" means "currently viewing".
    const currentActive = get().activeProject;
    if (currentActive) {
      set({ activeProject: list.find((p: Project) => p.id === currentActive.id) || null });
    }
  },

  setActiveProject: (project: Project | null) => {
    set({ activeProject: project });
  },

  setLoadingOrgs: (loading: boolean) => set({ isLoadingOrgs: loading }),
  openCreateOrg: () => set({ isCreateOrgOpen: true }),
  closeCreateOrg: () => set({ isCreateOrgOpen: false }),

  resetAll: () => {
    setActiveOrganizationId(null);
    set({
      organizations: [],
      activeOrg: null,
      projects: [],
      activeProject: null,
      isLoadingOrgs: true,
      isLoadingProjects: false,
      isCreateOrgOpen: false,
    });
  },
}));
