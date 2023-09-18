const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  videoPath: String,
});

const Video = mongoose.model("Video", videoSchema);

module.exports = Video;
