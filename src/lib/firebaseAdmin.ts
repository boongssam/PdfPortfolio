// 서버 전용: API 요청의 Firebase 로그인 토큰 검증
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function adminApp() {
  // ID 토큰 검증에는 프로젝트 ID만 있으면 되므로 서비스 계정 키가 필요 없습니다.
  return getApps()[0] ?? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ALLOWED_EMAILS="a@school.kr,b@school.kr" 를 설정하면 해당 계정만 Gemini API를 쓸 수 있습니다.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function verifyRequest(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthError("로그인이 필요합니다.", 401);

  let decoded: DecodedIdToken;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    throw new AuthError("로그인 정보가 유효하지 않습니다. 다시 로그인해 주세요.", 401);
  }

  if (
    allowedEmails.length > 0 &&
    !(decoded.email_verified && allowedEmails.includes((decoded.email ?? "").toLowerCase()))
  ) {
    throw new AuthError("이 계정은 사용 권한이 없습니다.", 403);
  }
  return decoded;
}

export function errorResponse(err: unknown) {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
  if (status === 500) console.error(err);
  return Response.json({ error: message }, { status });
}
