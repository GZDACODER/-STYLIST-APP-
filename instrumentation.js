// Next.js calls onRequestError for any error a page, route, server action or
// the proxy didn't catch. Each one is emailed to the owner (see
// lib/errorAlerts.js).
export async function onRequestError(error, request, context) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/errorAlerts");
  const kind = { render: "Page", route: "API route", action: "Button / form", proxy: "Proxy" }[context?.routeType] || "Server";
  await reportError(`${kind} error`, error, {
    path: `${request?.method || ""} ${String(request?.path || "").split("?")[0]}`.trim(),
    extra: context?.routePath ? `Route file: ${context.routePath}` : "",
  });
}
