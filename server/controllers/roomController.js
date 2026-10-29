
const Room = require("../models/Room");
const RoomRevision = require("../models/RoomRevision");
const User = require("../models/User");
const crypto = require("crypto");
const mongoose = require("mongoose");
const REVISION_HISTORY_VERSION = 1;
const REVISION_COLLECTIONS = ["notes", "textItems", "strokes", "shapes"];

async function findAccessibleRoom(roomId, userId) {
  return Room.findOne({
    _id: roomId,
    $or: [{ owner: userId }, { members: userId }],
  }).select("_id");
}

const createRoom = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Room name is required",
      });
    }

    const inviteCode = crypto.randomBytes(6).toString("hex");
    const room = await Room.create({
      name: name.trim(),
     owner: req.user.userId,
members: [req.user.userId],
      inviteCode,
    });

    res.status(201).json({
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    console.error("Create room error:", error);

    res.status(500).json({
      message: "Failed to create room",
    });
  }
};
const getMyRooms = async (req, res) => {
  try {
    const userId = req.user.userId;

    const rooms = await Room.find({
      $or: [{ owner: userId }, { members: userId }],
    }).sort({ updatedAt: -1 });

    const visibleRooms = rooms.map((room) => {
      const result = room.toObject();
      if (String(room.owner) !== String(userId)) {
        delete result.inviteCode;
      }
      return result;
    });

    res.status(200).json({
      message: "Rooms fetched successfully",
      rooms: visibleRooms,
    });
  } catch (error) {
    console.error("Get my rooms error:", error);

    res.status(500).json({
      message: "Failed to fetch rooms",
    });
  }
};

const joinRoom = async (req, res) => {
  try {
    const inviteCode = req.body?.inviteCode;
    if (typeof inviteCode !== "string" || !inviteCode.trim()) {
      return res.status(400).json({
        message: "A room invitation code is required.",
      });
    }

    const room = await Room.findOneAndUpdate(
      { inviteCode: inviteCode.trim() },
      { $addToSet: { members: req.user.userId } },
      { new: true }
    ).select("_id name owner members");

    if (!room) {
      return res.status(404).json({
        message: "The invitation is invalid or the room no longer exists.",
      });
    }

    return res.status(200).json({
      message: "Room joined successfully",
      room,
    });
  } catch (error) {
    console.error("Join room error:", error);
    return res.status(500).json({
      message: "Failed to join room",
    });
  }
};

const getRoomRevisions = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.roomId)) {
      return res.status(400).json({ message: "Invalid room ID." });
    }
    const room = await findAccessibleRoom(req.params.roomId, req.user.userId);
    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied." });
    }

    const revisions = await RoomRevision.find({ roomId: room._id })
      .populate("authorId", "name")
      .sort({ timestamp: 1, _id: 1 })
      .lean();
    const records = revisions.map((revision) => ({
      revisionId: revision.revisionId,
      parentRevisionId: revision.parentRevisionId ?? null,
      timestamp: revision.timestamp.toISOString(),
      authorId: revision.authorId
        ? String(revision.authorId._id ?? revision.authorId)
        : null,
      authorName: revision.authorName || revision.authorId?.name || null,
      changeDescription: revision.changeDescription,
      snapshot: revision.snapshot,
    }));

    const parentIds = new Set(
      records.map((revision) => revision.parentRevisionId).filter(Boolean)
    );
    const leaves = records.filter((revision) => !parentIds.has(revision.revisionId));
    const headRevision = leaves.reduce((latest, revision) =>
      !latest || Date.parse(revision.timestamp) > Date.parse(latest.timestamp)
        ? revision
        : latest
    , null);

    return res.status(200).json({
      version: REVISION_HISTORY_VERSION,
      headRevisionId: headRevision?.revisionId ?? null,
      revisions: records,
    });
  } catch (error) {
    console.error("Get room revisions error:", error);
    return res.status(500).json({ message: "Failed to fetch room revisions." });
  }
};

const createRoomRevision = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.roomId)) {
      return res.status(400).json({ message: "Invalid room ID." });
    }
    const room = await findAccessibleRoom(req.params.roomId, req.user.userId);
    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied." });
    }

    const {
      revisionId,
      parentRevisionId = null,
      timestamp,
      changeDescription,
      snapshot,
    } = req.body || {};
    if (
      typeof revisionId !== "string" ||
      !revisionId.trim() ||
      (parentRevisionId !== null && typeof parentRevisionId !== "string") ||
      typeof timestamp !== "string" ||
      !Number.isFinite(Date.parse(timestamp)) ||
      typeof changeDescription !== "string" ||
      !changeDescription.trim() ||
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot) ||
      !REVISION_COLLECTIONS.every((collection) => Array.isArray(snapshot[collection]))
    ) {
      return res.status(400).json({ message: "Invalid revision data." });
    }

    if (parentRevisionId !== null) {
      const parentExists = await RoomRevision.exists({
        roomId: room._id,
        revisionId: parentRevisionId,
      });
      if (!parentExists) {
        return res.status(409).json({ message: "The parent revision does not exist." });
      }
    }

    const author = await User
      .findById(req.user.userId)
      .select("name")
      .lean();
    if (!author) {
      return res.status(401).json({ message: "Revision author could not be verified." });
    }

    const revision = await RoomRevision.create({
      roomId: room._id,
      revisionId: revisionId.trim(),
      parentRevisionId,
      timestamp: new Date(timestamp),
      authorId: req.user.userId,
      authorName: author.name,
      changeDescription: changeDescription.trim().slice(0, 120) || "Updated board",
      snapshot: Object.fromEntries(
        REVISION_COLLECTIONS.map((collection) => [collection, snapshot[collection]])
      ),
    });

    return res.status(201).json({
      revisionId: revision.revisionId,
      parentRevisionId: revision.parentRevisionId,
      timestamp: revision.timestamp.toISOString(),
      authorId: String(revision.authorId),
      changeDescription: revision.changeDescription,
      snapshot: revision.snapshot,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This revision already exists." });
    }
    console.error("Create room revision error:", error);
    return res.status(500).json({ message: "Failed to persist room revision." });
  }
};

module.exports = {
  createRoom,
  getMyRooms,
  joinRoom,
  getRoomRevisions,
  createRoomRevision,
};
