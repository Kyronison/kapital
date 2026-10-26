import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KapitalRoom, type RoomOptions } from './room.js';

export const ROOM_NAME = 'kapital';

export function createServer(roomOptions: RoomOptions = {}): Server {
  const server = new Server({ transport: new WebSocketTransport() });
  // комнаты с одинаковым restore — одна и та же продолженная партия
  server.define(ROOM_NAME, KapitalRoom, roomOptions).filterBy(['restore']);
  return server;
}
