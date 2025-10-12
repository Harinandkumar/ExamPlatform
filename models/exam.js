const mongoose = require("mongoose");
module.exports = mongoose.model("Exam", new mongoose.Schema({
  title: String,
  duration: Number,
  isActive: Boolean
}, { timestamps: true }));
