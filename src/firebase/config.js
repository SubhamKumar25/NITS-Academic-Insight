/**
 * NITS Academic Insight - Firebase Configuration Module
 * Uses Firebase Web SDK v10 modular imports via official CDN.
 * This file is loaded as an ES module.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    signInWithPopup,
    GoogleAuthProvider,
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Internal instances (set after initializeFirebase is called)
let _app = null;
let _auth = null;
let _db = null;

/**
 * Initialize Firebase App, Auth, and Firestore with the given config.
 * @param {Object} config - Firebase web app config object
 * @returns {{ app, auth, db }} Initialized Firebase service instances
 */
export function initializeFirebase(config) {
    _app = initializeApp(config);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    return { app: _app, auth: _auth, db: _db };
}

// Getters for initialized instances
export const getFirebaseAuth = () => _auth;
export const getFirebaseDb = () => _db;
export const getFirebaseApp = () => _app;

// Re-export modular auth functions for use in script.js
export {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    signInWithPopup,
    GoogleAuthProvider,
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence,
    onAuthStateChanged,
    updateProfile,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot
};

