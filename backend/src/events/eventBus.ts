type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on<T>(eventName: string, handler: EventHandler<T>) {
    const handlers = this.handlers.get(eventName) ?? [];

    handlers.push(handler as EventHandler);

    this.handlers.set(eventName, handlers);
  }

  async emit<T>(eventName: string, payload: T) {
    const handlers = this.handlers.get(eventName) ?? [];

    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const eventBus = new EventBus();