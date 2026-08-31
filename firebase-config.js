// ここにFirebaseコンソールで取得した設定値を入力してください。
//
// 取得方法:
// 1. https://console.firebase.google.com/ で新規プロジェクトを作成
// 2. 左メニュー「構築」→「Authentication」→「始める」→「Google」を有効化
// 3. 左メニュー「構築」→「Firestore Database」→「データベースの作成」
//    (本番環境モードで作成し、後述のセキュリティルールを設定してください)
// 4. プロジェクトの概要(左上の歯車アイコン)→「プロジェクトの設定」→
//    「マイアプリ」→ウェブアプリを追加 → 表示される firebaseConfig をそのまま貼り付け
//
// このファイルにはAPIキー等が含まれますが、Firebaseの仕組み上これはクライアント側に
// 公開される前提の設定値です(秘密鍵ではありません)。実際のアクセス制御は
// Firestoreセキュリティルール側で行います(firestore.rules 参照)。

export const firebaseConfig = {
  apiKey: "AIzaSyBSruZZ_yr-bsK9hWtMrcArAkwq_LSM6bw",
  authDomain: "dandananki.firebaseapp.com",
  projectId: "dandananki",
  storageBucket: "dandananki.firebasestorage.app",
  messagingSenderId: "415857935080",
  appId: "1:415857935080:web:297bf595926e5679267f5d",
  measurementId: "G-N3GQKE9JE2"
};