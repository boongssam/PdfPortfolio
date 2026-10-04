"use client";

import type { User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/AuthProvider";
import { gradeText, ocrPdf } from "@/lib/api";
import { createSubmission, listRubrics } from "@/lib/db";
import type { Rubric } from "@/lib/types";

type Status = "대기" | "텍스트 변환 중" | "평가 중" | "저장 중" | "완료" | "오류";

interface Job {
  key: string;
  file: File;
  status: Status;
  error?: string;
  studentName?: string;
  score?: string;
  submissionId?: string;
}

const MAX_MB = 15;

export default function EvaluatePage() {
  return <RequireAuth>{(user) => <Evaluator user={user} />}</RequireAuth>;
}

function Evaluator({ user }: { user: User }) {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRubrics(user.uid).then((list) => {
      setRubrics(list);
      if (list[0]) setRubricId(list[0].id);
    });
  }, [user.uid]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setJobs((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: (file.size > MAX_MB * 1024 * 1024 ? "오류" : "대기") as Status,
        error: file.size > MAX_MB * 1024 * 1024 ? `${MAX_MB}MB 이하 파일만 가능합니다.` : undefined,
      })),
    ]);
  };

  const patchJob = (key: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const run = async () => {
    const rubric = rubrics.find((r) => r.id === rubricId);
    if (!rubric) return;
    setRunning(true);
    // 요청 제한(rate limit)을 피하기 위해 한 파일씩 순서대로 처리합니다.
    for (const job of jobs.filter((j) => j.status === "대기")) {
      try {
        patchJob(job.key, { status: "텍스트 변환 중" });
        const ocr = await ocrPdf(job.file);
        if (!ocr.text) throw new Error("PDF에서 텍스트를 찾지 못했습니다.");
        const studentName = ocr.studentName || job.file.name.replace(/\.pdf$/i, "");
        patchJob(job.key, { status: "평가 중", studentName });

        const evaluation = await gradeText(ocr.text, rubric);
        patchJob(job.key, { status: "저장 중" });

        const submissionId = await createSubmission(user.uid, {
          rubricId: rubric.id,
          rubricTitle: rubric.title,
          studentName,
          studentId: ocr.studentId,
          fileName: job.file.name,
          extractedText: ocr.text,
          evaluation,
        });
        patchJob(job.key, {
          status: "완료",
          submissionId,
          score: `${evaluation.totalScore} / ${evaluation.maxTotal}`,
        });
      } catch (e) {
        patchJob(job.key, { status: "오류", error: (e as Error).message });
      }
    }
    setRunning(false);
  };

  const retryFailed = () =>
    setJobs((prev) =>
      prev.map((j) =>
        j.status === "오류" && j.file.size <= MAX_MB * 1024 * 1024 ? { ...j, status: "대기", error: undefined } : j,
      ),
    );

  const pending = jobs.filter((j) => j.status === "대기").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">PDF 평가하기</h1>

      <div className="card space-y-4">
        <div>
          <label className="label">적용할 평가 기준</label>
          {rubrics.length === 0 ? (
            <p className="text-sm text-slate-600">
              먼저{" "}
              <Link href="/rubrics" className="text-indigo-600 underline">
                평가 기준
              </Link>
              을 만들어 주세요.
            </p>
          ) : (
            <select className="input" value={rubricId} onChange={(e) => setRubricId(e.target.value)} disabled={running}>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.criteria.reduce((s, c) => s + c.maxScore, 0)}점 만점)
                </option>
              ))}
            </select>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400"
          }`}
        >
          <p className="font-medium">학생 활동지 PDF를 끌어다 놓거나 클릭해서 선택하세요</p>
          <p className="mt-1 text-sm text-slate-500">여러 파일을 한 번에 올릴 수 있습니다 · 파일당 최대 {MAX_MB}MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={run} disabled={running || pending === 0 || !rubricId}>
            {running ? "처리 중…" : `평가 시작 (${pending}개)`}
          </button>
          {jobs.some((j) => j.status === "오류") && !running && (
            <button className="btn-secondary" onClick={retryFailed}>
              실패한 파일 다시 시도
            </button>
          )}
          {jobs.length > 0 && !running && (
            <button className="btn-secondary" onClick={() => setJobs([])}>
              목록 비우기
            </button>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">파일</th>
                <th className="px-4 py-3">학생</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">점수</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.key} className="border-t border-slate-100">
                  <td className="px-4 py-3">{j.file.name}</td>
                  <td className="px-4 py-3">{j.studentName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
                    {j.error && <div className="mt-1 text-xs text-red-600">{j.error}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium">{j.score ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {j.submissionId && (
                      <Link href={`/results/${j.submissionId}`} className="text-indigo-600 hover:underline">
                        결과 보기
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const color =
    status === "완료"
      ? "bg-emerald-50 text-emerald-700"
      : status === "오류"
        ? "bg-red-50 text-red-700"
        : status === "대기"
          ? "bg-slate-100 text-slate-600"
          : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{status}</span>;
}
