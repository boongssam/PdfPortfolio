import { errorResponse, verifyRequest } from "@/lib/firebaseAdmin";
import { extractTextFromPdf } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

// Gemini 인라인 PDF 전송 한도(요청당 20MB)를 고려한 업로드 제한
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    await verifyRequest(req);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "PDF 파일이 없습니다." }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "파일이 너무 큽니다. (최대 15MB)" }, { status: 413 });
    }

    const result = await extractTextFromPdf(Buffer.from(await file.arrayBuffer()));
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
