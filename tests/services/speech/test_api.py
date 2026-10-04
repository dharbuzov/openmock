"""HTTP contract tests; inference is mocked and no model weights are downloaded."""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "speech"))
engines = types.ModuleType("engines")
engines.Whisper = Mock
engines.Kokoro = Mock
sys.modules["engines"] = engines

import app as speech
from fastapi.testclient import TestClient


class SpeechAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(speech.app)
        speech.whisper = Mock()
        speech.kokoro = Mock()
        speech.states.update(stt="not-loaded", tts="not-loaded")

    def test_health_is_lazy_and_reports_readiness_after_inference(self):
        self.assertFalse(self.client.get("/health").json()["stt"]["ready"])
        speech.whisper.transcribe.return_value = {"text": "Use Kafka", "language": "en"}
        response = self.client.post("/stt/transcribe", files={"audio": ("answer.webm", b"audio", "audio/webm")})
        self.assertEqual(response.json(), {"text": "Use Kafka", "language": "en"})
        speech.whisper.transcribe.assert_called_once_with(b"audio")
        self.assertTrue(self.client.get("/health").json()["stt"]["ready"])

    def test_audio_upload_is_memory_backed(self):
        self.assertGreater(speech.MAX_AUDIO, 1024 * 1024)
        speech.whisper.transcribe.return_value = {"text": "OK", "language": "en"}
        self.assertEqual(self.client.post("/stt/transcribe", files={"audio": ("a.webm", b"x" * (2 * 1024 * 1024))}).status_code, 200)

    def test_invalid_and_oversize_uploads_do_not_reach_inference(self):
        self.assertEqual(self.client.post("/stt/transcribe", json={}).status_code, 415)
        self.assertEqual(self.client.post("/stt/transcribe", files={"other": ("a.wav", b"audio")}).status_code, 400)
        self.assertEqual(self.client.post("/stt/transcribe", files={"audio": ("a.wav", b"x" * (speech.MAX_AUDIO + 1))}).status_code, 413)
        speech.whisper.transcribe.assert_not_called()

    def test_tts_returns_wav_without_caching(self):
        speech.kokoro.synthesize.return_value = b"RIFFaudio"
        response = self.client.post("/tts/synthesize", json={"text": "Why Kafka?", "voice": "af_heart"})
        self.assertEqual(response.content, b"RIFFaudio")
        self.assertEqual(response.headers["content-type"], "audio/wav")
        self.assertEqual(response.headers["cache-control"], "no-store")
        speech.kokoro.synthesize.assert_called_once_with("Why Kafka?", "af_heart")

    def test_bad_tts_input_and_voice_paths_are_rejected(self):
        for body in [{"text": ""}, {"text": "x" * 8001}, {"text": "Hi", "voice": "/tmp/voice.pt"}, {"text": "Hi", "voice": "https://remote/voice"}, []]:
            self.assertEqual(self.client.post("/tts/synthesize", json=body).status_code, 422)
        self.assertEqual(self.client.post("/tts/synthesize", content=b"{").status_code, 400)
        self.assertEqual(self.client.post("/tts/synthesize", content=b"x" * 32769).status_code, 413)
        speech.kokoro.synthesize.assert_not_called()

    def test_model_failures_are_sanitized_and_retryable(self):
        speech.kokoro.synthesize.side_effect = RuntimeError("private transcript or path")
        response = self.client.post("/tts/synthesize", json={"text": "Hi"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private", response.text)
        self.assertEqual(self.client.get("/health").json()["tts"]["status"], "error")
        speech.kokoro.synthesize.side_effect = None
        speech.kokoro.synthesize.return_value = b"wav"
        self.assertEqual(self.client.post("/tts/synthesize", json={"text": "Hi"}).status_code, 200)

    def test_busy_service_has_no_inference_queue(self):
        speech.inference_lock.acquire()
        try:
            response = self.client.post("/tts/synthesize", json={"text": "Hi"}, headers={"Origin": "http://localhost:3000"})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers["retry-after"], "2")
            self.assertIn("Retry-After", response.headers["access-control-expose-headers"])
            speech.kokoro.synthesize.assert_not_called()
        finally:
            speech.inference_lock.release()

    def test_untrusted_browser_origin_is_rejected(self):
        self.assertEqual(self.client.post("/tts/synthesize", json={"text": "Hi"}, headers={"Origin": "https://untrusted.example"}).status_code, 403)
        response = self.client.options("/tts/synthesize", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")


if __name__ == "__main__":
    unittest.main()
