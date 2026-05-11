const admin = require("firebase-admin");

if (!process.env.FIREBASE_CONFIG) {
  throw new Error("FIREBASE_CONFIG not set");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});

const db = admin.firestore();
const storage = admin.storage();

module.exports = { db, storage };