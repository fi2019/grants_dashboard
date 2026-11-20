/**
 * MCP endpoint (Streamable HTTP, stateless). Add it to Claude as a custom
 * connector at https://<your-host>/api/mcp, or https://<your-host>/api/mcp?key=<MCP_ACCESS_KEY>
 * when MCP_ACCESS_KEY is set.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createForgeMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const key = process.env.MCP_ACCESS_KEY;
  if (!key) return true;
  const url = new URL(req.url);
  return url.searchParams.get("key") === key || req.headers.get("authorization") === `Bearer ${key}`;
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  // Stateless: a fresh server and transport per request.
  const server = createForgeMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
