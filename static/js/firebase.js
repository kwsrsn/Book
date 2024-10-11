import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.1.2/firebase-auth.js";
import { getFirestore, doc, addDoc, getDoc, collection, setDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.1.2/firebase-firestore.js"; // Import doc and setDoc
import { getStorage, ref, listAll, getDownloadURL, uploadBytes } from "https://www.gstatic.com/firebasejs/9.1.2/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD8HJNlQKPdR-EDzEECLK0l6nLnzvPO-cA",
    authDomain: "bookai-7cf88.firebaseapp.com",
    projectId: "bookai-7cf88",
    storageBucket: "bookai-7cf88.appspot.com",
    messagingSenderId: "66262934709",
    appId: "1:66262934709:web:8c5f3e24ff9d3655c14afc",
    measurementId: "G-8TNQKF4FNG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, signInWithEmailAndPassword, createUserWithEmailAndPassword, addDoc, doc, setDoc, getDoc, ref, getDownloadURL, uploadBytes, collection, query, where, getDocs }; // Export necessary functions
