const mongoose = require("mongoose");
module.exports = mongoose.model("Result", new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  name: String,
  roll: String,
  answers: [Number],
  score: Number,
  total: Number,
  submittedAt: Date
}));
