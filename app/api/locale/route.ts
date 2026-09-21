/** Cloudflare request metadata is trusted; client headers are not country evidence. */
export function GET(request: Request) {
  const raw = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  const country =
    typeof raw === "string" && /^[A-Z]{2}$/.test(raw) && raw !== "XX"
      ? raw
      : null;
  return Response.json(
    { country, source: country ? "network-country" : "unknown" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
