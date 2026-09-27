// Supabase's shared pooler uses the same host and credentials in both modes.
// Runtime queries do not rely on session state or named prepared statements;
// explicit transactions on a single checked-out client remain supported.
export function runtimeDatabaseUrl(
  raw: string | undefined,
  serverless: boolean,
  mode?: string,
): string | undefined {
  if (!raw || !serverless || mode === "session") return raw;
  const url = new URL(raw);
  if (
    (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
    url.hostname.endsWith(".pooler.supabase.com") &&
    url.port === "5432"
  ) {
    url.port = "6543";
    return url.toString();
  }
  return raw;
}
