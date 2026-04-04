import type { ReadableStreamDefaultController } from 'node:stream/web';

type Client = {
  id: string;
  controller: ReadableStreamDefaultController;
};

const clients = new Set<Client>();

function formatSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function addClient(controller: ReadableStreamDefaultController): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  clients.add({ id, controller });
  return id;
}

export function removeClient(id: string): void {
  for (const client of clients) {
    if (client.id === id) {
      clients.delete(client);
      break;
    }
  }
}

export function broadcast(event: string, data: unknown): void {
  const payload = formatSSE(event, JSON.stringify(data));
  for (const client of clients) {
    try {
      client.controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      // 连接已关闭，稍后清理
      clients.delete(client);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
