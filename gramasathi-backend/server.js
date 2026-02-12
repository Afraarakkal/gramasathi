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

app.post("/tasks", async (req, res) => {
  try {
    const { userId, title, formLink, selectors } = req.body;
    if (!userId || !title || !formLink)
      return res.status(400).send({ error: "userId, title, formLink required" });

    // Load user data
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
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();

    // Support file:// or http:// URLs
    let url = formLink;
    if (!/^https?:\/\//.test(formLink)) {
      url = `file://${path.isAbsolute(formLink) ? formLink : path.join(__dirname, formLink)}`;
    }
    await page.goto(url, { waitUntil: "networkidle2" });

    // Fallback auto-detection of selectors
    let sel = mappings[formLink] || selectors || {};
    if (Object.keys(sel).length === 0) {
      sel = await page.$$eval("input, textarea, select", els => {
        const guessed = {};
        els.forEach(el => {
          const id = el.id || "";
          guessed[id] = id ? "#" + id : null;
          if (el.type === "submit") guessed.submit = "#" + id;
        });
        guessed.submit ||= "button[type='submit'], input[type='submit']";
        return guessed;
      });
    }

    // Fill all user fields
    for (const [field, value] of Object.entries(user)) {
      const selector = sel[field] || sel[field.toLowerCase()] || sel[field + "Input"];
      if (!selector || value === undefined || value === null) continue;

      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        const tagName = await page.$eval(selector, el => el.tagName.toLowerCase());
        const type = await page.$eval(selector, el => el.type?.toLowerCase() || "");

        // Text / email / tel inputs
        if (tagName === "input" && ["text", "email", "tel"].includes(type)) {
          await page.focus(selector);
          await page.evaluate(s => document.querySelector(s).value = "", selector);
          await page.type(selector, String(value), { delay: 50 });
        }
        // Textarea
        else if (tagName === "textarea") {
          await page.focus(selector);
          await page.evaluate(s => document.querySelector(s).value = "", selector);
          await page.type(selector, String(value), { delay: 50 });
        }
        // Single dropdown
        else if (tagName === "select") {
          await page.select(selector, String(value));
        }
        // Checkbox group (array)
        else if (type === "checkbox" && Array.isArray(value)) {
          for (const v of value) {
            const box = await page.$(`input[name='${field}'][value='${v}']`);
            if (box) await box.click();
          }
        }
        // Single checkbox (boolean)
        else if (type === "checkbox") {
          const isChecked = await page.$eval(selector, el => el.checked);
          if (Boolean(value) !== isChecked) await page.click(selector);
        }
        // Radio buttons
        else if (type === "radio") {
          const option = await page.$(`input[name='${field}'][value='${value}']`);
          if (option) await option.click();
        } 
        else {
          console.warn(`Skipping unknown field type for ${field}: ${tagName}/${type}`);
        }
      } catch (err) {
        console.warn(`Could not fill field ${field}: ${err.message}`);
      }
    }

    // Before-submit PDF
    const beforePdfPath = path.join(__dirname, `${taskRef.id}_before.pdf`);
    const beforePdf = await page.pdf({ format: "A4" });
    fs.writeFileSync(beforePdfPath, beforePdf);

    // Submit safely
    if (sel.submit) {
      try {
        const navPromise = page.waitForNavigation({ waitUntil: "load", timeout: 5000 }).catch(() => null);
        const dialogPromise = new Promise(resolve => {
          page.once("dialog", async d => { await d.dismiss(); resolve(true); });
        });
        await page.click(sel.submit);
        await Promise.race([navPromise, dialogPromise, new Promise(r => setTimeout(r, 2000))]);
      } catch (err) {
        console.warn("Submit skipped or failed:", err.message);
      }
    }

    // After-submit PDF
    await new Promise(resolve => setTimeout(resolve, 2000));
    const afterPdfPath = path.join(__dirname, `${taskRef.id}_after.pdf`);
    const afterPdf = await page.pdf({ format: "A4" });
    fs.writeFileSync(afterPdfPath, afterPdf);

    await browser.close();

    // Update task status
    await taskRef.update({
      status: "completed",
      completedAt: Timestamp.now(),
    });

    // Return task info
    res.status(200).send({
      message: "Task completed",
      taskId: taskRef.id,
      pdfs: {
        before: `/files/${taskRef.id}_before.pdf`,
        after: `/files/${taskRef.id}_after.pdf`
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
