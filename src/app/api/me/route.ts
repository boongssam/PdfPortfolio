import { errorResponse, verifyRequest } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// 로그인한 계정이 이 앱을 쓸 수 있는지(ALLOWED_EMAILS) 확인합니다.
export async function GET(req: Request) {
  try {
    const user = await verifyRequest(req);
    return Response.json({ email: user.email ?? "" });
  } catch (err) {
    return errorResponse(err);
  }
}
