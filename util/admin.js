const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp, cert } = require("firebase-admin/app");

const serviceAccount = require("./socialmediaapp-53549-firebase-adminsdk-fnhua-ade898084d.json");

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://socialmediaapp-53549.firebaseio.com",
  storageBucket: "socialmediaapp-53549.appspot.com",
});

const db = getFirestore();

module.exports = { admin, db };
