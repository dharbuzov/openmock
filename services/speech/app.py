import os
import re
import threading

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.formparsers import MultiPartParser, MultiPartException
from starlette.concurrency import run_in_threadpool

from engines import Whisper, Kokoro

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
allowed_origins = os.getenv("SPEECH_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    expose_headers=["Retry-After"],
)
whisper = Whisper()
kokoro = Kokoro()
inference_lock = threading.Lock()
states = {"stt": "not-loaded", "tts": "not-loaded"}
MAX_AUDIO = 10 * 1024 * 1024


@app.middleware("http")
async def check_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in allowed_origins:
        return Response(status_code=403)
    return await call_next(request)


async def bounded_body(request: Request, limit: int):
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise HTTPException(413, "Request too large.")
        yield chunk


def infer(capability, operation):
    # No unbounded inference queue or parallel model loading on laptop CPUs.
    if not inference_lock.acquire(blocking=False):
        raise HTTPException(429, "Speech service busy. Try again.", headers={"Retry-After": "2"})
    states[capability] = "working"
    try:
        result = operation()
        states[capability] = "ready"
        return result
    except ValueError:
        states[capability] = "error"
        raise HTTPException(422, "Could not process speech input.") from None
    except Exception:
        states[capability] = "error"
        raise HTTPException(503, "Local speech unavailable. Check model downloads and service configuration.") from None
    finally:
        inference_lock.release()


@app.get("/health")
def health():
    return {"stt": {"ready": states["stt"] == "ready", "status": states["stt"]}, "tts": {"ready": states["tts"] == "ready", "status": states["tts"]}}


@app.post("/stt/transcribe")
async def transcribe(request: Request):
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise HTTPException(415, "Expected multipart audio.")
    # Validate total size before parsing, so oversized requests cannot leave
    # partially constructed upload handles behind.
    body = b"".join([chunk async for chunk in bounded_body(request, MAX_AUDIO + 65536)])

    async def upload_stream():
        yield body

    parser = MultiPartParser(request.headers, upload_stream(), max_files=1, max_fields=0)
    # Bounded multipart uploads stay in memory; no recording is written to disk.
    parser.spool_max_size = MAX_AUDIO + 65536
    try:
        form = await parser.parse()
    except MultiPartException:
        raise HTTPException(400, "Expected one audio file.") from None
    try:
        audio = form.get("audio")
        if audio is None or not hasattr(audio, "read"):
            raise HTTPException(400, "Audio file required.")
        data = await audio.read(MAX_AUDIO + 1)
        if not data or len(data) > MAX_AUDIO:
            raise HTTPException(413, "Audio must be nonempty and at most 10 MiB.")
        return await run_in_threadpool(infer, "stt", lambda: whisper.transcribe(data))
    finally:
        await form.close()


@app.post("/tts/synthesize")
async def synthesize(request: Request):
    import json
    body = b"".join([chunk async for chunk in bounded_body(request, 32768)])
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid JSON.") from None
    if not isinstance(payload, dict):
        raise HTTPException(422, "Expected text and optional voice.")
    text = payload.get("text")
    voice = payload.get("voice") or os.getenv("KOKORO_VOICE", "af_heart")
    if not isinstance(text, str) or not text.strip() or len(text) > 8000:
        raise HTTPException(422, "Text must contain 1–8000 characters.")
    # Prevent voice paths/URLs from becoming file loads in Kokoro.
    if not isinstance(voice, str) or not re.fullmatch(r"a[fm]_[a-z]+", voice):
        raise HTTPException(422, "Choose an American English Kokoro voice.")
    audio = await run_in_threadpool(infer, "tts", lambda: kokoro.synthesize(text.strip(), voice))
    return Response(audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})
