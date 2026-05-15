// DELETE /api/workloads/{id}
// Deletes the caller's workload. If a matching archive entry exists and is owned
// by the caller, removes that too so the scenario fully disappears.

import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, userPk, wlSk, ARCHIVE_PK } from "../shared/ddb.mjs";
import { requireDatadogUser } from "../shared/userEmail.mjs";
import { ok, badRequest, notFound, serverError } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  log.info("deleteWorkload: request received");
  try {
    const { sub } = await requireDatadogUser(event);
    const id = event?.pathParameters?.id;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      log.warn("deleteWorkload: invalid id", { id });
      return badRequest("Invalid workload id");
    }

    const own = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: wlSk(id) },
      ProjectionExpression: "id",
    }));
    if (!own.Item) {
      log.warn("deleteWorkload: not found", { id });
      return notFound("Workload not found");
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pk: userPk(sub), sk: wlSk(id) },
    }));

    const archive = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: ARCHIVE_PK, sk: wlSk(id) },
      ProjectionExpression: "ownerSub",
    }));
    let archiveDeleted = false;
    if (archive.Item && archive.Item.ownerSub === sub) {
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { pk: ARCHIVE_PK, sk: wlSk(id) },
      }));
      archiveDeleted = true;
    }

    log.info("deleteWorkload: deleted", { id, archiveDeleted });
    return ok({ id, archiveDeleted });
  } catch (err) {
    return serverError(err, log);
  }
};
