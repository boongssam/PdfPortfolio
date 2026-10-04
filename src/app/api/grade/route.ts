import { errorResponse, verifyRequest } from "@/lib/firebaseAdmin";
import { gradeSubmission, type GradeInput } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    await verifyRequest(req);

    const body = (await req.json()) as Partial<GradeInput>;
    const criteria = body.rubric?.criteria;
    if (!body.text?.trim()) {
      return Response.json({ error: "평가할 텍스트가 없습니다." }, { status: 400 });
    }
    if (!body.rubric || !Array.isArray(criteria) || criteria.length === 0) {
      return Response.json({ error: "평가 기준이 없습니다." }, { status: 400 });
    }

    const evaluation = await gradeSubmission({
      text: body.text,
      rubric: {
        title: String(body.rubric.title ?? ""),
        taskDescription: String(body.rubric.taskDescription ?? ""),
        criteria: criteria.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          maxScore: Number(c.maxScore) || 0,
          description: String(c.description ?? ""),
        })),
      },
    });
    return Response.json(evaluation);
  } catch (err) {
    return errorResponse(err);
  }
}
