const SHARE_PREFIX = "pf:";

/**
 * Encodes an automation definition to a shareable string
 * Format: "pf:" + base64(JSON)
 */
export function encodeAutomationDefinition(definition: unknown): string {
  const json = JSON.stringify(definition);
  const base64 = Buffer.from(json).toString("base64");
  return `${SHARE_PREFIX}${base64}`;
}

/**
 * Decodes a share string back to an automation definition
 * Returns null if the string is invalid
 */
export function decodeAutomationDefinition(
  shareString: string
): { nodes: unknown[]; edges: unknown[] } | null {
  try {
    // Validate prefix
    if (!shareString.startsWith(SHARE_PREFIX)) {
      return null;
    }

    // Extract base64 part
    const base64 = shareString.slice(SHARE_PREFIX.length);
    if (!base64) {
      return null;
    }

    // Decode base64
    const json = Buffer.from(base64, "base64").toString("utf-8");

    // Parse JSON
    const parsed = JSON.parse(json);

    // Validate structure
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    // Ensure nodes and edges exist (default to empty arrays)
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const edges = Array.isArray(parsed.edges) ? parsed.edges : [];

    return { nodes, edges };
  } catch {
    return null;
  }
}
