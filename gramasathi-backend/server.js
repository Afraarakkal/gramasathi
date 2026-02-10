// -------------------------
// GramaSathi Backend Server
// -------------------------

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { db, storage } = require("./firebaseAdmin");
const { Timestamp } = require("firebase-admin/firestore");

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Load form mappings
const mappings = require("./formMappings");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve PDF files
app.use("/files", express.static(path.join(__dirname)));

// -------------------------
// Health Check
// -------------------------
app.get("/", (_req, res) => {
  res.send("GramaSathi Backend API is running");
});

// -------------------------
// USERS
// -------------------------
// -------------------------
// USERS (dynamic fields)
// -------------------------
app.post("/users", async (req, res) => {
  try {
    const userData = req.body;

    // Optional: add createdAt timestamp
    userData.createdAt = Timestamp.now();

    // Add to Firestore
    const userRef = await db.collection("users").add(userData);

    res.status(200).send({ message: "User added", id: userRef.id });
  } catch (error) {
    console.error("POST /users error:", error);
    res.status(500).send({ error: error.message });
  }
  
});

// -------------------------
// MESSAGES
// -------------------------
app.post("/messages", async (req, res) => {
  try {
    const { senderId, content, type, caseId } = req.body;
    const messageRef = await db.collection("messages").add({
      senderId,
      receiverId: "system",
      content,
      type,
      caseId: caseId || null,
      timestamp: Timestamp.now(),
      status: "new",
    });
    res.status(200).send({ message: "Message stored", id: messageRef.id });
  } catch (error) {
    console.error("POST /messages error:", error);
    res.status(500).send({ error: error.message });
  }
});

app.post("/messages/withMetadata", async (req, res) => {
  try {
    const { senderId, content, intent, language, status } = req.body;
    const docRef = await db.collection("messages").add({
      senderId,
      receiverId: "system",
      content,
      intent,
      language,
      status,
      timestamp: Timestamp.now(),
    });
    res.status(200).send({ message: "Message with metadata stored", id: docRef.id });
  } catch (err) {
    console.error("POST /messages/withMetadata error:", err);
    res.status(500).send({ error: err.message });
  }
});

app.patch("/messages/:id/status", async (req, res) => {
  const messageId = req.params.id;
  const { status } = req.body;

  if (!["new", "pending", "resolved"].includes(status)) {
    return res.status(400).send({ error: "Invalid status" });
  }

  try {
    const messageRef = db.collection("messages").doc(messageId);
    await messageRef.update({
      status,
      lastUpdated: Timestamp.now(),
    });

    await db.collection("status_logs").add({
      messageId,
      newStatus: status,
      changedAt: Timestamp.now(),
    });

    res.status(200).send({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error("PATCH /messages/:id/status error:", err);
    res.status(500).send({ error: err.message });
  }
});

// -------------------------
// TASKS (auto form automation + PDFs + flexible form)
// -------------------------
app.post("/tasks", async (req, res) => {
  try {
    const { userId, title, formLink, selectors } = req.body;
    if (!userId || !title || !formLink)
      return res.status(400).send({ error: "userId, title, formLink required" });

    // Load user
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return res.status(404).send({ error: "User not found" });
    const user = userSnap.data();

    // Create task in Firestore
    const taskRef = await db.collection("tasks").add({
      userId,
      title,
      formLink,
      status: "pending",
      createdAt: Timestamp.now(),
    });

    // Launch Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(formLink, { waitUntil: "networkidle2" });

    // Fallback auto-detection
    async function autoDetectSelectors(page) {
      const guessed = {};
      const inputs = await page.$$eval("input, textarea, select", els =>
        els.map(el => ({
          name: el.getAttribute("name") || "",
          id: el.id || "",
          placeholder: el.getAttribute("placeholder") || "",
        }))
      );
      for (const f of inputs) {
        const str = (f.name + f.id + f.placeholder).toLowerCase();
        if (str.includes("name")) guessed[f.id] = "#" + f.id;
        else if (str.includes("mail")) guessed[f.id] = "#" + f.id;
        else if (str.includes("phone") || str.includes("mobile")) guessed[f.id] = "#" + f.id;
        else if (str.includes("address")) guessed[f.id] = "#" + f.id;
        else if (str.includes("complaint") || str.includes("desc")) guessed[f.id] = "#" + f.id;
      }
      guessed.submit = "button[type='submit'], input[type='submit']";
      return guessed;
    }

    // Merge selectors: mappings > request body > fallback
    let sel = mappings[formLink] || selectors || {};
    if (Object.keys(sel).length === 0) sel = await autoDetectSelectors(page);

    // Safe typing for all fields in user
    for (const [field, value] of Object.entries(user)) {
      const selector = sel[field] || sel[field.toLowerCase()] || sel[field + "Input"];
      if (selector && value) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.focus(selector);
          await page.evaluate((s) => { document.querySelector(s).value = ""; }, selector);
          await page.type(selector, String(value));
        } catch (err) {
          console.warn(`Could not type into field ${field}: ${err.message}`);
        }
      }
    }

    // Before-submit PDF
    const beforePdf = await page.pdf({ format: "A4" });
    const beforePath = path.join(__dirname, "before.pdf");
    fs.writeFileSync(beforePath, beforePdf);

// --- Submit and wait intelligently ---
if (sel.submit) {
  try {
    const navigationPromise = page.waitForNavigation({ waitUntil: "load", timeout: 5000 }).catch(() => null);

    // Click the button and handle alerts automatically
    const dialogPromise = new Promise(resolve => {
      page.once("dialog", async dialog => {
        await dialog.dismiss();
        resolve(true);
      });
    });

    await page.click(sel.submit);

    // Wait for whichever happens first — navigation, alert, or short timeout
    await Promise.race([
      navigationPromise,
      dialogPromise,
      await new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  } catch (err) {
    console.warn("Submit action skipped or failed:", err.message);
  }
}

// --- After-submit PDF ---
await new Promise(resolve => setTimeout(resolve, 2000));
const afterPdf = await page.pdf({ format: "A4" });
const afterPath = path.join(__dirname, "after.pdf");
fs.writeFileSync(afterPath, afterPdf);


    await browser.close();

    // Update task
    await taskRef.update({
      status: "completed",
      completedAt: Timestamp.now(),
    });

    // Return download links
    res.status(200).send({
      message: "Task completed",
      taskId: taskRef.id,
      pdfs: {
        before: `/files/before.pdf`,
        after: `/files/after.pdf`
      }
    });

  } catch (error) {
    console.error("POST /tasks error:", error);
    res.status(500).send({ error: error.message });
  }
});


// -------------------------
// Server start
// -------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
