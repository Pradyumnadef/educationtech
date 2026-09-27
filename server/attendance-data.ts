// Index each collection once; reports can contain thousands of check-ins.
export function attendanceData(
  students: any[],
  profiles: any[],
  groups: any[],
  members: any[],
  sessions: any[],
  records: any[],
) {
  const profilesByUser = new Map(
    profiles.map((entry) => [entry.user_id, entry]),
  );
  const membersByUser = new Map(members.map((entry) => [entry.user_id, entry]));
  const groupsById = new Map(groups.map((entry) => [entry.id, entry]));
  const enrichedStudents = students.map((student) => {
    const profile = profilesByUser.get(student.id);
    const membership = membersByUser.get(student.id);
    const group = groupsById.get(profile?.group_id || membership?.group_id);
    return {
      ...student,
      roll_number: profile?.roll_number || "",
      group_id: group?.id || "",
      group_name: group?.name || profile?.group_name || "",
    };
  });
  const studentsById = new Map(
    enrichedStudents.map((student) => [student.id, student]),
  );
  const recordsBySession = new Map<string, any[]>();
  for (const record of records) {
    const student = studentsById.get(record.user_id);
    const entries = recordsBySession.get(record.session_id) || [];
    entries.push({
      ...record,
      student_name: student?.name || "Removed student",
      student_email: student?.email || "",
      student_roll_number: student?.roll_number || "",
    });
    recordsBySession.set(record.session_id, entries);
  }
  return {
    students: enrichedStudents,
    groups,
    members,
    attendance: [...sessions]
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .map((session) => {
        const entries = (recordsBySession.get(session.id) || []).sort(
          (a, b) => Number(b.checked_at) - Number(a.checked_at),
        );
        return {
          ...session,
          attendance_count: entries.length,
          records: entries,
        };
      }),
  };
}
