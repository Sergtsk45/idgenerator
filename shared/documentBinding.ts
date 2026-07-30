export const QUALITY_BINDING_ROLES = ["quality", "passport", "protocol"] as const;

export function isQualityBindingRole(role: string | null | undefined): boolean {
  return QUALITY_BINDING_ROLES.some((qualityRole) => qualityRole === role);
}
