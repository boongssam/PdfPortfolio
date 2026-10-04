// 서버 전용: Gemini API 호출 (API 키가 브라우저로 노출되지 않도록 Route Handler에서만 사용)
import { GoogleGenAI } from "@google/genai";
import type { Criterion, CriterionResult, Evaluation, OcrResult } from "./types";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function parseJson<T>(text: string | undefined): T {
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
  }
}

const OCR_PROMPT = `당신은 한국 학교의 학생 활동지를 디지털 텍스트로 옮기는 OCR 전문가입니다.
첨부된 PDF의 모든 페이지를 순서대로 읽고 다음 규칙에 따라 텍스트로 옮기세요.

규칙:
1. 인쇄된 문항과 학생이 쓴 내용(손글씨 포함)을 빠짐없이 원문 그대로 옮깁니다.
2. 맞춤법·띄어쓰기를 교정하거나 내용을 요약·추가하지 않습니다.
3. 학생이 직접 작성한 답변은 해당 줄 앞에 "▶ "를 붙여 인쇄된 문항과 구분합니다.
4. 읽을 수 없는 글자는 [판독불가]로 표시합니다.
5. 표는 "|"로 칸을 구분해 한 행씩 옮기고, 그림·도표는 [그림: 간단한 설명]으로 표시합니다.
6. 페이지가 바뀌면 "--- N쪽 ---" 줄을 넣습니다.
7. 활동지에 학생 이름, 학번(또는 반·번호)이 적혀 있으면 studentName, studentId에 넣고, 없으면 빈 문자열로 둡니다.`;

const OCR_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "활동지 전체 텍스트" },
    studentName: { type: "string" },
    studentId: { type: "string" },
    pageCount: { type: "integer" },
  },
  required: ["text", "studentName", "studentId", "pageCount"],
};

export async function extractTextFromPdf(pdf: Buffer): Promise<OcrResult> {
  const res = await getClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
          { text: OCR_PROMPT },
        ],
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: OCR_SCHEMA,
    },
  });
  const parsed = parseJson<Partial<OcrResult>>(res.text);
  return {
    text: parsed.text?.trim() ?? "",
    studentName: parsed.studentName?.trim() ?? "",
    studentId: parsed.studentId?.trim() ?? "",
    pageCount: parsed.pageCount ?? 0,
  };
}

export interface GradeInput {
  text: string;
  rubric: { title: string; taskDescription: string; criteria: Criterion[] };
}

const GRADE_SCHEMA = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string" },
          score: { type: "number" },
          level: { type: "string" },
          rationale: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["criterionId", "score", "level", "rationale", "evidence"],
      },
    },
    overallFeedback: { type: "string" },
  },
  required: ["criteria", "overallFeedback"],
};

function buildGradePrompt({ text, rubric }: GradeInput): string {
  const criteria = rubric.criteria
    .map(
      (c, i) =>
        `${i + 1}. [criterionId: ${c.id}] ${c.name} (배점 ${c.maxScore}점)\n   채점 기준: ${c.description || "(별도 설명 없음)"}`,
    )
    .join("\n");

  return `당신은 공정하고 꼼꼼한 교사로서 학생의 수행평가 활동지를 채점합니다.

## 과제
${rubric.title}
${rubric.taskDescription || ""}

## 평가 기준
${criteria}

## 학생 활동지 (OCR 텍스트, "▶"로 시작하는 줄이 학생이 작성한 답변)
"""
${text}
"""

## 채점 지침
- 반드시 위 평가 기준의 모든 항목을 criterionId 그대로 하나씩 채점합니다.
- score는 0 이상 배점 이하로 주고, 채점 기준에 성취 수준별 점수가 있으면 그대로 따릅니다.
- level에는 성취 수준(예: 상/중/하)을 적습니다. 채점 기준에 수준 이름이 있으면 그 이름을 씁니다.
- 인쇄된 문항이 아니라 학생이 실제로 작성한 내용만 근거로 삼습니다.
- rationale에는 그 점수를 준 이유를 2~3문장으로 씁니다.
- evidence에는 학생 답안에서 근거가 되는 부분을 짧게 그대로 인용하고, 해당 내용이 없으면 "해당 내용 없음"이라고 씁니다.
- [판독불가] 부분은 감점 근거로 삼지 말고 rationale에 판독 문제를 언급합니다.
- overallFeedback에는 학생의 강점과 보완할 점을 담아 학생에게 줄 피드백을 3~4문장으로 씁니다.`;
}

export async function gradeSubmission(input: GradeInput): Promise<Evaluation> {
  const res = await getClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: buildGradePrompt(input),
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: GRADE_SCHEMA,
    },
  });
  const parsed = parseJson<{
    criteria: Omit<CriterionResult, "name" | "maxScore">[];
    overallFeedback: string;
  }>(res.text);

  // 모델 출력과 무관하게 루브릭 순서·배점을 기준으로 결과를 정리하고 점수 범위를 보정
  const criteria: CriterionResult[] = input.rubric.criteria.map((c) => {
    const r = parsed.criteria?.find((x) => x.criterionId === c.id);
    const score = Math.min(c.maxScore, Math.max(0, Number(r?.score) || 0));
    return {
      criterionId: c.id,
      name: c.name,
      maxScore: c.maxScore,
      score,
      level: r?.level ?? "",
      rationale: r?.rationale ?? "평가 결과를 받지 못했습니다. 다시 평가해 주세요.",
      evidence: r?.evidence ?? "",
    };
  });

  return {
    criteria,
    totalScore: criteria.reduce((s, c) => s + c.score, 0),
    maxTotal: criteria.reduce((s, c) => s + c.maxScore, 0),
    overallFeedback: parsed.overallFeedback ?? "",
    model: GEMINI_MODEL,
    gradedAt: Date.now(),
  };
}
