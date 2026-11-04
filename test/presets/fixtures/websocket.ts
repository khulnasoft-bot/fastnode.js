import { defineWebSocketHandler } from "fastnode";

export default defineWebSocketHandler({
  open(peer) {
    peer.send("ready");
  },
  message(peer, message) {
    peer.send(`echo:${message.text()}`);
  },
});
