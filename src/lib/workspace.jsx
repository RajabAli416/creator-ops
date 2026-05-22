import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/api/client';

const WorkspaceContext = createContext(null);
export const WORKSPACE_STORAGE_KEY = 'current_org_id';

const PIPELINE_STAGES = [
  { id: 'idea', label: 'Idea', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'script', label: 'Script', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'recording', label: 'Recording', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { id: 'editing', label: 'Editing', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { id: 'thumbnail', label: 'Thumbnail', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { id: 'review', label: 'Review', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { id: 'scheduled', label: 'Scheduled', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'published', label: 'Published', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
];

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
};

const ROLE_CONFIG = {
  owner: { label: 'Owner', color: 'bg-amber-500/20 text-amber-400' },
  manager: { label: 'Manager', color: 'bg-purple-500/20 text-purple-400' },
  admin: { label: 'Manager', color: 'bg-purple-500/20 text-purple-400' },
  editor: { label: 'Editor', color: 'bg-blue-500/20 text-blue-400' },
  writer: { label: 'Writer', color: 'bg-green-500/20 text-green-400' },
  viewer: { label: 'Viewer', color: 'bg-slate-500/20 text-slate-400' },
};

export function WorkspaceProvider({ children }) {
  const [currentOrg, setCurrentOrg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  const selectWorkspace = useCallback((userOrgs, allMembers, preferredOrgId) => {
    setOrgs(userOrgs);

    if (userOrgs.length === 0) {
      setCurrentOrg(null);
      setCurrentMember(null);
      setWorkspaceReady(true);
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      return null;
    }

    const savedOrgId = preferredOrgId || localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const org = userOrgs.find((o) => o.id === savedOrgId) || userOrgs[0];
    const member = allMembers.find((m) => m.organization_id === org.id) || null;

    setCurrentOrg(org);
    setCurrentMember(member);
    setWorkspaceReady(true);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, org.id);
    return org;
  }, []);

  const loadWorkspaces = useCallback(async (preferredOrgId) => {
    setLoading(true);
    try {
      const user = await api.auth.me();
      const userOrgs = await api.entities.Organization.list();
      const allMembers = await api.entities.OrganizationMember.filter({ user_id: user.id });
      return selectWorkspace(userOrgs, allMembers, preferredOrgId);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      setOrgs([]);
      setCurrentOrg(null);
      setCurrentMember(null);
      setWorkspaceReady(true);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectWorkspace]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const switchOrg = async (orgId) => {
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, orgId);
      const user = await api.auth.me();
      const members = await api.entities.OrganizationMember.filter({
        organization_id: orgId,
        user_id: user.id,
      });
      setCurrentMember(members[0] || null);
      return org;
    }
    return loadWorkspaces(orgId);
  };

  const createOrg = async (data) => {
    const org = await api.entities.Organization.create(data);
    await loadWorkspaces(org.id);
    return org;
  };

  const joinOrg = async ({ slug, organizationId }) => {
    const org = await api.workspace.joinTeam({ slug, organizationId });
    await loadWorkspaces(org.id);
    return org;
  };

  const getPendingInvites = () => api.workspace.getPendingTeamInvites();

  const acceptInvite = async (notificationId, organizationId) => {
    const org = await api.workspace.acceptTeamInvite(notificationId, organizationId);
    await loadWorkspaces(org.id);
    return org;
  };

  const hasPermission = (requiredRoles) => {
    if (!currentMember) return false;
    const role = currentMember.role;
    const expanded = role === 'admin' ? ['admin', 'manager'] : [role];
    return requiredRoles.some((r) => expanded.includes(r) || r === role);
  };

  /** True only for brand-new users with no workspace yet */
  const needsOnboarding = workspaceReady && !loading && orgs.length === 0;

  return (
    <WorkspaceContext.Provider
      value={{
        currentOrg,
        orgs,
        currentMember,
        loading,
        workspaceReady,
        needsOnboarding,
        switchOrg,
        createOrg,
        joinOrg,
        acceptInvite,
        getPendingInvites,
        hasPermission,
        refreshWorkspaces: () => loadWorkspaces(),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
export { PIPELINE_STAGES, PRIORITY_CONFIG, ROLE_CONFIG };
