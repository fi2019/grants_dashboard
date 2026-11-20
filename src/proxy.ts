import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic auth for the whole app. Set DASHBOARD_PASSWORD to enable
 * (any username). Replace with SSO before broad rollout.
 */
export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  // The MCP endpoint has its own key (MCP_ACCESS_KEY); Claude can't send Basic auth.
  if (req.nextUrl.pathname === "/api/mcp") return NextResponse.next();

  const cron = process.env.CRON_SECRET;
  if (cron && req.nextUrl.pathname === "/api/scan" && req.headers.get("authorization") === `Bearer ${cron}`) {
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Forge Grants"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forge-logo.webp).*)"],
};
