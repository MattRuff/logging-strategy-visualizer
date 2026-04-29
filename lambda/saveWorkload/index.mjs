// PUT /api/workloads/{id}
// Body: { name: string, payload: object }
// Writes to USER#<sub> / WL#<id>. Idempotent — overwrites prior value.

import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, userPk, wlSk } from "../shared/ddb.mjs";
import { getCallerSub } from "../shared/auth.mjs";
import { ok, badRequest, parseJsonBody, serverError } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";

const MAX_PAYLOAD_BYTES = 350_000; // stay under DynamoDB's 400KB item limit

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  log.info("saveWorkload: request received");
  try {
    const sub = getCallerSub(event);
    const id = event?.pathParameters?.id;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      log.warn("saveWorkload: invalid id", { id });
      return badRequest("Invalid workload id");
    }

    const body = parseJsonBody(event);
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : null;
    if (!name) {
      log.warn("saveWorkload: missing name", { id });
      return badRequest("name is required");
    }
    if (typeof body.payload !== "object" || body.payload === null) {
      log.warn("saveWorkload: missing or invalid payload", { id });
      return badRequest("payload is required and must be an object");
    }

    const payloadJson = JSON.stringify(body.payload);
    const payloadBytes = Buffer.byteLength(payloadJson, "utf-8");
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      log.warn("saveWorkload: payload too large", { id, payloadBytes, limit: MAX_PAYLOAD_BYTES });
      return badRequest("payload too large");
    }

    const now = new Date().toISOString();

    // Read existing to preserve createdAt.
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: wlSk(id) },
      ProjectionExpression: "createdAt",
    }));
    const isNew = !existing.Item;
    const createdAt = existing.Item?.createdAt ?? now;

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: userPk(sub),
        sk: wlSk(id),
        id,
        name,
        payload: payloadJson,
        ownerSub: sub,
        createdAt,
        updatedAt: now,
      },
    }));

    log.info("saveWorkload: saved", { id, isNew, payloadBytes, name_length: name.length });
    return ok({ id, name, updatedAt: now, createdAt });
  } catch (err) {
    return serverError(err, log);
  }
};
