import { createServer as createHttpServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KapitalRoom, type RoomOptions } from './room.js';
import { staticHandler } from './static.js';

export const ROOM_NAME = 'kapital';

export interface ServerOptions {
  /** Папка собранного клиента: если задана, сайт открывается с того же порта, что и игра. */
  webDir?: string;
}

export function createServer(roomOptions: RoomOptions = {}, { webDir }: ServerOptions = {}): Server {
  const transport = webDir
    ? new WebSocketTransport({ server: createHttpServer(staticHandler(webDir)) })
    : new WebSocketTransport();
  const server = new Server({ transport });
  // комнаты с одинаковым restore — одна и та же продолженная партия
  server.define(ROOM_NAME, KapitalRoom, roomOptions).filterBy(['restore']);
  return server;
}
