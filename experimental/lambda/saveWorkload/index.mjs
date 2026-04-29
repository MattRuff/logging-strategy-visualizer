// PUT /api/workloads/{id}
// Body: { name: string, payload: object }
// Writes to USER#<sub> / WL#<id>. Idempotent — overwrites prior value.

import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, userPk, wlSk } from "../shared/ddb.mjs";
import { getCallerSub } from "../shared/auth.mjs";
import { ok, badRequest, parseJsonBody, serverError } from "../shared/http.mjs";

const MAX_PAYLOAD_BYTES = 350_000; // stay under DynamoDB's 400KB item limit

export const handler = async (event) => {
  try {
    const sub = getCallerSub(event);
    const id = event?.pathParameters?.id;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return badRequest("Invalid workload id");
    }

    const body = parseJsonBody(event);
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : null;
    if (!name) return badRequest("name is required");
    if (typeof body.payload !== "object" || body.payload === null) {
      return badRequest("payload is required and must be an object");
    }

    const payloadJson = JSON.stringify(body.payload);
    if (Buffer.byteLength(payloadJson, "utf-8") > MAX_PAYLOAD_BYTES) {
      return badRequest("payload too large");
    }

    const now = new Date().toISOString();

    // Read existing to preserve createdAt.
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: wlSk(id) },
      ProjectionExpression: "createdAt",
    }));
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

    return ok({ id, name, updatedAt, createdAt });
  } catch (err) {
    return serverError(err);
  }
};
