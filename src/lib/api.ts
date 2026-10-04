// 브라우저 → Next.js API(Route Handler) 호출. 로그인 토큰을 함께 보냅니다.
import { firebaseAuth } from "./firebase";
import type { Evaluation, OcrResult, Rubric } from "./types";

async function authedFetch<T>(path: string, init: RequestInit): Promise<T> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  const token = await user.getIdToken();

  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `요청에 실패했습니다. (${res.status})`);
  return body as T;
}

export function ocrPdf(file: File): Promise<OcrResult> {
  const form = new FormData();
  form.append("file", file);
  return authedFetch<OcrResult>("/api/ocr", { method: "POST", body: form });
}

export function gradeText(text: string, rubric: Rubric): Promise<Evaluation> {
  return authedFetch<Evaluation>("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      rubric: {
        title: rubric.title,
        taskDescription: rubric.taskDescription,
        criteria: rubric.criteria,
      },
    }),
  });
}
