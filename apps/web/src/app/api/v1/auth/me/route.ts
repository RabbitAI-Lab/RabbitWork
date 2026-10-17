import { requireUser } from "@/server/auth";
import { jsonOk, toErrorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ id: user.uid, name: user.name, role: user.role, email: "" });
  } catch (e) {
    return toErrorResponse(e);
  }
}
