import { createServer as createHttpServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { apiHandler } from './api.js';
import type { Auth } from './auth.js';
import { KapitalRoom, type RoomOptions } from './room.js';
import { staticHandler } from './static.js';

export const ROOM_NAME = 'kapital';

export interface ServerOptions {
  /** Папка собранного клиента: если задана, сайт открывается с того же порта, что и игра. */
  webDir?: string;
}

/** Игровой сервер: комнаты Colyseus, HTTP-API аккаунтов под /api и, если собран, сайт. */
export function createServer(auth: Auth, roomOptions: Omit<RoomOptions, 'auth'> = {}, { webDir }: ServerOptions = {}): Server {
  const site = webDir ? staticHandler(webDir) : (_req: unknown, res: import('node:http').ServerResponse) => { res.writeHead(404).end(); };
  const transport = new WebSocketTransport({ server: createHttpServer(apiHandler(auth, site)) });
  const server = new Server({ transport });
  // комнаты с одинаковым restore — одна и та же продолженная партия
  server.define(ROOM_NAME, KapitalRoom, { ...roomOptions, auth }).filterBy(['restore']);
  return server;
}
