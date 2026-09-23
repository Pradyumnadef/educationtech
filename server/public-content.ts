import { now, query } from "./db.ts";

export async function publicContentTree() {
  const nodes = await query("SELECT * FROM content");
  const byId = new Map(nodes.map((node: any) => [node.id, node]));
  const currentTime = now();
  const allowed = new Set<string>();

  for (const candidate of nodes as any[]) {
    let node: any = candidate;
    let subject: any = null;
    const visited = new Set<string>();
    let valid = true;
    while (node) {
      if (
        visited.has(node.id) ||
        node.status !== "published" ||
        (node.publish_at && Number(node.publish_at) > currentTime)
      ) {
        valid = false;
        break;
      }
      visited.add(node.id);
      if (node.kind === "subject") subject = node;
      node = node.parent_id ? byId.get(node.parent_id) : null;
      if (visited.size >= 64) {
        valid = false;
        break;
      }
    }
    if (valid && subject?.public === 1) allowed.add(candidate.id);
  }

  return {
    nodes: (nodes as any[]).filter((node) => allowed.has(node.id)),
    allowed,
  };
}

export async function isPublicContent(contentId: string) {
  return (await publicContentTree()).allowed.has(contentId);
}
