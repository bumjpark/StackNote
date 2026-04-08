import { Server } from "@hocuspocus/server";

// Hocuspocus 서버 인스턴스 생성
const server = new Server({
  port: 8000,
  
  async onConnect(data) {
    console.log("New connection to document:", data.documentName);
  },

  async onDisconnect(data) {
    console.log("Disconnected from document:", data.documentName);
  },
});

// 서버 실행
server.listen().then(() => {
    console.log("Collaboration Server (Hocuspocus) is running on port 8000");
});
