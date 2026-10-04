"""Local model adapters. Imports and weights are loaded only on first use."""
import io
import os

import numpy as np
import soundfile as sf


class Whisper:
    def __init__(self):
        self.model = None

    def transcribe(self, audio: bytes) -> dict:
        from faster_whisper import WhisperModel
        from faster_whisper.audio import decode_audio

        samples = decode_audio(io.BytesIO(audio), sampling_rate=16000)
        if len(samples) == 0 or len(samples) > 120 * 16000:
            raise ValueError("Audio must be between zero and two minutes.")
        if self.model is None:
            device = os.getenv("WHISPER_DEVICE", "cpu")
            if device == "auto":
                device = "cpu"
            self.model = WhisperModel(
                os.getenv("WHISPER_MODEL", "base.en"),
                device=device,
                compute_type="int8" if device == "cpu" else "float16",
                download_root="/models/whisper",
                cpu_threads=int(os.getenv("SPEECH_CPU_THREADS", "4")),
            )
        segments, info = self.model.transcribe(
            samples, language="en", beam_size=1, vad_filter=False,
            condition_on_previous_text=False,
        )
        return {"text": " ".join(segment.text.strip() for segment in segments).strip(), "language": info.language}


class Kokoro:
    def __init__(self):
        self.pipeline = None

    def synthesize(self, text: str, voice: str) -> bytes:
        from kokoro import KPipeline
        import torch
        from loguru import logger

        # Kokoro debug logging can contain text chunks; disable its library logger.
        logger.disable("kokoro")
        if self.pipeline is None:
            torch.set_num_threads(int(os.getenv("SPEECH_CPU_THREADS", "4")))
            self.pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", device="cpu")
        # Retain only the active voice; repeated turns reuse its loaded asset.
        if voice not in self.pipeline.voices:
            self.pipeline.voices.clear()
        parts = [audio.numpy() for _, _, audio in self.pipeline(text, voice=voice) if audio is not None]
        if not parts:
            raise ValueError("No audio generated.")
        output = io.BytesIO()
        sf.write(output, np.concatenate(parts), 24000, format="WAV", subtype="PCM_16")
        return output.getvalue()
