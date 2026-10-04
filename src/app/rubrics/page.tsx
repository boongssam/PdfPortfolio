"use client";

import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/AuthProvider";
import { createRubric, deleteRubric, listRubrics, updateRubric } from "@/lib/db";
import type { Criterion, Rubric, RubricInput } from "@/lib/types";

const newCriterion = (): Criterion => ({
  id: crypto.randomUUID().slice(0, 8),
  name: "",
  maxScore: 10,
  description: "",
});

const emptyRubric = (): RubricInput => ({ title: "", taskDescription: "", criteria: [newCriterion()] });

const exampleRubric = (): RubricInput => ({
  title: "예시) 과학 3단원 생태계 탐구 활동지",
  taskDescription: "생태계 구성 요소와 먹이 사슬을 조사하고, 생태계 평형이 깨지는 사례를 설명하는 활동",
  criteria: [
    {
      id: crypto.randomUUID().slice(0, 8),
      name: "개념 이해",
      maxScore: 10,
      description:
        "상(10점): 생물·비생물 요소를 정확히 구분하고 예시를 2개 이상 제시\n중(7점): 구분은 정확하나 예시가 1개\n하(4점): 구분에 오류가 있음",
    },
    {
      id: crypto.randomUUID().slice(0, 8),
      name: "먹이 사슬 표현",
      maxScore: 10,
      description:
        "상(10점): 생산자-1차-2차 소비자 관계를 화살표 방향까지 바르게 표현\n중(7점): 관계는 맞으나 일부 오류\n하(4점): 관계 표현이 부정확",
    },
    {
      id: crypto.randomUUID().slice(0, 8),
      name: "사례 설명 및 근거",
      maxScore: 10,
      description:
        "상(10점): 실제 사례를 들어 원인과 결과를 논리적으로 설명\n중(7점): 사례는 있으나 인과 설명이 부족\n하(4점): 사례나 설명이 없음",
    },
  ],
});

export default function RubricsPage() {
  return <RequireAuth>{(user) => <RubricsEditor user={user} />}</RequireAuth>;
}

function RubricsEditor({ user }: { user: User }) {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // null = 새 기준
  const [form, setForm] = useState<RubricInput>(emptyRubric);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => setRubrics(await listRubrics(user.uid)), [user.uid]);

  useEffect(() => {
    listRubrics(user.uid)
      .then(setRubrics)
      .catch((e: Error) => setMessage(e.message));
  }, [user.uid]);

  const select = (r: Rubric | null) => {
    setEditingId(r?.id ?? null);
    setForm(r ? { title: r.title, taskDescription: r.taskDescription, criteria: r.criteria } : emptyRubric());
    setMessage("");
  };

  const setCriterion = (i: number, patch: Partial<Criterion>) =>
    setForm((f) => ({ ...f, criteria: f.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const save = async () => {
    if (!form.title.trim()) return setMessage("평가 기준 이름을 입력해 주세요.");
    if (form.criteria.some((c) => !c.name.trim())) return setMessage("모든 평가 항목의 이름을 입력해 주세요.");
    setBusy(true);
    try {
      if (editingId) {
        await updateRubric(user.uid, editingId, form);
      } else {
        setEditingId(await createRubric(user.uid, form));
      }
      await reload();
      setMessage("저장했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editingId || !confirm("이 평가 기준을 삭제할까요? (기존 평가 결과는 남습니다)")) return;
    setBusy(true);
    try {
      await deleteRubric(user.uid, editingId);
      await reload();
      select(null);
    } finally {
      setBusy(false);
    }
  };

  const total = form.criteria.reduce((s, c) => s + (Number(c.maxScore) || 0), 0);

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="space-y-2">
        <button className="btn-primary w-full" onClick={() => select(null)}>
          + 새 평가 기준
        </button>
        {rubrics.map((r) => (
          <button
            key={r.id}
            onClick={() => select(r)}
            className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
              editingId === r.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-slate-500">{r.criteria.length}개 항목</div>
          </button>
        ))}
        {rubrics.length === 0 && <p className="px-1 text-sm text-slate-500">저장된 평가 기준이 없습니다.</p>}
      </aside>

      <section className="card space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{editingId ? "평가 기준 수정" : "새 평가 기준"}</h1>
          {!editingId && (
            <button className="text-sm text-indigo-600 hover:underline" onClick={() => setForm(exampleRubric())}>
              예시 불러오기
            </button>
          )}
        </div>

        <div>
          <label className="label">평가 기준 이름</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="예: 2학기 국어 논설문 쓰기 활동지"
          />
        </div>
        <div>
          <label className="label">과제 설명 (AI가 활동 맥락을 이해하는 데 사용)</label>
          <textarea
            className="input min-h-20"
            value={form.taskDescription}
            onChange={(e) => setForm({ ...form, taskDescription: e.target.value })}
            placeholder="활동 목표, 문항 구성, 학생에게 요구한 내용 등"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">평가 항목</h2>
            <span className="text-sm text-slate-500">총 {total}점</span>
          </div>
          {form.criteria.map((c, i) => (
            <div key={c.id} className="space-y-2 rounded-xl border border-slate-200 p-4">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={c.name}
                  onChange={(e) => setCriterion(i, { name: e.target.value })}
                  placeholder={`항목 ${i + 1} 이름 (예: 내용 이해)`}
                />
                <input
                  type="number"
                  min={0}
                  className="input w-24"
                  value={c.maxScore}
                  onChange={(e) => setCriterion(i, { maxScore: Number(e.target.value) })}
                  aria-label="배점"
                />
                <span className="self-center text-sm text-slate-500">점</span>
              </div>
              <textarea
                className="input min-h-24"
                value={c.description}
                onChange={(e) => setCriterion(i, { description: e.target.value })}
                placeholder={"성취 수준별 채점 기준\n상(10점): ...\n중(7점): ...\n하(4점): ..."}
              />
              {form.criteria.length > 1 && (
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setForm({ ...form, criteria: form.criteria.filter((_, j) => j !== i) })}
                >
                  항목 삭제
                </button>
              )}
            </div>
          ))}
          <button
            className="btn-secondary w-full"
            onClick={() => setForm({ ...form, criteria: [...form.criteria, newCriterion()] })}
          >
            + 평가 항목 추가
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <button className="btn-primary" onClick={save} disabled={busy}>
            저장
          </button>
          {editingId && (
            <button className="btn-danger" onClick={remove} disabled={busy}>
              삭제
            </button>
          )}
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
      </section>
    </div>
  );
}
