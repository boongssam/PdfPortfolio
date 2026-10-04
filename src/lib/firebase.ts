// 브라우저용 Firebase 초기화 (빌드 시 서버 렌더링에서 실행되지 않도록 지연 초기화)
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

function firebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length) {
      app = getApp();
    } else {
      app = initializeApp(firebaseConfig);
      initializeFirestore(app, { ignoreUndefinedProperties: true });
    }
  }
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firestore(): Firestore {
  db ??= getFirestore(firebaseApp());
  return db;
}
