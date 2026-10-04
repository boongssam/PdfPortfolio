"use client";

import type { User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/AuthProvider";
import { listRubrics, listSubmissions } from "@/lib/db";
import type { Rubric, Submission } from "@/lib/types";

export default function ResultsPage() {
  return <RequireAuth>{(user) => <Results user={user} />}</RequireAuth>;
}

function Results({ user }: { user: User }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listSubmissions(user.uid), listRubrics(user.uid)])
      .then(([s, r]) => {
        setSubmissions(s);
        setRubrics(r);
      })
      .catch((e: Error) => setError(e.message));
  }, [user.uid]);

  // 결과에 있는 평가 기준(삭제된 기준 포함)으로 필터 목록 구성
  const rubricOptions = useMemo(() => {
    const map = new Map<string, string>();
    submissions?.forEach((s) => map.set(s.rubricId, s.rubricTitle));
    rubrics.forEach((r) => map.set(r.id, r.title));
    return [...map.entries()];
  }, [submissions, rubrics]);

  const filtered = (submissions ?? []).filter((s) => !rubricId || s.rubricId === rubricId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-2xl font-bold">평가 결과</h1>
        <select className="input w-auto" value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
          <option value="">전체 평가 기준</option>
          {rubricOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <button className="btn-secondary" disabled={filtered.length === 0} onClick={() => downloadCsv(filtered)}>
          CSV 내려받기
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!submissions && !error && <p className="text-slate-500">불러오는 중…</p>}
      {submissions && filtered.length === 0 && (
        <p className="text-slate-500">
          아직 평가 결과가 없습니다.{" "}
          <Link href="/evaluate" className="text-indigo-600 underline">
            PDF 평가하기
          </Link>
        </p>
      )}

      {filtered.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">학번</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">평가 기준</th>
                <th className="px-4 py-3">총점</th>
                <th className="px-4 py-3">평가일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{s.studentId || "-"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/results/${s.id}`} className="font-medium text-indigo-700 hover:underline">
                      {s.studentName || s.fileName}
                    </Link>
                    {s.evaluation?.editedByTeacher && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">교사 수정</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.rubricTitle}</td>
                  <td className="px-4 py-3 font-semibold">
                    {s.evaluation ? `${s.evaluation.totalScore} / ${s.evaluation.maxTotal}` : "미평가"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function downloadCsv(rows: Submission[]) {
  const criteriaNames = [...new Set(rows.flatMap((s) => s.evaluation?.criteria.map((c) => c.name) ?? []))];
  const header = ["학번", "이름", "파일명", "평가 기준", ...criteriaNames, "총점", "만점", "종합 피드백", "평가일"];
  const lines = rows.map((s) => {
    const ev = s.evaluation;
    return [
      s.studentId,
      s.studentName,
      s.fileName,
      s.rubricTitle,
      ...criteriaNames.map((n) => ev?.criteria.find((c) => c.name === n)?.score ?? ""),
      ev?.totalScore ?? "",
      ev?.maxTotal ?? "",
      ev?.overallFeedback ?? "",
      new Date(s.createdAt).toLocaleString("ko-KR"),
    ];
  });
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...lines].map((r) => r.map(escape).join(",")).join("\r\n");
  // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 추가
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `평가결과_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
