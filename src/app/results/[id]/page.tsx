"use client";

import type { User } from "firebase/auth";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/AuthProvider";
import { gradeText } from "@/lib/api";
import { deleteSubmission, getRubric, getSubmission, updateSubmission } from "@/lib/db";
import type { Evaluation, Submission } from "@/lib/types";

export default function ResultDetailPage() {
  return <RequireAuth>{(user) => <ResultDetail user={user} />}</RequireAuth>;
}

function ResultDetail({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sub, setSub] = useState<Submission | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSubmission(user.uid, id)
      .then(setSub)
      .catch((e: Error) => setMessage(e.message));
  }, [user.uid, id]);

  if (sub === undefined) return <p className="text-slate-500">{message || "불러오는 중…"}</p>;
  if (sub === null) return <p className="text-slate-500">평가 결과를 찾을 수 없습니다.</p>;

  const ev = sub.evaluation;

  const setEval = (patch: Partial<Evaluation>) => {
    if (!ev) return;
    const next = { ...ev, ...patch };
    next.totalScore = next.criteria.reduce((s, c) => s + c.score, 0);
    setSub({ ...sub, evaluation: next });
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateSubmission(user.uid, sub.id, {
        studentName: sub.studentName,
        studentId: sub.studentId,
        extractedText: sub.extractedText,
        evaluation: ev ? { ...ev, editedByTeacher: true } : null,
      });
      setSub({ ...sub, evaluation: ev ? { ...ev, editedByTeacher: true } : null });
      setMessage("저장했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const regrade = async () => {
    if (!confirm("현재 텍스트와 평가 기준으로 다시 채점할까요? 수정한 점수는 덮어써집니다.")) return;
    setBusy(true);
    setMessage("다시 평가하는 중…");
    try {
      const rubric = await getRubric(user.uid, sub.rubricId);
      if (!rubric) throw new Error("원래 평가 기준이 삭제되어 다시 평가할 수 없습니다.");
      const evaluation = await gradeText(sub.extractedText, rubric);
      await updateSubmission(user.uid, sub.id, {
        extractedText: sub.extractedText,
        rubricTitle: rubric.title,
        evaluation,
      });
      setSub({ ...sub, rubricTitle: rubric.title, evaluation });
      setMessage("다시 평가했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("이 평가 결과를 삭제할까요?")) return;
    await deleteSubmission(user.uid, sub.id);
    router.push("/results");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/results" className="text-sm text-slate-500 hover:underline">
          ← 평가 결과 목록
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {message && <span className="text-sm text-slate-600">{message}</span>}
          <button className="btn-primary" onClick={save} disabled={busy}>
            수정 내용 저장
          </button>
          <button className="btn-secondary" onClick={regrade} disabled={busy}>
            AI로 다시 평가
          </button>
          <button className="btn-danger" onClick={remove} disabled={busy}>
            삭제
          </button>
        </div>
      </div>

      <div className="card grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label">이름</label>
          <input className="input" value={sub.studentName} onChange={(e) => setSub({ ...sub, studentName: e.target.value })} />
        </div>
        <div>
          <label className="label">학번</label>
          <input className="input" value={sub.studentId} onChange={(e) => setSub({ ...sub, studentId: e.target.value })} />
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">{sub.rubricTitle}</div>
          <div className="text-3xl font-bold text-indigo-700">
            {ev ? ev.totalScore : "-"}
            <span className="text-lg text-slate-400"> / {ev?.maxTotal ?? "-"}</span>
          </div>
          {ev?.editedByTeacher && <div className="text-xs text-slate-500">교사 수정됨</div>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">항목별 평가</h2>
          {!ev && <p className="text-slate-500">평가 결과가 없습니다. &quot;AI로 다시 평가&quot;를 눌러 주세요.</p>}
          {ev?.criteria.map((c, i) => (
            <div key={c.criterionId} className="card space-y-3 p-5">
              <div className="flex items-center gap-2">
                <h3 className="mr-auto font-semibold">{c.name}</h3>
                {c.level && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">{c.level}</span>}
                <input
                  type="number"
                  min={0}
                  max={c.maxScore}
                  className="input w-20 text-right"
                  value={c.score}
                  onChange={(e) =>
                    setEval({
                      criteria: ev.criteria.map((x, j) =>
                        j === i ? { ...x, score: Math.min(x.maxScore, Math.max(0, Number(e.target.value))) } : x,
                      ),
                    })
                  }
                  aria-label={`${c.name} 점수`}
                />
                <span className="text-sm text-slate-500">/ {c.maxScore}</span>
              </div>
              <textarea
                className="input min-h-20"
                value={c.rationale}
                onChange={(e) =>
                  setEval({ criteria: ev.criteria.map((x, j) => (j === i ? { ...x, rationale: e.target.value } : x)) })
                }
              />
              {c.evidence && (
                <blockquote className="border-l-4 border-slate-200 pl-3 text-sm text-slate-600">{c.evidence}</blockquote>
              )}
            </div>
          ))}
          {ev && (
            <div className="card space-y-2 p-5">
              <h3 className="font-semibold">종합 피드백</h3>
              <textarea
                className="input min-h-28"
                value={ev.overallFeedback}
                onChange={(e) => setEval({ overallFeedback: e.target.value })}
              />
              <p className="text-xs text-slate-400">
                {ev.model} · {new Date(ev.gradedAt).toLocaleString("ko-KR")}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">변환된 텍스트</h2>
          <p className="text-xs text-slate-500">
            {sub.fileName} · OCR 오류가 있으면 고친 뒤 &quot;AI로 다시 평가&quot;를 누르세요. (▶ = 학생 작성 답변)
          </p>
          <textarea
            className="input min-h-[600px] font-mono text-xs leading-relaxed"
            value={sub.extractedText}
            onChange={(e) => setSub({ ...sub, extractedText: e.target.value })}
          />
        </section>
      </div>
    </div>
  );
}
