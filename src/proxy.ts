import { NextResponse, type NextRequest } from "next/server";

// Every visitor gets an isolated demo workspace (no auth: deliberately cut).
// `?internal=1` marks the browser as a rehearsal so it can be excluded from real usage numbers.
export function proxy(req: NextRequest) {
  let res: NextResponse;
  if (!req.cookies.get("dsk_ws")) {
    const id = "ws_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    req.cookies.set("dsk_ws", id); // visible to the page/route rendering this same request
    res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set("dsk_ws", id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
  } else {
    res = NextResponse.next();
  }
  const flag = req.nextUrl.searchParams.get("internal");
  if (flag === "1") res.cookies.set("dsk_internal", "1", { maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}

// MCP clients bring their own workspace in the URL, so /api/mcp is excluded.
export const config = { matcher: ["/((?!_next/|favicon.ico|invoices/|samples/|api/mcp).*)"] };
