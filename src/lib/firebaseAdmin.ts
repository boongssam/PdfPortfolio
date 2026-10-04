// 서버 전용: API 요청의 Firebase 로그인 토큰 검증
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function adminApp() {
  // ID 토큰 검증에는 프로젝트 ID만 있으면 되므로 서비스 계정 키가 필요 없습니다.
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export async function verifyRequest(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthError("로그인이 필요합니다.", 401);

  try {
    // Authentication에서 삭제·사용 중지된 계정은 Firebase가 새 토큰을 발급하지 않으므로 여기서 걸러집니다.
    return await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    throw new AuthError("로그인 정보가 유효하지 않습니다. 다시 로그인해 주세요.", 401);
  }
}

export function errorResponse(err: unknown) {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
  if (status === 500) console.error(err);
  return Response.json({ error: message }, { status });
}
