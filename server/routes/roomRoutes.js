
const express = require("express");
const router = express.Router();

const {
  createRoom,
  getMyRooms,
  joinRoom,
  getRoomRevisions,
  createRoomRevision,
} = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/my-rooms", authMiddleware, getMyRooms);
router.get("/:roomId/revisions", authMiddleware, getRoomRevisions);
router.post("/:roomId/revisions", authMiddleware, createRoomRevision);
module.exports = router;
