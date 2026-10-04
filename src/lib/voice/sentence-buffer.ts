// The LLM callback supplies cumulative message snapshots, not individual deltas.
// This buffer changes only speech transport; the original text is never mutated.
export class SentenceBuffer {
  private emitted = "";

  push(snapshot: string, final = false): string[] {
    if (!snapshot.startsWith(this.emitted)) {
      if (
        this.emitted.startsWith(snapshot) &&
        !this.emitted.slice(snapshot.length).trim()
      )
        return [];
      throw new Error("The speech stream revised already queued text.");
    }
    let pending = snapshot.slice(this.emitted.length);
    const chunks: string[] = [];
    while (pending) {
      let boundary = -1;
      for (let index = 0; index < pending.length; index++) {
        const character = pending[index];
        if (character === "\n" || character === "?" || character === "!") {
          boundary = index + 1;
          break;
        }
        if (character === ".") {
          // Wait for the next character to distinguish decimals and abbreviations.
          const next = pending[index + 1];
          const word = pending.slice(0, index).match(/([\w.]+)$/)?.[1] ?? "";
          const abbreviation =
            /^(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|e\.g|i\.e|vs)$/i.test(word) ||
            /^[A-Z]$/.test(word);
          if (
            !abbreviation &&
            ((next && /[\s"”')\]]/.test(next)) ||
              (!next && (final || !/^\d+$/.test(word))))
          ) {
            boundary = index + 1;
            break;
          }
        }
      }
      if ((boundary < 0 || boundary > 160) && pending.length >= 160) {
        const space = pending.lastIndexOf(" ", 160);
        // Never split a word or send character/token fragments.
        if (space >= 80) boundary = space + 1;
        else {
          const nextSpace = pending.indexOf(" ", 160);
          if (nextSpace >= 0) boundary = nextSpace + 1;
        }
      }
      if (boundary < 0 && final) boundary = pending.length;
      if (boundary < 0) break;
      const raw = pending.slice(0, boundary);
      this.emitted += raw;
      pending = pending.slice(boundary);
      if (/[\p{L}\p{N}]/u.test(raw)) chunks.push(raw.trim());
    }
    return chunks;
  }
}
