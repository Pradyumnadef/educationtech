type DriveItem = {
  id: string;
  parent_id: string | null;
  assets?: { size: number }[];
};
export type DriveSort =
  "date-desc" | "date-asc" | "name-asc" | "size-desc" | "size-asc";
export function sortDriveEntries<T>(
  entries: T[],
  sort: DriveSort,
  details: (entry: T) => { name: string; date: number; size: number },
) {
  return entries
    .map((entry) => ({ entry, detail: details(entry) }))
    .sort((left, right) => {
      const a = left.detail;
      const b = right.detail;
      if (sort === "name-asc")
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sort === "size-desc")
        return b.size - a.size || a.name.localeCompare(b.name);
      if (sort === "size-asc")
        return a.size - b.size || a.name.localeCompare(b.name);
      if (sort === "date-asc")
        return a.date - b.date || a.name.localeCompare(b.name);
      return b.date - a.date || a.name.localeCompare(b.name);
    })
    .map(({ entry }) => entry);
}
export function contentFolderSize(items: DriveItem[], folderId: string) {
  const children = new Map<string, DriveItem[]>();
  for (const item of items) {
    if (!item.parent_id) continue;
    const siblings = children.get(item.parent_id) || [];
    siblings.push(item);
    children.set(item.parent_id, siblings);
  }
  const pending = [folderId];
  const included = new Set<string>();
  let total = 0;
  const byId = new Map(items.map((item) => [item.id, item]));
  while (pending.length) {
    const current = pending.pop()!;
    if (included.has(current)) continue;
    included.add(current);
    for (const asset of byId.get(current)?.assets || [])
      total += Number(asset.size || 0);
    for (const child of children.get(current) || []) pending.push(child.id);
  }
  return total;
}
