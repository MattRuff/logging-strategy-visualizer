// Admins are stored in DynamoDB under a single config row so that any current
// admin can promote another user from the Settings tab. The list is bootstrapped
// from BOOTSTRAP_ADMINS on first read if the row does not yet exist.
//
// Workloads published by an admin are flagged `isOfficial: true` so the client
// can pin them to the top of the templates list.

import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "./ddb.mjs";

const CONFIG_PK = "CONFIG";
const ADMINS_SK = "ADMINS";

const BOOTSTRAP_ADMINS = ["matthew.ruyffelaert@datadoghq.com"];

function normalize(email) {
  return String(email || "").trim().toLowerCase();
}

export async function listAdmins() {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: CONFIG_PK, sk: ADMINS_SK },
  }));
  if (!res.Item) return [...BOOTSTRAP_ADMINS];
  const emails = Array.isArray(res.Item.emails) ? res.Item.emails : [];
  if (emails.length === 0) return [...BOOTSTRAP_ADMINS];
  return emails;
}

export async function isAdminEmail(email) {
  const norm = normalize(email);
  if (!norm) return false;
  const admins = await listAdmins();
  return admins.map(normalize).includes(norm);
}

/** Idempotently add an email to the admin list. Returns the resulting list. */
export async function addAdmin(email) {
  const norm = normalize(email);
  if (!norm) throw Object.assign(new Error("Email is required"), { statusCode: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) {
    throw Object.assign(new Error("Invalid email"), { statusCode: 400 });
  }
  const current = await listAdmins();
  const set = new Set(current.map(normalize));
  set.add(norm);
  const next = Array.from(set);
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: CONFIG_PK, sk: ADMINS_SK },
    UpdateExpression: "SET emails = :e, updatedAt = :u",
    ExpressionAttributeValues: { ":e": next, ":u": new Date().toISOString() },
  }));
  return next;
}
