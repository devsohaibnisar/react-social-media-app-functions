const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyBneXJOIy9Dg0IOLvO6ana2mdQjQQcSw9I",
  authDomain: "socialmediaapp-53549.firebaseapp.com",
  projectId: "socialmediaapp-53549",
  databaseURL: "https://socialmediaapp-53549.firebaseio.com",
  storageBucket: "socialmediaapp-53549.appspot.com",
  messagingSenderId: "24488652024",
  appId: "1:24488652024:web:b501e967edf4d8a8cedf0d",
  measurementId: "G-HFJ4C0KY3C",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

module.exports = { auth };
