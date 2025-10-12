const mongoose = require("mongoose");
module.exports = mongoose.model("Question", new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  text: String,
  choices: [String],
  answerIndex: Number
}));
