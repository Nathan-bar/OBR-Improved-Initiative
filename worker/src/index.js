const upstream = "https://improvedinitiative.app";

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export default {
  async fetch(request) {
    const headers = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers });

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/playerviews\/([A-Za-z0-9_-]+)$/);
    if (!match) return new Response("Not Found", { status: 404, headers });

    const response = await fetch(`${upstream}/playerviews/${encodeURIComponent(match[1])}`);
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  },
};
