// GET /api/workloads
// Lists the caller's private workloads, newest first. Payloads omitted from the list view.

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, userPk } from "../shared/ddb.mjs";
import { getCallerSub } from "../shared/auth.mjs";
import { ok, serverError } from "../shared/http.mjs";

export const handler = async (event) => {
  try {
    const sub = getCallerSub(event);

    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "byUpdatedAt",
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": userPk(sub) },
      ProjectionExpression: "id, #n, createdAt, updatedAt",
      ExpressionAttributeNames: { "#n": "name" },
      ScanIndexForward: false,
      Limit: 200,
    }));

    return ok({ workloads: res.Items ?? [] });
  } catch (err) {
    return serverError(err);
  }
};
