import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { load } from "../register-typescript.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("hook plays streamed sentences during LLM work and does not replay final text", async () =>
  withBrowser(async ({ played }) => {
    const h = voiceHarness(controls()),
      input = props(),
      texts = [];
    globalThis.fetch = async (_url, init) => {
      texts.push(JSON.parse(init.body).text);
      return new Response("wav", { headers: { "Content-Type": "audio/wav" } });
    };
    try {
      const response = h.render(input).beginResponse();
      input.busy = true;
      h.render(input);
      response.push("Let's discuss your database design.");
      await flush();
      assert.deepEqual(texts, ["Let's discuss your database design."]);
      assert.equal(played.length, 1);
      assert.equal(
        input.messages.length,
        0,
        "speech is independent of committed turns",
      );
      response.push(
        "Let's discuss your database design. What would you choose?",
      );
      await flush();
      assert.equal(played.length, 2);
      const message = {
        id: "response",
        role: "interviewer",
        content: "Let's discuss your database design. What would you choose?",
      };
      response.finish(message);
      input.messages = [message];
      input.busy = false;
      h.render(input);
      await flush();
      assert.equal(texts.length, 2);
      assert.equal(input.messages[0].content, message.content);
    } finally {
      h.dispose();
    }
  }));

test("finish and a new interaction cancel queued and pending streamed audio", async () =>
  withBrowser(async ({ played }) => {
    const h = voiceHarness(controls()),
      input = props();
    let complete, signal;
    globalThis.fetch = (_url, init) => {
      signal = init.signal;
      return new Promise((resolve) => {
        complete = resolve;
      });
    };
    try {
      const response = h.render(input).beginResponse();
      response.push("First sentence. Second sentence.");
      input.finishing = true;
      h.render(input);
      assert.equal(signal.aborted, true);
      complete(
        new Response("wav", { headers: { "Content-Type": "audio/wav" } }),
      );
      await flush();
      assert.equal(played.length, 0);
      input.finishing = false;
      h.render(input);
      const next = h.render(input).beginResponse();
      next.push("Another first sentence.");
      h.render(input).beginResponse();
      assert.equal(signal.aborted, true);
      complete(
        new Response("wav", { headers: { "Content-Type": "audio/wav" } }),
      );
      await flush();
      assert.equal(played.length, 0);
    } finally {
      h.dispose();
    }
  }));

test("repeated Retry audio clicks reuse pending synthesis instead of restarting it", async () =>
  withBrowser(async () => {
    const h = voiceHarness(controls()),
      input = props();
    let calls = 0,
      complete;
    globalThis.fetch = async () => {
      if (++calls === 1) throw new Error("offline");
      return new Promise((resolve) => {
        complete = resolve;
      });
    };
    try {
      h.render(input);
      input.messages = [
        { id: "response", role: "interviewer", content: "Why?" },
      ];
      h.render(input);
      await flush();
      h.render(input).retry();
      h.render(input).retry();
      assert.equal(calls, 2);
      complete(
        new Response("wav", { headers: { "Content-Type": "audio/wav" } }),
      );
      await flush();
      assert.equal(h.render(input).speaking, true);
    } finally {
      h.dispose();
    }
  }));

async function withBrowser(run) {
  const keys = ["navigator", "MediaRecorder", "AudioContext", "fetch"];
  const originals = keys.map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  const recordings = [],
    played = [],
    tracks = [];
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
      recordings.push(this);
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      return this.onstop?.();
    }
  }
  class AudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    async resume() {}
    async close() {
      this.state = "closed";
    }
    async decodeAudioData() {
      return { duration: 1 };
    }
    createBufferSource() {
      return {
        connect() {},
        disconnect() {},
        start(time) {
          this.time = time;
          played.push(this);
        },
        stop() {
          this.paused = true;
        },
      };
    }
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          const track = {
            stopped: false,
            stop() {
              this.stopped = true;
            },
          };
          tracks.push(track);
          return { getTracks: () => [track] };
        },
      },
    },
  });
  globalThis.MediaRecorder = Recorder;
  globalThis.AudioContext = AudioContext;
  try {
    await run({ recordings, played, tracks });
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const controls = () => {
  const state = {
    recordingState: "idle",
    setRecordingState(value) {
      state.recordingState = value;
    },
    voiceEnabled: true,
    speechAvailable: true,
    playbackAvailable: true,
  };
  return state;
};

test("ending interview discards late transcription and permission grants release tracks", async () =>
  withBrowser(async ({ tracks }) => {
    const h = voiceHarness(controls()),
      dictated = [];
    const input = props((text) => dictated.push(text));
    let complete;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        complete = resolve;
      });
    try {
      h.render(input).toggleMicrophone();
      await flush();
      h.render(input).toggleMicrophone();
      await flush();
      input.active = false;
      h.render(input);
      complete(Response.json({ text: "Late answer", language: "en" }));
      await flush();
      assert.deepEqual(dictated, []);
      assert.equal(h.render(input).transcribing, false);
      assert.equal(tracks[0].stopped, true);
    } finally {
      h.dispose();
    }
    const pending = voiceHarness(controls());
    const next = props();
    let grant;
    let stopped = false;
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        grant = resolve;
      });
    pending.render(next).toggleMicrophone();
    pending.dispose();
    grant({
      getTracks: () => [
        {
          stop() {
            stopped = true;
          },
        },
      ],
    });
    await flush();
    assert.equal(stopped, true);
  }));
