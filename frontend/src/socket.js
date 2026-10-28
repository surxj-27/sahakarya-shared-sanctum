import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  autoConnect: false,
  auth: (callback) => {
    callback({ token: sessionStorage.getItem("token") });
  },
});

export default socket;