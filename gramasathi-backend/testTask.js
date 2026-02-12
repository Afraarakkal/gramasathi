// testTask.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "testtask.log");

// Simple logger
function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  console.log(message);
}

async function runTask() {
  try {
    log("Starting test task...");

    // Use absolute path to your local HTML file
    const formPath = `file://${path.resolve(__dirname, "form.html")}`;
    log(`Using local form: ${formPath}`);

    const res = await axios.post("http://localhost:3000/tasks", {
      userId: "yoLHu4Tfhv7sV21JGf4b",
      title: "Test Form Automation",
      formLink: formPath, // local form
      selectors: {
        name: "#fullName",
        email: "#emailInput",
        phone: "#phoneInput",
        address: "#addressInput",
        complaint: "#complaintField",
        submit: "#submitBtn"
      }
    });

    const { before, after } = res.data.pdfs;

    fs.writeFileSync("before.pdf", Buffer.from(before, "base64"));
    fs.writeFileSync("after.pdf", Buffer.from(after, "base64"));
    log("✅ PDFs saved: before.pdf & after.pdf");

  } catch (error) {
    const errMsg = error.response?.data || error.message;
    log(`❌ Error: ${errMsg}`);
  }
}

runTask();
