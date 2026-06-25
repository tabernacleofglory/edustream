export const ROLE_HIERARCHY: Record<string, string[]> = {
  developer: ['developer', 'admin', 'moderator', 'team', 'user'],
  admin: ['admin', 'moderator', 'team', 'user'],
  moderator: ['moderator', 'team', 'user'],
  team: ['team', 'user'],
  user: ['user'],
};

export const ALL_ROLES: { id: string; name: string }[] = [
  { id: 'developer', name: 'Developer' },
  { id: 'admin', name: 'Admin' },
  { id: 'moderator', name: 'Moderator' },
  { id: 'team', name: 'Team' },
  { id: 'user', name: 'User' },
];

export function getAssignableRoles(userRole: string): { id: string; name: string }[] {
  const allowedRoleIds = ROLE_HIERARCHY[userRole] || ['user'];
  return ALL_ROLES.filter((role) => allowedRoleIds.includes(role.id));
}

export function canManageRole(currentUserRole: string, targetUserRole: string): boolean {
  const allowedRoleIds = ROLE_HIERARCHY[currentUserRole] || ['user'];
  return allowedRoleIds.includes(targetUserRole);
}

export function canManageUser(currentUserRole: string, targetUserRole: string): boolean {
  // Users can only manage users with lower rank
  const currentUserRank = Object.keys(ROLE_HIERARCHY).indexOf(currentUserRole);
  const targetUserRank = Object.keys(ROLE_HIERARCHY).indexOf(targetUserRole);
  return currentUserRank < targetUserRank; // lower index = higher rank
}

export function isHigherOrEqualRank(currentUserRole: string, targetUserRole: string): boolean {
  const currentUserRank = Object.keys(ROLE_HIERARCHY).indexOf(currentUserRole);
  const targetUserRank = Object.keys(ROLE_HIERARCHY).indexOf(targetUserRole);
  return currentUserRank <= targetUserRank; // lower index = higher rank
}