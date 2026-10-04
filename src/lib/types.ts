// 평가 기준(루브릭)의 개별 항목
export interface Criterion {
  id: string;
  name: string; // 예: "내용 이해"
  maxScore: number; // 배점
  description: string; // 채점 기준 (성취 수준별 설명 등)
}

export interface Rubric {
  id: string;
  title: string; // 예: "3단원 생태계 활동지"
  taskDescription: string; // 과제/활동지 설명
  criteria: Criterion[];
  createdAt?: number;
  updatedAt?: number;
}

export type RubricInput = Omit<Rubric, "id" | "createdAt" | "updatedAt">;

// Gemini OCR 결과
export interface OcrResult {
  text: string;
  studentName: string;
  studentId: string;
  pageCount: number;
}

// 항목별 평가 결과
export interface CriterionResult {
  criterionId: string;
  name: string;
  score: number;
  maxScore: number;
  level: string; // 예: "상/중/하" 또는 "우수/보통/노력 필요"
  rationale: string; // 채점 근거
  evidence: string; // 학생 답안에서 인용한 근거
}

export interface Evaluation {
  criteria: CriterionResult[];
  totalScore: number;
  maxTotal: number;
  overallFeedback: string;
  model: string;
  gradedAt: number;
  editedByTeacher?: boolean;
}

export interface Submission {
  id: string;
  rubricId: string;
  rubricTitle: string;
  studentName: string;
  studentId: string;
  fileName: string;
  extractedText: string;
  evaluation: Evaluation | null;
  createdAt: number;
  updatedAt: number;
}

export type SubmissionInput = Omit<Submission, "id" | "createdAt" | "updatedAt">;
