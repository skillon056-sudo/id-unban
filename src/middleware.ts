import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE } from "@/lib/auth";

function securityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "0");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi =
    pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";

  if (isAdminPage || isAdminApi) {
    const token = req.cookies.get(AUTH_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      if (isAdminApi) {
        return securityHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return securityHeaders(NextResponse.redirect(url));
    }
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
