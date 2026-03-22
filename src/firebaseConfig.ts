import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAh4hmfNHjGXDTYNVTVlcPWndUwCq8EXqI",
  authDomain: "tl-edwin.firebaseapp.com",
  projectId: "tl-edwin",
  storageBucket: "tl-edwin.firebasestorage.app",
  messagingSenderId: "1080246135504",
  appId: "1:1080246135504:web:f970787643977e469eccd5",
  measurementId: "G-Y8NBR6R0HH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// @ts-ignore
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
