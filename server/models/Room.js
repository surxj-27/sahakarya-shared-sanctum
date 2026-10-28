const mongoose = require("mongoose");

const boardStateSchema = new mongoose.Schema(
  {
    notes: { type: [mongoose.Schema.Types.Mixed], default: () => [] },
    strokes: { type: [mongoose.Schema.Types.Mixed], default: () => [] },
    shapes: { type: [mongoose.Schema.Types.Mixed], default: () => [] },
    textItems: { type: [mongoose.Schema.Types.Mixed], default: () => [] },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    inviteCode: {
      type: String,
      required: true,
      unique: true,
    },

    boardState: {
      type: boardStateSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);