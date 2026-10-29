const mongoose = require("mongoose");

const roomRevisionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    revisionId: {
      type: String,
      required: true,
    },
    parentRevisionId: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      trim: true,
    },
    changeDescription: {
      type: String,
      required: true,
      maxlength: 120,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { versionKey: false }
);

roomRevisionSchema.index({ roomId: 1, revisionId: 1 }, { unique: true });

module.exports = mongoose.model("RoomRevision", roomRevisionSchema);
