// Structured JSON logger. One line per event, CloudWatch reads it as JSON
// out of the box and the Datadog Lambda Forwarder will auto-parse fields when
// it's wired up later.

export const SERVICE = "log-workflow";

export function makeLogger(event, context) {
  const base = {
    service: SERVICE,
    aws_request_id: context?.awsRequestId,
    function_name: context?.functionName ?? process.env.AWS_LAMBDA_FUNCTION_NAME,
    method: event?.requestContext?.http?.method,
    path: event?.rawPath,
    route: event?.routeKey,
    sourceIp: event?.requestContext?.http?.sourceIp,
    userAgent: event?.requestContext?.http?.userAgent,
    sub: event?.requestContext?.authorizer?.jwt?.claims?.sub,
  };
  const start = Date.now();

  function emit(level, message, fields) {
    const line = {
      level,
      message,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
      ...base,
      ...(fields ?? {}),
    };
    const out = JSON.stringify(line);
    if (level === "error") console.error(out);
    else if (level === "warn") console.warn(out);
    else console.log(out);
  }

  return {
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
  };
}
