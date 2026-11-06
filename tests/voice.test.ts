import { test } from "node:test";
import assert from "node:assert/strict";
import { englishVoices, toSpeech, voiceScore } from "../src/lib/tutor/voice.ts";

test("natural voices rank above robotic ones", () => {
  const v = (name: string, lang = "en-US") => ({ name, lang }) as SpeechSynthesisVoice;
  const ranked = englishVoices([v("Fred"), v("Microsoft David - English (United States)"), v("Google UK English Female", "en-GB"), v("Microsoft Aria Online (Natural) - English (United States)"), v("Google español", "es-ES")]);
  assert.equal(ranked[0].name, "Microsoft Aria Online (Natural) - English (United States)");
  assert.equal(ranked[1].name, "Google UK English Female");
  assert.ok(!ranked.some((x) => x.lang.startsWith("es")));
  assert.ok(voiceScore(v("Fred")) < voiceScore(v("Microsoft David - English (United States)")));
});

test("markdown answers become clean spoken sentences", () => {
  const pieces = toSpeech("**Definition**\nEclampsia is seizures in preeclampsia [S1].\n\n- Monitor BP ≥ 160 → notify OB\n- e.g. magnesium");
  const all = pieces.join(" ");
  assert.ok(!/[*\[\]#]/.test(all), all);
  assert.match(all, /Definition\./);
  assert.match(all, /at least 160 then notify OB/);
  assert.match(all, /for example, magnesium/);
  assert.ok(pieces.every((p) => p.length <= 260));
});
