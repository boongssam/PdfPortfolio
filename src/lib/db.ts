// Firestore 데이터 접근: 모든 데이터는 users/{uid} 아래에 교사별로 저장됩니다.
//   users/{uid}/rubrics/{rubricId}
//   users/{uid}/submissions/{submissionId}
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { firestore } from "./firebase";
import type { Rubric, RubricInput, Submission, SubmissionInput } from "./types";

const rubricsCol = (uid: string) => collection(firestore(), "users", uid, "rubrics");
const submissionsCol = (uid: string) => collection(firestore(), "users", uid, "submissions");

function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

// ---------- 평가 기준 ----------

export async function listRubrics(uid: string): Promise<Rubric[]> {
  const snap = await getDocs(query(rubricsCol(uid), orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => withId<Rubric>(d.id, d.data()));
}

export async function getRubric(uid: string, id: string): Promise<Rubric | null> {
  const snap = await getDoc(doc(rubricsCol(uid), id));
  return snap.exists() ? withId<Rubric>(snap.id, snap.data()) : null;
}

export async function createRubric(uid: string, data: RubricInput): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(rubricsCol(uid), { ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateRubric(uid: string, id: string, data: RubricInput): Promise<void> {
  await updateDoc(doc(rubricsCol(uid), id), { ...data, updatedAt: Date.now() });
}

export async function deleteRubric(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(rubricsCol(uid), id));
}

// ---------- 학생 제출물 / 평가 결과 ----------

export async function listSubmissions(uid: string): Promise<Submission[]> {
  const snap = await getDocs(query(submissionsCol(uid), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => withId<Submission>(d.id, d.data()));
}

export async function getSubmission(uid: string, id: string): Promise<Submission | null> {
  const snap = await getDoc(doc(submissionsCol(uid), id));
  return snap.exists() ? withId<Submission>(snap.id, snap.data()) : null;
}

export async function createSubmission(uid: string, data: SubmissionInput): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(submissionsCol(uid), { ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateSubmission(
  uid: string,
  id: string,
  data: Partial<SubmissionInput>,
): Promise<void> {
  await updateDoc(doc(submissionsCol(uid), id), { ...data, updatedAt: Date.now() });
}

export async function deleteSubmission(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(submissionsCol(uid), id));
}
