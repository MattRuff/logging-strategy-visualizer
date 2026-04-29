export function ok(body) {
  return jsonResponse(200, body);
}

export function created(body) {
  return jsonResponse(201, body);
}

export function noContent() {
  return { statusCode: 204, headers: corsHeaders() };
}

export function badRequest(message) {
  return jsonResponse(400, { error: message });
}

export function notFound(message = "Not found") {
  return jsonResponse(404, { error: message });
}

export function forbidden(message = "Forbidden") {
  return jsonResponse(403, { error: message });
}

export function serverError(err) {
  console.error("handler error", err);
  return jsonResponse(err?.statusCode ?? 500, {
    error: err?.publicMessage ?? "Internal error",
  });
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
}

export function parseJsonBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;
  try {
    return JSON.parse(raw, (key, value) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
      return value;
    });
  } catch {
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    err.publicMessage = "Invalid JSON body";
    throw err;
  }
}
