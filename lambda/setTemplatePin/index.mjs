// POST /api/archive/{id}/pin   { pinned: boolean }
// Admin-only. Sets isOfficial on the archived (template) item so it pins to the
// top of the templates list (or unpins it).

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, wlSk, ARCHIVE_PK } from "../shared/ddb.mjs";
import { ok, forbidden, badRequest, notFound, serverError, parseJsonBody } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";
import { isAdminEmail } from "../shared/admins.mjs";
import { requireDatadogUser } from "../shared/userEmail.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  try {
    const { email: callerEmail } = await requireDatadogUser(event);
    if (!(await isAdminEmail(callerEmail))) {
      return forbidden("Only admins can pin templates");
    }
    const id = event?.pathParameters?.id;
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return badRequest("Invalid template id");
    }
    const body = parseJsonBody(event);
    const pinned = Boolean(body?.pinned);

    try {
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { pk: ARCHIVE_PK, sk: wlSk(id) },
        UpdateExpression: "SET isOfficial = :p, updatedAt = :u",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeValues: { ":p": pinned, ":u": new Date().toISOString() },
      }));
    } catch (err) {
      if (err?.name === "ConditionalCheckFailedException") return notFound("Template not found");
      throw err;
    }

    log.info("setTemplatePin: updated", { id, pinned, by: callerEmail });
    return ok({ id, isOfficial: pinned });
  } catch (err) {
    return serverError(err, log);
  }
};
