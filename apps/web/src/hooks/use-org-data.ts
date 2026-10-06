'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Group, OrganizationMember } from '@/types/api.types';

interface ListState<T> {
  items: T[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function useOrgList<T>(path: string | null): ListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient<T[]>(path);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, isLoading, error, reload };
}

/** Members of an organization, for "pick a person" dropdowns. */
export function useOrgMembers(orgId: string | undefined | null): ListState<OrganizationMember> {
  return useOrgList<OrganizationMember>(orgId ? `/organizations/${orgId}/members` : null);
}

/** Groups of an organization, for "pick a group" dropdowns. */
export function useOrgGroups(orgId: string | undefined | null): ListState<Group> {
  return useOrgList<Group>(orgId ? `/organizations/${orgId}/groups` : null);
}

/** "Jane Doe (jane@acme.com)" label for a member row. */
export function memberLabel(member: Pick<OrganizationMember, 'user'>): string {
  const name = member.user?.full_name;
  const email = member.user?.email;
  if (name && email && name !== email) return `${name} (${email})`;
  return name || email || 'Unknown user';
}
