const { db } = require('./firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

async function setupData() {
  const userRef = await db.collection('users').add({
    name: "Fazal Rahman",
    email: "fazal@example.com",
    role: "user",
    createdAt: Timestamp.now()
  });

  await db.collection('tasks').add({
    userId: userRef.id,
    title: "Drainage issue complaint",
    status: "pending",
    createdAt: Timestamp.now(),
    caseId: "CASE001"
  });

  await db.collection('messages').add({
    senderId: userRef.id,
    receiverId: "system",
    content: "I want to apply for old-age pension",
    type: "text",
    timestamp: Timestamp.now(),
    status: "new"
  });

  console.log("Sample data added.");
}

setupData();
