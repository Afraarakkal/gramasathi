// -------------------------
// GramaSathi Backend Server (FINAL FIXED)
// -------------------------
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { db } = require("./firebaseAdmin");
const { Timestamp } = require("firebase-admin/firestore");

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const intentMappings = require("./intentMappings");
const formMappings = require("./formMappings");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/forms", express.static(path.join(__dirname, "forms")));



app.get("/", (_req, res) => {
  res.send("GramaSathi Backend API is running");
});

// =======================================================
// 🔥 CORE AUTOMATION FUNCTION
// =======================================================

async function runTask(userId, title, formLink) {

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) throw new Error("User not found");

  const user = userSnap.data();

  const taskRef = await db.collection("tasks").add({
    userId,
    title,
    formLink,
    status: "processing",
    createdAt: Timestamp.now(),
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto(formLink, { waitUntil: "networkidle2" });
  console.log("Page loaded:", formLink);

  const sel = formMappings[formLink] || {};
  if (!sel || Object.keys(sel).length === 0) {
    throw new Error("No form mapping found for this URL");
  }

  // =============================
  // 🔥 FILL ONLY MAPPED FIELDS
  // =============================

  for (const field of Object.keys(sel)) {

    if (field === "submit") continue;

    const selector = sel[field];
    const value = user[field];

    if (!value) continue;

    try {
      console.log("Filling:", field, "→", value);

      await page.waitForSelector(selector, { timeout: 3000 });

      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.value = "";
      }, selector);

      await page.type(selector, String(value), { delay: 50 });

    } catch (err) {
      console.warn("Failed filling:", field, err.message);
    }
  }

  // 🔎 DEBUG CHECK
  const debugValues = await page.evaluate(() => ({
    name: document.querySelector("#name")?.value,
    aadhaar: document.querySelector("#aadhaar_number")?.value,
    phone: document.querySelector("#phone")?.value,
  }));

  console.log("Filled values on page:", debugValues);

  // Wait before PDF
  await new Promise(r => setTimeout(r, 1500));

 
  // =============================
  // 🚀 SUBMIT
  // =============================

  if (sel.submit) {
    try {
      console.log("Submitting form...");

      await page.click(sel.submit);

      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.warn("Submit failed:", err.message);
    }
  }


  await browser.close();

  await taskRef.update({
    status: "completed",
    completedAt: Timestamp.now(),
  });

  console.log("Task completed:", taskRef.id);

  return {
    taskId: taskRef.id,
    
  };
}

// =======================================================
// 🤖 AI ENTRY POINT
// =======================================================

app.post("/ai-response", async (req, res) => {

  try {
    const { intent, user_data, confidence, ticket_id } = req.body;

    if (!intent || !user_data) {
      return res.status(400).json({
        error: "intent and user_data required"
      });
    }

    const formLink = intentMappings[intent];
    if (!formLink) {
      return res.status(400).json({
        error: "Unknown intent",
        available: Object.keys(intentMappings)
      });
    }

    // ======================================
    // 🔥 CLEAN USER DATA (VERY IMPORTANT)
    // ======================================

    const cleanedData = {
      name: user_data.name?.trim() || "",

      aadhaar_number: user_data.aadhaar_number
        ?.replace(/\D/g, "")
        ?.slice(0, 12) || "",

      phone: user_data.phone
        ?.replace(/\D/g, "")
        ?.slice(0, 10) || ""
    };

    console.log("Cleaned Data:", cleanedData);

    const userRef = await db.collection("users").add({
      ...cleanedData,
      createdAt: Timestamp.now(),
    });

    const userId = userRef.id;

    await db.collection("messages").add({
      senderId: "AI",
      receiverId: userId,
      intent,
      confidence: confidence ?? null,
      ticket_id: ticket_id ?? null,
      metadata: req.body,
      timestamp: Timestamp.now(),
      status: "processed",
    });

    const result = await runTask(
      userId,
      `Auto Task for ${intent}`,
      formLink
    );

    res.status(200).json({
      message: "AI workflow completed",
      userId,
      ...result
    });

  } catch (error) {
    console.error("AI RESPONSE ERROR:", error);
    res.status(500).json({ error: error.message });
  }

});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});