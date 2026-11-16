import { handle } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path);
}
export { route as GET, route as POST, route as PUT, route as DELETE };
