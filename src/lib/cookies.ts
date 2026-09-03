// Reads one cookie from a request header.
//
// Deliberately not a regex: building one by interpolating into a template
// literal silently swallowed the backslash in \s, so the pattern only ever
// matched the first cookie in the jar and _fbp/_fbc were read as absent.
export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}
