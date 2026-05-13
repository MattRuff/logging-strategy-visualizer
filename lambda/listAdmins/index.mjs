// GET /api/admins
// Returns the current admin email list. Any signed-in caller may read it
// (the client uses it to show the badge / decide whether to render the
// "Add admin" form in Settings).

import { getCallerSub } from "../shared/auth.mjs";
import { ok, serverError } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";
import { listAdmins, isAdminEmail } from "../shared/admins.mjs";
import { resolveCallerEmail } from "../shared/userEmail.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  try {
    getCallerSub(event);
    const callerEmail = await resolveCallerEmail(event);
    const admins = await listAdmins();
    const isCallerAdmin = await isAdminEmail(callerEmail);
    log.info("listAdmins: returned", { count: admins.length, isCallerAdmin, callerEmail });
    return ok({ admins, isCallerAdmin });
  } catch (err) {
    return serverError(err, log);
  }
};
