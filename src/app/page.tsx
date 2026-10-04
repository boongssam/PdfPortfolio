import Link from "next/link";

const STEPS = [
  {
    href: "/rubrics",
    step: "1",
    title: "평가 기준 만들기",
    body: "과제 설명과 평가 항목, 배점, 성취 수준별 채점 기준을 미리 입력합니다.",
  },
  {
    href: "/evaluate",
    step: "2",
    title: "활동지 PDF 업로드",
    body: "학생 활동지 PDF를 올리면 Gemini가 손글씨까지 텍스트로 변환하고 기준에 따라 채점합니다.",
  },
  {
    href: "/results",
    step: "3",
    title: "결과 확인·수정",
    body: "Firestore에 저장된 평가 결과를 확인하고, 점수를 고치거나 CSV로 내려받습니다.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">학생 활동지 AI 수행평가</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          PDF 활동지를 텍스트 데이터로 바꾸고, 선생님이 정한 평가 기준에 따라 채점한 결과를 저장합니다.
          AI 채점은 참고용 초안이므로 최종 점수는 꼭 확인해 주세요.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <Link key={s.href} href={s.href} className="card block transition hover:border-indigo-300 hover:shadow">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {s.step}
            </span>
            <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
