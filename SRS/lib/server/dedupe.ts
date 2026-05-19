import crypto from "crypto";

export function issueSourceHash(input: {
  jiraIssueKey?: string | null;
  equipmentUid: string;
  startAt: string;
  type: string;
  responsible?: string | null;
  description?: string | null;
}) {
  if (input.jiraIssueKey) {
    return `jira:${input.jiraIssueKey.trim().toUpperCase()}`;
  }

  const signature = [
    input.equipmentUid.trim().toLowerCase(),
    input.startAt,
    input.type.trim().toLowerCase(),
    (input.responsible ?? "").trim().toLowerCase(),
    (input.description ?? "").trim().toLowerCase()
  ].join("|");

  return `sig:${crypto.createHash("sha256").update(signature).digest("hex")}`;
}
