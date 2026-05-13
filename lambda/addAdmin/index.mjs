// POST /api/admins  { email }
// Admin-only. Idempotently appends an email to the admins list.

import { getCallerSub } from "../shared/auth.mjs";
import { ok, forbidden, badRequest, serverError, parseJsonBody } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";
import { addAdmin, isAdminEmail } from "../shared/admins.mjs";
import { resolveCallerEmail } from "../shared/userEmail.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  try {
    getCallerSub(event);
    const callerEmail = await resolveCallerEmail(event);
    if (!(await isAdminEmail(callerEmail))) {
      log.warn("addAdmin: forbidden", { callerEmail });
      return forbidden("Only admins can promote other users");
    }
    const body = parseJsonBody(event);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return badRequest("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Invalid email");
    const admins = await addAdmin(email);
    log.info("addAdmin: promoted", { promoted: email, by: callerEmail });
    return ok({ admins });
  } catch (err) {
    return serverError(err, log);
  }
};
