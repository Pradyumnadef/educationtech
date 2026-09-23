import { query, run } from "./db.ts";
import { groupSubjectCode, subjectCode } from "../shared/group-subject.ts";

export type StudentGroupWithSubject = {
  id: string;
  name: string;
  description?: string;
  created_at?: number;
  subject_id: string;
  subject_name: string;
};

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function groupsWithSubjects(groups?: any[]) {
  const rows = groups || (await query("SELECT * FROM student_groups ORDER BY name"));
  const subjects = await query(
    "SELECT id,name FROM content WHERE kind='subject' ORDER BY name",
  );
  const mappings = await query(
    "SELECT id,value FROM settings WHERE id LIKE 'group-subject:%'",
  );
  const mappedByGroup = new Map(
    mappings.map((entry: any) => [
      String(entry.id).slice("group-subject:".length),
      entry.value,
    ]),
  );
  const attendance = (
    await query(
      "SELECT value FROM settings WHERE id LIKE 'attendance-session:%'",
    )
  )
    .map((entry: any) => safeJson(entry.value))
    .filter(Boolean)
    .sort(
      (left: any, right: any) =>
        Number(right.created_at || right.starts_at || 0) -
        Number(left.created_at || left.starts_at || 0),
    );

  const assignedByGroup = new Map<string, string>();
  for (const group of rows) {
    let assignedId = mappedByGroup.get(group.id) || "";
    if (!assignedId) {
      const previousSession = attendance.find(
        (session: any) => session.class_section_id === group.id,
      );
      assignedId = previousSession?.subject_id || "";
    }
    if (!assignedId) {
      const legacyCode = groupSubjectCode(group.name);
      assignedId =
        subjects.find((subject: any) => subjectCode(subject.name) === legacyCode)
          ?.id || "";
    }
    assignedByGroup.set(group.id, assignedId);
  }

  // Older installations only had Section-A and Section-B. If one was renamed
  // before explicit mappings existed, its subject is the remaining legacy one.
  if (rows.length === 2) {
    const unresolved = rows.filter((group: any) => !assignedByGroup.get(group.id));
    const assignedIds = new Set(Array.from(assignedByGroup.values()).filter(Boolean));
    const remainingLegacySubjects = subjects.filter(
      (subject: any) =>
        subjectCode(subject.name) && !assignedIds.has(subject.id),
    );
    if (unresolved.length === 1 && remainingLegacySubjects.length === 1)
      assignedByGroup.set(unresolved[0].id, remainingLegacySubjects[0].id);
  }

  return rows.map((group: any): StudentGroupWithSubject => {
    const assignedId = assignedByGroup.get(group.id) || "";
    const subject = subjects.find((entry: any) => entry.id === assignedId);
    return {
      ...group,
      subject_id: subject?.id || "",
      subject_name: subject?.name || "",
    };
  });
}

export async function saveGroupSubject(groupId: string, subjectId: string) {
  const subject = (
    await query("SELECT id,name FROM content WHERE id=? AND kind='subject'", [
      subjectId,
    ])
  )[0];
  if (!subject) return null;
  await run(
    "INSERT INTO settings(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    [`group-subject:${groupId}`, subject.id],
  );
  return subject;
}
