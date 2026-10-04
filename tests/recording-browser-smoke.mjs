// Optional Chrome smoke check: running OpenMock, Playwright path as argv[2].
// Chrome supplies synthetic microphone audio; Whisper/LLM HTTP are mocked.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--mute-audio",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.addInitScript(() => {
    window.microphoneChecks = { samples: 0, closed: 0, tracks: [], peak: 0 };
    const OriginalContext = window.AudioContext;
    window.AudioContext = class extends OriginalContext {
      createAnalyser() {
        const node = super.createAnalyser(),
          read = node.getByteTimeDomainData.bind(node);
        node.getByteTimeDomainData = (buffer) => {
          window.microphoneChecks.samples++;
          read(buffer);
          window.microphoneChecks.peak = Math.max(
            window.microphoneChecks.peak,
            ...buffer.map((value) => Math.abs(value - 128)),
          );
        };
        return node;
      }
      close() {
        window.microphoneChecks.closed++;
        return super.close();
      }
    };
    const get = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await get(options);
      window.microphoneChecks.tracks.push(...stream.getTracks());
      return stream;
    };
  });
  let llmCalls = 0;
  let whisperCalls = 0,
    pending;
  await page.route("**/stt/transcribe", (route) => {
    whisperCalls++;
    pending = route;
  });
  await page.route("**/api/chat", (route) => {
    llmCalls++;
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          model: "smoke-test",
          created_at: new Date().toISOString(),
          message: {
            role: "assistant",
            content: JSON.stringify({
              message: "What would you clarify first?",
              stageComplete: false,
              observations: [],
            }),
          },
          done: false,
        }) +
        "\n" +
        JSON.stringify({
          model: "smoke-test",
          done: true,
          done_reason: "stop",
          message: { role: "assistant", content: "" },
          eval_count: 20,
          prompt_eval_count: 20,
        }) +
        "\n",
    });
  });
  await page.goto("http://localhost:3000");
  const response = await page.request.post(
    "http://localhost:3000/api/interview",
    { data: { problemId: "conflict-with-teammate" } },
  );
  assert.equal(response.status(), 201);
  const interview = await response.json();
  await page.evaluate((interview) => {
    sessionStorage.setItem(
      `openmock:interview:${interview.id}`,
      JSON.stringify({ interview }),
    );
    localStorage.setItem(
      "openmock:ai-preferences",
      JSON.stringify({
        provider: "ollama",
        ollama: { model: "smoke-test", baseUrl: "http://localhost:11434" },
        interviewerVoiceEnabled: false,
      }),
    );
  }, interview);
  await page.goto(
    `http://localhost:3000/interview/conflict-with-teammate?session=${interview.id}`,
  );
  await page
    .getByText("What would you clarify first?", { exact: true })
    .waitFor();
  assert.equal(llmCalls, 1);
  await page.reload();
  await page
    .getByText("What would you clarify first?", { exact: true })
    .waitFor();
  assert.equal(llmCalls, 1, "saved opening is not regenerated on room reload");
  const header = page.locator("[data-interview-room] > header");
  assert.ok(!/Interaction|\bChat\b|\bLive\b/.test(await header.innerText()));
  const centerBounds = await header
    .getByRole("button", { name: "Resume interview timer" })
    .locator("..")
    .locator("..")
    .boundingBox();
  assert.ok(
    Math.abs(centerBounds.x + centerBounds.width / 2 - 720) < 2,
    "timer group remains centered",
  );
  const input = page.getByRole("textbox", { name: "Your answer" });
  assert.ok(
    (await header.innerText()).includes("Type or press Ctrl+M to talk"),
  );
  await input.fill("Typed context");
  const form = page.locator("form").filter({ has: input });
  const height = (await form.boundingBox()).height;
  await input.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ь",
        code: "KeyM",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await page.getByRole("button", { name: "Cancel recording" }).waitFor();
  console.log(
    "Verified: physical Ctrl+M with Cyrillic key value starts recording",
  );
  await page.getByRole("button", { name: "Cancel recording" }).waitFor();
  assert.equal(await input.count(), 0);
  assert.ok((await header.innerText()).includes("Listening…"));
  await page.waitForFunction(
    () =>
      window.microphoneChecks.samples > 5 && window.microphoneChecks.peak > 1,
  );
  const recordingHeight = (await page.locator("form").boundingBox()).height;
  assert.ok(
    Math.abs(height - recordingHeight) < 2,
    `${height} -> ${recordingHeight}`,
  );
  await page.screenshot({ path: ".next/recording-ux.png" });
  await page.getByRole("button", { name: "Cancel recording" }).press("Escape");
  assert.equal(await input.inputValue(), "Typed context");
  assert.equal(whisperCalls, 0);
  await page.waitForFunction(
    () =>
      window.microphoneChecks.closed >= 1 &&
      window.microphoneChecks.tracks.every(
        (track) => track.readyState === "ended",
      ),
  );
  await page.keyboard.press("Control+m");
  await page.getByRole("button", { name: "Stop and review" }).waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+m");
  await page.waitForFunction(() =>
    document.body.textContent.includes("Transcribing…"),
  );
  assert.equal(await input.count(), 0);
  assert.ok((await header.innerText()).includes("Transcribing…"));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+m");
  for (let count = 0; !pending && count < 250; count++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(pending, "Whisper request should begin");
  await pending.fulfill({ json: { text: "Use Kafka", language: "en" } });
  pending = null;
  await input.waitFor();
  assert.equal(await input.inputValue(), "Typed context Use Kafka");
  await input.fill("");
  await page.keyboard.press("Control+m");
  await page.getByRole("button", { name: "Stop and send" }).waitFor();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Cancel recording" }).press("Enter");
  for (let count = 0; !pending && count < 250; count++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(pending, "Whisper request should begin");
  await pending.fulfill({
    json: { text: "Recorded candidate", language: "en" },
  });
  await page.getByText("Recorded candidate", { exact: true }).waitFor();
  assert.equal(await input.inputValue(), "");
  assert.equal(
    await page.getByText("Recorded candidate", { exact: true }).count(),
    1,
  );
  assert.equal(whisperCalls, 2);
  pending = null;
  // Repeated room-wide cycles, with focus outside the composer and real Excalidraw.
  const diagramResponse = await page.request.post(
    "http://localhost:3000/api/interview",
    { data: { problemId: "url-shortener" } },
  );
  const diagramInterview = await diagramResponse.json();
  await page.evaluate(
    (interview) =>
      sessionStorage.setItem(
        `openmock:interview:${interview.id}`,
        JSON.stringify({ interview }),
      ),
    diagramInterview,
  );
  await page.goto(
    `http://localhost:3000/interview/url-shortener?session=${diagramInterview.id}`,
  );
  await page.locator(".excalidraw canvas.interactive").first().waitFor();
  await page
    .getByText("What would you clarify first?", { exact: true })
    .waitFor();
  const focusTargets = [
    "textarea",
    "diagram",
    "room-control",
    "textarea",
    "diagram",
    "room-control",
  ];
  for (const [index, target] of focusTargets.entries()) {
    if (target === "textarea") await input.focus();
    else if (target === "diagram")
      await page
        .locator(".excalidraw canvas.interactive")
        .first()
        .click({ position: { x: 200, y: 200 } });
    else
      await page
        .getByRole("button", { name: "Finish interview", exact: true })
        .focus();
    if (index % 2)
      await page.evaluate(() =>
        document.activeElement.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ь",
            code: "KeyM",
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
    else await page.keyboard.press("Control+m");
    await page.getByRole("button", { name: "Cancel recording" }).waitFor();
    // Timer/typing updates must not install duplicate listeners or stale state.
    await page.waitForTimeout(index === 0 ? 1100 : 300);
    if (target === "diagram")
      await page
        .locator(".excalidraw canvas.interactive")
        .first()
        .click({ position: { x: 200, y: 200 } });
    else
      await page
        .getByRole("button", { name: "Finish interview", exact: true })
        .focus();
    const beforeStop = whisperCalls;
    await page.keyboard.press("Control+m");
    for (let count = 0; !pending && count < 250; count++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(pending);
    await page.keyboard.press("Control+m");
    await page.keyboard.press("Control+m");
    assert.equal(whisperCalls, beforeStop + 1);
    const route = pending;
    pending = null;
    await route.fulfill({
      json: { text: `Cycle ${index + 1}`, language: "en" },
    });
    await page
      .getByRole("button", { name: "Cancel recording" })
      .waitFor({ state: "hidden" });
    for (
      let count = 0;
      !(await input.inputValue()).includes(`Cycle ${index + 1}`) && count < 250;
      count++
    )
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok((await input.inputValue()).includes(`Cycle ${index + 1}`));
  }
  assert.equal(whisperCalls, 8);
  console.log(
    "Verified six start/stop/review cycles across textarea, diagram, and room controls; Ctrl and Meta; Latin and Cyrillic layouts",
  );
  console.log(
    JSON.stringify({
      idleHeight: height,
      recordingHeight,
      whisperCalls,
      microphone: await page.evaluate(() => ({
        samples: window.microphoneChecks.samples,
        peak: window.microphoneChecks.peak,
        closed: window.microphoneChecks.closed,
        tracksEnded: window.microphoneChecks.tracks.every(
          (track) => track.readyState === "ended",
        ),
      })),
    }),
  );
} finally {
  await browser.close();
}
