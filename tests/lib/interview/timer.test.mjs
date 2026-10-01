import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
const { InterviewTimer, formatRemaining } = load(
  "../src/lib/interview/timer.ts",
);
const duration = 45 * 60_000;

function clock() {
  let now = 0;
  const timer = new InterviewTimer(() => now);
  timer.resume();
  return {
    timer,
    advance: (ms) => {
      now += ms;
    },
    remaining: () => duration - timer.elapsed(),
    display: () => formatRemaining(duration - timer.elapsed()),
  };
}

test("definition duration counts down through zero into unbounded overtime", () => {
  const c = clock();
  assert.equal(c.display(), "45:00");
  c.advance(1000);
  assert.equal(c.display(), "44:59");
  c.advance(duration - 2000);
  assert.equal(c.display(), "00:01");
  c.advance(1000);
  assert.equal(c.display(), "00:00");
  c.advance(1000);
  assert.equal(c.remaining(), -1000);
  assert.equal(c.display(), "+00:01");
  c.advance(93000);
  assert.equal(c.display(), "+01:34");
  assert.equal(formatRemaining(-3_661_000), "+61:01");
});

for (const [phase, elapsed, before, after] of [
  ["countdown", 60_000, "44:00", "43:59"],
  ["overtime", duration + 134_000, "+02:14", "+02:15"],
]) {
  test(`pause and resume exclude paused time during ${phase}`, () => {
    const c = clock();
    c.advance(elapsed);
    c.timer.pause();
    assert.equal(c.display(), before);
    c.advance(600_000);
    c.timer.pause();
    assert.equal(c.display(), before);
    c.timer.resume();
    c.timer.resume();
    c.advance(1000);
    assert.equal(c.display(), after);
  });
}

test("timestamps catch up after delayed rendering without accumulating tick drift", () => {
  const c = clock();
  c.advance(123_456);
  assert.equal(c.remaining(), duration - 123_456);
  c.advance(duration);
  assert.equal(c.remaining(), -123_456);
  assert.equal(c.display(), "+02:03");
});

test("candidate timer starts paused and ignores time before explicit Play", () => {
  let now = 900_000;
  const timer = new InterviewTimer(() => now);
  now += 600_000;
  assert.equal(timer.elapsed(), 0);
  assert.equal(formatRemaining(duration - timer.elapsed()), "45:00");
  timer.resume();
  now += 1000;
  assert.equal(formatRemaining(duration - timer.elapsed()), "44:59");
});
