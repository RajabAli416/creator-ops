import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const WorkspaceContext = createContext(null);

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
  editor: { label: 'Editor', color: 'bg-blue-500/20 text-blue-400' },
  writer: { label: 'Writer', color: 'bg-green-500/20 text-green-400' },
  viewer: { label: 'Viewer', color: 'bg-slate-500/20 text-slate-400' },
};

export function WorkspaceProvider({ children }) {
  const [currentOrg, setCurrentOrg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const allOrgs = await base44.entities.Organization.list();
    const allMembers = await base44.entities.OrganizationMember.filter({ user_email: user.email });
    
    const memberOrgIds = allMembers.map(m => m.organization_id);
    const userOrgs = allOrgs.filter(o => memberOrgIds.includes(o.id) || o.created_by === user.email);
    
    setOrgs(userOrgs);
    
    if (userOrgs.length > 0) {
      const savedOrgId = localStorage.getItem('current_org_id');
      const org = userOrgs.find(o => o.id === savedOrgId) || userOrgs[0];
      setCurrentOrg(org);
      const member = allMembers.find(m => m.organization_id === org.id);
      setCurrentMember(member);
    }
    setLoading(false);
  };

  const switchOrg = async (orgId) => {
    const org = orgs.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('current_org_id', orgId);
      const user = await base44.auth.me();
      const members = await base44.entities.OrganizationMember.filter({ 
        organization_id: orgId, 
        user_email: user.email 
      });
      setCurrentMember(members[0] || null);
    }
  };

  const createOrg = async (data) => {
    const user = await base44.auth.me();
    const org = await base44.entities.Organization.create({
      ...data,
      default_pipeline_stages: PIPELINE_STAGES.map(s => s.id),
    });
    await base44.entities.OrganizationMember.create({
      organization_id: org.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      role: 'owner',
      status: 'active',
    });
    await loadWorkspaces();
    switchOrg(org.id);
    return org;
  };

  const hasPermission = (requiredRoles) => {
    if (!currentMember) return false;
    return requiredRoles.includes(currentMember.role);
  };

  return (
    <WorkspaceContext.Provider value={{
      currentOrg,
      orgs,
      currentMember,
      loading,
      switchOrg,
      createOrg,
      hasPermission,
      refreshWorkspaces: loadWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
export { PIPELINE_STAGES, PRIORITY_CONFIG, ROLE_CONFIG };