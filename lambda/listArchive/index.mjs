// GET /api/archive
// Lists every published workload, newest-published first. Payloads omitted.

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, ARCHIVE_PK } from "../shared/ddb.mjs";
import { getCallerSub } from "../shared/auth.mjs";
import { ok, serverError } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  log.info("listArchive: request received");
  try {
    // Require a valid token (enforced by the JWT authorizer too) but don't filter by sub.
    getCallerSub(event);

    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "byUpdatedAt",
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": ARCHIVE_PK },
      ProjectionExpression: "id, #n, ownerEmail, publishedAt, updatedAt",
      ExpressionAttributeNames: { "#n": "name" },
      ScanIndexForward: false,
      Limit: 500,
    }));

    const workloads = res.Items ?? [];
    log.info("listArchive: returned", { count: workloads.length });
    return ok({ workloads });
  } catch (err) {
    return serverError(err, log);
  }
};