const props = (onDictation = () => {}) => ({
  messages: [],
  active: true,
  busy: false,
  onDictation,
});

test("record Stop releases microphone, transcribes once and fills draft without submitting", async () =>
  withBrowser(async ({ recordings, tracks }) => {
    const h = voiceHarness(controls()),
      dictated = [];
    const input = props((text) => dictated.push(text));
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ text: "Use Kafka", language: "en" });
    };
    try {
      h.render(input).toggleMicrophone();
      await flush();
      assert.equal(h.render(input).listening, true);
      assert.equal(calls, 0, "no continuous transcription");
      h.render(input).toggleMicrophone();
      assert.equal(h.render(input).transcribing, true);
      await flush();
      assert.deepEqual(dictated, ["Use Kafka"]);
      assert.equal(calls, 1);
      assert.equal(tracks[0].stopped, true);
      assert.equal(h.render(input).transcribing, false);
      assert.equal(recordings.length, 1);
    } finally {
      h.dispose();
    }
  }));

test("failed and empty transcription create no candidate answer and permit retry", async () =>
  withBrowser(async () => {
    for (const response of [
      () => {
        throw new Error("offline");
      },
      () => Response.json({ text: "", language: "en" }),
    ]) {
      const h = voiceHarness(controls()),
        dictated = [];
      const input = props((text) => dictated.push(text));
      globalThis.fetch = async () => response();
      try {
        h.render(input).toggleMicrophone();
        await flush();
        h.render(input).toggleMicrophone();
        await flush();
        assert.deepEqual(dictated, []);
        assert.match(h.render(input).error, /transcribe/);
        assert.equal(h.render(input).transcribing, false);
        h.render(input).retry();
        await flush();
        assert.equal(h.render(input).listening, true);
      } finally {
        h.dispose();
      }
    }
  }));

test("voice disabled skips TTS; TTS failure preserves final interviewer text", async () =>
  withBrowser(async ({ played }) => {
    const c = controls(),
      h = voiceHarness(c),
      input = props();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("offline");
    };
    try {
      h.render(input);
      c.voiceEnabled = false;
      input.messages = [
        { id: "first", role: "interviewer", content: "Visible response" },
      ];
      h.render(input);
      await flush();
      assert.equal(calls, 0);
      c.voiceEnabled = true;
      h.render(input);
      input.messages = [
        ...input.messages,
        { id: "second", role: "interviewer", content: "Still visible" },
      ];
      input.busy = true;
      h.render(input);
      await flush();
      assert.equal(calls, 0, "do not synthesize while response is pending");
      input.busy = false;
      h.render(input);
      await flush();
      assert.equal(calls, 1);
      assert.equal(input.messages.at(-1).content, "Still visible");
      assert.match(h.render(input).error, /Text remains available/);
      assert.equal(played.length, 0);
    } finally {
      h.dispose();
    }
  }));

test("Kokoro audio plays once; muting releases audio and unmount releases microphone", async () =>
  withBrowser(async ({ played, tracks }) => {
    const c = controls(),
      h = voiceHarness(c),
      input = props();
    globalThis.fetch = async () =>
      new Response("wav", { headers: { "Content-Type": "audio/wav" } });
    try {
      h.render(input);
      input.messages = [
        { id: "response", role: "interviewer", content: "Why?" },
      ];
      h.render(input);
      await flush();
      assert.equal(h.render(input).speaking, true);
      assert.equal(played.length, 1);
      c.voiceEnabled = false;
      h.render(input);
      assert.equal(played[0].paused, true);
      h.render(input).toggleMicrophone();
      await flush();
      assert.equal(tracks[0].stopped, false);
    } finally {
      h.dispose();
    }
    assert.equal(tracks[0].stopped, true);
  }));
