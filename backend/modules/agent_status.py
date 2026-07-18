"""Tiny in-memory pub/sub so long-running agent tasks (scraper, matcher,
email scan) can push progress to any connected dashboard over
/ws/agent-status without a message broker."""
import asyncio
import json


class AgentStatusHub:
    def __init__(self) -> None:
        self._connections: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._connections.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._connections.discard(queue)

    def broadcast(self, event: str, detail: dict | None = None) -> None:
        payload = json.dumps({"event": event, "detail": detail or {}})
        for queue in list(self._connections):
            queue.put_nowait(payload)


hub = AgentStatusHub()
