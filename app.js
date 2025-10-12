// app.js
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const morgan = require("morgan");
const { Parser } = require("json2csv"); // CSV export

require("dotenv").config();

const app = express();

// -------------------- MongoDB Connection --------------------
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mcq_exam";
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// -------------------- Models --------------------
const Exam = require("./models/exam");
const Question = require("./models/question");
const Result = require("./models/result");

// -------------------- Middleware --------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method")); // For DELETE/PUT via POST
app.use(morgan("dev"));
app.use(session({
  secret: process.env.SESSION_SECRET || "keyboard cat",
  resave: false,
  saveUninitialized: false,
}));
app.use(flash());

// -------------------- Globals --------------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.isAdmin = !!req.session.isAdmin;
  next();
});

// -------------------- Admin Authentication --------------------
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  req.flash("error", "Admin login required");
  res.redirect("/admin/login");
}

// -------------------- Routes --------------------

// Home Page - List of exams
app.get("/", async (req, res) => {
  const exams = await Exam.find({});
  res.render("index", { exams });
});

// Admin Login/Logout
app.get("/admin/login", (req, res) => res.render("admin/login"));
app.post("/admin/login", (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.flash("success", "Admin logged in");
    return res.redirect("/admin");
  }
  req.flash("error", "Invalid password");
  res.redirect("/admin/login");
});
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Admin Dashboard
app.get("/admin", requireAdmin, async (req, res) => {
  const exams = await Exam.find({}).sort("-createdAt");
  res.render("admin/dashboard", { exams });
});

// Create Exam
app.get("/admin/exams/new", requireAdmin, (req, res) => res.render("admin/newExam"));
app.post("/admin/exams", requireAdmin, async (req, res) => {
  const exam = new Exam({ title: req.body.title, duration: req.body.duration, isActive: false });
  await exam.save();
  req.flash("success", "Exam created");
  res.redirect("/admin");
});

// Delete Exam
app.delete("/admin/exams/:id", requireAdmin, async (req, res) => {
  await Exam.findByIdAndDelete(req.params.id);
  await Question.deleteMany({ exam: req.params.id });
  req.flash("success", "Exam deleted");
  res.redirect("/admin");
});

// Toggle Exam Active/Inactive
app.post("/admin/exams/:id/toggle", requireAdmin, async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  exam.isActive = !exam.isActive;
  await exam.save();
  res.redirect("/admin");
});

// Manage Questions
app.get("/admin/exams/:id/questions", requireAdmin, async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  const questions = await Question.find({ exam: req.params.id });
  res.render("admin/questions", { exam, questions });
});
app.post("/admin/exams/:id/questions", requireAdmin, async (req, res) => {
  const { text, choice1, choice2, choice3, choice4, answer } = req.body;
  const choices = [choice1, choice2, choice3, choice4];
  const q = new Question({
    exam: req.params.id,
    text,
    choices,
    answerIndex: parseInt(answer) - 1
  });
  await q.save();
  req.flash("success", "Question added successfully");
  res.redirect(`/admin/exams/${req.params.id}/questions`);
});
app.delete("/admin/questions/:qid", requireAdmin, async (req, res) => {
  await Question.findByIdAndDelete(req.params.qid);
  res.redirect("back");
});

// -------------------- Results --------------------

// List Results
app.get("/admin/results", requireAdmin, async (req, res) => {
  const results = await Result.find({}).populate("exam").sort("-submittedAt");
  res.render("admin/results", { results });
});

// Detailed Result View
app.get("/admin/results/:id", requireAdmin, async (req, res) => {
  const result = await Result.findById(req.params.id).populate("exam");
  if (!result) {
    req.flash("error", "Result not found");
    return res.redirect("/admin/results");
  }
  const questions = await Question.find({ exam: result.exam._id });
  res.render("admin/resultDetail", { result, questions });
});

// Delete a specific result
app.delete("/admin/results/:id", requireAdmin, async (req, res) => {
  try {
    await Result.findByIdAndDelete(req.params.id);
    req.flash("success", "Result deleted successfully");
    res.redirect("/admin/results");
  } catch (err) {
    console.error("Error deleting result:", err);
    req.flash("error", "Failed to delete result");
    res.redirect("/admin/results");
  }
});

// Export Results to CSV
app.get("/admin/results/export", requireAdmin, async (req, res) => {
  try {
    const results = await Result.find({}).sort("-submittedAt");
    const data = results.map(r => ({
      Name: r.name,
      "Roll No": r.roll,
      Score: r.score,
      Time: r.submittedAt.toLocaleString()
    }));
    const json2csvParser = new Parser({ fields: ["Name", "Roll No", "Score", "Time"] });
    const csv = json2csvParser.parse(data);
    res.header("Content-Type", "text/csv");
    res.attachment("exam_results.csv");
    return res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).send("Server error while exporting CSV.");
  }
});

// -------------------- User Exam --------------------

// Start Exam
app.get("/exams/:id", async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam || !exam.isActive) return res.redirect("/");
  const questions = await Question.find({ exam: req.params.id });
  res.render("exam/start", { exam, questions });
});

// Submit Exam
app.post("/exams/:id/submit", async (req, res) => {
  const questions = await Question.find({ exam: req.params.id });
  const answers = JSON.parse(req.body.answersJson || "[]");
  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] == q.answerIndex) score++;
  });
  const result = new Result({
    exam: req.params.id,
    name: req.body.name,
    roll: req.body.roll,
    answers,
    score,
    total: questions.length,
    submittedAt: new Date()
  });
  await result.save();

  if (req.headers["x-requested-with"] === "XMLHttpRequest") {
    return res.json({ ok: true, redirect: `/exams/${req.params.id}/thankyou` });
  }

  res.redirect(`/exams/${req.params.id}/thankyou`);
});

// Thank You Page
app.get("/exams/:id/thankyou", (req, res) => {
  res.render("exam/thankyou");
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