function voiceHarness(controls) {
  const slots = [];
  const effects = [];
  let index = 0,
    dirty = false;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [
        slots[slot],
        (value) => {
          const next = typeof value === "function" ? value(slots[slot]) : value;
          if (!Object.is(next, slots[slot])) {
            slots[slot] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const slot = index++;
      return (slots[slot] ??= { current: initial });
    },
    useEffectEvent(callback) {
      const slot = index++;
      slots[slot] ??= {
        callback,
        fn: (...args) => slots[slot].callback(...args),
      };
      slots[slot].callback = callback;
      return slots[slot].fn;
    },
    useEffect(callback, dependencies) {
      const slot = index++;
      if (
        !slots[slot] ||
        dependencies.some(
          (dep, i) => !Object.is(dep, slots[slot].dependencies[i]),
        )
      ) {
        effects.push(() => {
          slots[slot]?.cleanup?.();
          slots[slot] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const source = readFileSync("src/components/use-interview-voice.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name === "react") return react;
      if (name === "./interview-controls-context")
        return { useInterviewControls: () => controls };
      if (name === "@/lib/voice/local-speech")
        return load("../src/lib/voice/local-speech.ts");
      if (name === "@/lib/voice/audio-queue")
        return load("../src/lib/voice/audio-queue.ts");
      if (name === "@/lib/voice/speech-stream")
        return load("../src/lib/voice/speech-stream.ts");
      if (name === "@/lib/settings/storage")
        return {
          readSpeechSettings: () => ({
            baseUrl: "http://localhost:8001",
            voice: "af_heart",
          }),
        };
      if (name === "@/lib/logging/logger")
        return load("../src/lib/logging/logger.ts");
      if (name === "@/lib/logging/turn")
        return load("../src/lib/logging/turn.ts");
      throw new Error(`Unexpected import ${name}`);
    },
    loadedModule,
    loadedModule.exports,
  );
  return {
    render(props) {
      let value;
      for (let count = 0; count < 12; count++) {
        index = 0;
        dirty = false;
        value = loadedModule.exports.useInterviewVoice(props);
        while (effects.length) effects.shift()();
        if (!dirty) return value;
      }
      throw new Error("Voice hook did not settle");
    },
    dispose() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}

test("Cancel discards recording without Whisper and clears microphone resources", async () =>
  withBrowser(async ({ recordings, tracks }) => {
    const h = voiceHarness(controls()),
      input = props();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw Error("unexpected Whisper call");
    };
    try {
      h.render(input).toggleMicrophone();
      await flush();
      assert.equal(h.render(input).recordingState, "recording");
      assert.ok(h.render(input).microphoneStream);
      h.render(input).cancelRecording();
      await flush();
      assert.equal(calls, 0);
      assert.equal(recordings[0].state, "inactive");
      assert.equal(tracks[0].stopped, true);
      assert.equal(h.render(input).microphoneStream, null);
      assert.equal(h.render(input).recordingState, "idle");
    } finally {
      h.dispose();
    }
  }));

test("recorded Send transcribes once, skips dictation, and exposes its explicit pending state", async () =>
  withBrowser(async ({ tracks }) => {
    const h = voiceHarness(controls()),
      dictated = [],
      sent = [];
    const input = {
      ...props((text) => dictated.push(text)),
      onRecordedAnswer: (text) => sent.push(text),
    };
    let complete,
      calls = 0;
    globalThis.fetch = () => {
      calls++;
      return new Promise((resolve) => (complete = resolve));
    };
    try {
      h.render(input).toggleMicrophone();
      await flush();
      h.render(input).stopRecording("send");
      h.render(input).stopRecording("send");
      assert.equal(h.render(input).recordingState, "transcribing-for-send");
      assert.equal(tracks[0].stopped, true);
      complete(Response.json({ text: "Use Kafka", language: "en" }));
      await flush();
      assert.deepEqual(sent, ["Use Kafka"]);
      assert.deepEqual(dictated, []);
      assert.equal(calls, 1);
      assert.equal(h.render(input).recordingState, "idle");
    } finally {
      h.dispose();
    }
  }));

test("failed recorded Send returns idle without submitting empty text", async () =>
  withBrowser(async () => {
    const h = voiceHarness(controls()),
      sent = [];
    const input = { ...props(), onRecordedAnswer: (text) => sent.push(text) };
    globalThis.fetch = async () =>
      Response.json({ text: "   ", language: "en" });
    try {
      h.render(input).toggleMicrophone();
      await flush();
      h.render(input).stopRecording("send");
      await flush();
      assert.deepEqual(sent, []);
      assert.equal(h.render(input).recordingState, "idle");
      assert.match(h.render(input).error, /transcribe/);
    } finally {
      h.dispose();
    }
  }));

test("starting microphone during interviewer playback cancels audio and starts recording", async () =>
  withBrowser(async ({ played, tracks }) => {
    const h = voiceHarness(controls()),
      input = props();
    globalThis.fetch = async () =>
      new Response("wav", { headers: { "Content-Type": "audio/wav" } });
    try {
      h.render(input);
      input.messages = [
        { id: "response", role: "interviewer", content: "Why?" },
      ];
      h.render(input);
      await flush();
      assert.equal(h.render(input).speaking, true);
      h.render(input).startRecording();
      await flush();
      assert.equal(played[0].paused, true);
      assert.equal(h.render(input).recordingState, "recording");
      assert.equal(tracks[0].stopped, false);
    } finally {
      h.dispose();
    }
    assert.equal(tracks[0].stopped, true);
  }));
