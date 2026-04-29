// GET /api/workloads/{id}
// Returns the caller's private workload, or — if not found — the archived copy.
// Archive items are read-only on the client; the server returns a `readOnly` flag.

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, userPk, wlSk, ARCHIVE_PK } from "../shared/ddb.mjs";
import { getCallerSub } from "../shared/auth.mjs";
import { ok, notFound, badRequest, serverError } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  log.info("loadWorkload: request received");
  try {
    const sub = getCallerSub(event);
    const id = event?.pathParameters?.id;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      log.warn("loadWorkload: invalid id", { id });
      return badRequest("Invalid workload id");
    }

    const own = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: wlSk(id) },
    }));

    if (own.Item) {
      log.info("loadWorkload: returned own workload", { id, source: "user" });
      return ok(formatItem(own.Item, false));
    }

    const archived = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: ARCHIVE_PK, sk: wlSk(id) },
    }));

    if (archived.Item) {
      log.info("loadWorkload: returned archived workload", { id, source: "archive", ownerSub: archived.Item.ownerSub });
      return ok(formatItem(archived.Item, true));
    }

    log.warn("loadWorkload: not found", { id });
    return notFound();
  } catch (err) {
    return serverError(err, log);
  }
};

function formatItem(item, readOnly) {
  return {
    id: item.id,
    name: item.name,
    payload: JSON.parse(item.payload),
    ownerSub: item.ownerSub,
    ownerEmail: item.ownerEmail ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt ?? null,
    readOnly,
  };
}
