// GET /api/pricing — returns the list-price catalog and SIEM volume tiers.
// Gated by requireDatadogUser so prices never ship anonymously.

import { ok, serverError } from "../shared/http.mjs";
import { makeLogger } from "../shared/log.mjs";
import { requireDatadogUser } from "../shared/userEmail.mjs";
import { DEFAULT_PRICING, SIEM_TIERS } from "../shared/pricingCatalog.mjs";

export const handler = async (event, context) => {
  const log = makeLogger(event, context);
  try {
    await requireDatadogUser(event);
    return ok({ pricing: DEFAULT_PRICING, siemTiers: SIEM_TIERS });
  } catch (err) {
    return serverError(err, log);
  }
};
