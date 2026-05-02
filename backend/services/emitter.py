import time

async def emit(queue, stage, message, data=None, event_type="info", event_route="log"):
    print(f"[{event_type.upper()}] {message}")
    payload = {
        "event": event_route,
        "event_type": event_type,
        "stage": stage,
        "message": message,
        "data": data or {},
        "timestamp": time.time()
    }
    # For existing UI compatibility
    if data:
        payload.update(data)
    if queue:
        await queue.put(payload)
