import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (callback) => {
    callback({ token: sessionStorage.getItem("token") });
  },
});

export default socket;