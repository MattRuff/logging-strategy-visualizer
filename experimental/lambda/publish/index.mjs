// POST /api/workloads/{id}/publish
// Copies the caller's workload into the ARCHIVE partition.
// If an archive entry already exists with a different ownerSub, refuse.

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, userPk, wlSk, ARCHIVE_PK } from "../shared/ddb.mjs";
import { getCallerSub, getCallerEmail } from "../shared/auth.mjs";
import { ok, notFound, forbidden, badRequest, serverError } from "../shared/http.mjs";

export const handler = async (event) => {
  try {
    const sub = getCallerSub(event);
    const email = getCallerEmail(event);
    const id = event?.pathParameters?.id;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return badRequest("Invalid workload id");

    const own = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: wlSk(id) },
    }));
    if (!own.Item) return notFound("Workload not found");

    const existingArchive = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: ARCHIVE_PK, sk: wlSk(id) },
      ProjectionExpression: "ownerSub",
    }));
    if (existingArchive.Item && existingArchive.Item.ownerSub !== sub) {
      return forbidden("Workload id already published by another user");
    }

    const now = new Date().toISOString();
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: ARCHIVE_PK,
        sk: wlSk(id),
        id,
        name: own.Item.name,
        payload: own.Item.payload,
        ownerSub: sub,
        ownerEmail: email,
        publishedAt: existingArchive.Item?.publishedAt ?? now,
        updatedAt: now,
      },
    }));

    return ok({ id, publishedAt: existingArchive.Item?.publishedAt ?? now, updatedAt: now });
  } catch (err) {
    return serverError(err);
  }
};
