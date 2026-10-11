import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { load } from "js-yaml";

const compose = load(readFileSync("compose.yaml", "utf8"));
const dockerAvailable =
  spawnSync("docker", ["compose", "version"]).status === 0;

for (const [profiles, services] of [
  [[], ["openmock", "speech"]],
  [["local-ai"], ["ollama", "ollama-init", "openmock", "speech"]],
]) {
  test(
    `Compose enables only selected services: ${profiles.join(",") || "BYOK"}`,
    {
      skip: !dockerAvailable && "Docker Compose is not installed",
    },
    () => {
      const result = spawnSync(
        "docker",
        [
          "compose",
          "-f",
          "compose.yaml",
          ...profiles.flatMap((profile) => ["--profile", profile]),
          "config",
          "--format",
          "json",
        ],
        { encoding: "utf8", env: { ...process.env, COMPOSE_PROFILES: "" } },
      );
      assert.equal(result.status, 0, result.stderr);
      const config = JSON.parse(result.stdout);
      assert.deepEqual(Object.keys(config.services).sort(), services);
      assert.equal(config.services.openmock.depends_on, undefined);
      assert.equal(config.services.speech.profiles, undefined);
      if (config.services["ollama-init"]) {
        assert.equal(
          config.services["ollama-init"].depends_on.ollama.condition,
          "service_healthy",
        );
        assert.equal(config.services.ollama.ports[0].host_ip, "127.0.0.1");
        assert.equal(config.services.ollama.volumes[0].source, "ollama-models");
      }
    },
  );
}

test(
  "CPU override removes GPU requirements",
  {
    skip: !dockerAvailable && "Docker Compose is not installed",
  },
  () => {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        "compose.yaml",
        "-f",
        "compose.cpu.yaml",
        "--profile",
        "local-ai",
        "config",
        "--format",
        "json",
      ],
      { encoding: "utf8", env: { ...process.env, COMPOSE_PROFILES: "" } },
    );
    assert.equal(result.status, 0, result.stderr);
    const { ollama } = JSON.parse(result.stdout).services;
    assert.equal(ollama.deploy?.resources?.reservations?.devices, undefined);
    assert.deepEqual(ollama.healthcheck.test, ["CMD", "ollama", "list"]);
  },
);

const shell =
  process.platform === "win32"
    ? "C:/Program Files/Git/bin/bash.exe"
    : "/bin/sh";
const init = compose.services["ollama-init"].command[0].replaceAll("$$", "$");

for (const installed of [false, true]) {
  test(
    `Model initialization is idempotent (initially installed: ${installed})`,
    {
      skip: !existsSync(shell) && "POSIX shell is not installed",
    },
    () => {
      const result = spawnSync(
        shell,
        [
          "-ec",
          `
      installed=${installed ? 1 : 0}
      pulls=0
      ollama() {
        test "$2" = "$OLLAMA_MODEL"
        case "$1" in
          show) test "$installed" = 1 ;;
          pull) pulls=$((pulls + 1)); installed=1 ;;
          *) return 1 ;;
        esac
      }
      ${init}
      ${init}
      test "$pulls" = ${installed ? 0 : 1}
    `,
        ],
        {
          encoding: "utf8",
          env: { ...process.env, OLLAMA_MODEL: "custom:model" },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /already installed; skipping download/);
    },
  );
}

test(
  "Failed model downloads exit visibly with failure",
  {
    skip: !existsSync(shell) && "POSIX shell is not installed",
  },
  () => {
    const result = spawnSync(
      shell,
      [
        "-ec",
        `ollama() { echo "Ollama request failed" >&2; return 1; }; ${init}`,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, OLLAMA_MODEL: "qwen3:8b" },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Ollama request failed/);
    assert.doesNotMatch(result.stdout, /is ready/);
  },
);
