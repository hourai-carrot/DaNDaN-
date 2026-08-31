// Firebase SDK(モジュール版)をCDNから読み込み、
// 認証(Google ログイン)とFirestoreへのデータ保存をまとめたモジュール。
// アプリ本体(script.js)はこのファイルの関数だけを使い、
// Firebase固有のAPIを直接扱わないようにしている。

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/** Googleアカウントでログインする */
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/** ログアウトする */
export function signOutUser() {
  return firebaseSignOut(auth);
}

/** ログイン状態の変化を監視する(ログイン/ログアウト/初回読み込み時に呼ばれる) */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * ユーザーのフォルダ・問題データを1つのドキュメントとして読み込む。
 * データが存在しない場合(初回ログイン時)は空の状態を返す。
 */
export async function loadUserData(uid) {
  const ref = doc(db, "users", uid, "appData", "main");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      folders: Array.isArray(data.folders) ? data.folders : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
    };
  }
  return { folders: [], cards: [] };
}

/**
 * ユーザーのフォルダ・問題データをまとめて保存する。
 * MVPでは単純化のため、変更のたびにフォルダ・問題データ全体を書き込む。
 */
export async function saveUserData(uid, { folders, cards }) {
  const ref = doc(db, "users", uid, "appData", "main");
  await setDoc(ref, { folders, cards, updatedAt: new Date().toISOString() });
}