export type GroupSubjectCode = "uhv" | "etw";

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function groupSubjectCode(groupName: string): GroupSubjectCode | null {
  const name = compact(groupName);
  if (name === "sectiona") return "uhv";
  if (name === "sectionb") return "etw";
  return null;
}

export function subjectCode(subjectName: string): GroupSubjectCode | null {
  const name = subjectName.toLowerCase();
  if (/\buhv\b/.test(name) || name.includes("universal human values"))
    return "uhv";
  if (/\betw\b/.test(name) || name.includes("english for technical writing"))
    return "etw";
  return null;
}

export function groupMatchesSubject(groupName: string, subjectName: string) {
  const groupCode = groupSubjectCode(groupName);
  return groupCode !== null && groupCode === subjectCode(subjectName);
}

export function assignedSubjectLabel(groupName: string) {
  const code = groupSubjectCode(groupName);
  return code === "uhv" ? "UHV" : code === "etw" ? "ETW" : "";
}
