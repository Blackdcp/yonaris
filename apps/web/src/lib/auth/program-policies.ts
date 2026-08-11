/**
 * Customer program provisioning is deliberately narrower than the app's
 * general organization write policy. Collaborators may edit ordinary brand
 * data, but only an organization owner or admin may establish a new scoring
 * boundary.
 */
export function evaluateCustomerProgramProvisionAccess(role: string | null | undefined): "allow" | "deny" {
	if (!role) return "deny";
	const roles = role
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	return roles.some((value) => value === "owner" || value === "admin") ? "allow" : "deny";
}
