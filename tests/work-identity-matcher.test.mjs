import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidate, matchCandidate } from "../scripts/match-work-identities.mjs";

const work = {
  id: "openvla-2024",
  title: "OpenVLA: An Open-Source Vision-Language-Action Model",
  year: 2024,
  lead_authors: ["Moo Jin Kim", "Karl Pertsch"],
  canonical_url: "https://arxiv.org/abs/2406.09246",
  identifiers: { arxiv: "2406.09246", doi: null, openreview: null },
  links: { project: "https://openvla.github.io/", code: "https://github.com/openvla/openvla", model: null }
};

test("exact arXiv identity auto-links, including a version suffix", () => {
  const result = evaluateCandidate({ title: "Different title", identifiers: { arxiv: "2406.09246v2" } }, work);
  assert.equal(result.decision, "auto-link");
  assert.deepEqual(result.evidence.exact_identifier_kinds, ["arxiv"]);
});

test("exact official code URL auto-links despite a title variant", () => {
  const result = evaluateCandidate({ title: "Open VLA release", links: { code: "https://github.com/openvla/openvla/" } }, work);
  assert.equal(result.decision, "auto-link");
  assert.equal(result.evidence.exact_official_url, "https://github.com/openvla/openvla");
});

test("strong title, author, and year evidence only creates a review candidate", () => {
  const result = evaluateCandidate({
    title: "OpenVLA An Open Source Vision Language Action Model",
    year: 2024,
    authors: ["Moo Jin Kim"]
  }, work);
  assert.equal(result.decision, "review");
  assert.equal(result.evidence.author_overlap, true);
});

test("title similarity without author evidence remains unmatched", () => {
  const result = evaluateCandidate({
    title: "OpenVLA An Open Source Vision Language Action Model",
    year: 2024,
    authors: ["Unrelated Researcher"]
  }, work);
  assert.equal(result.decision, "unmatched");
});

test("an unmatched candidate never exposes a misleading work id", () => {
  const result = matchCandidate({ id: "new-paper", title: "Unrelated work", year: 2026, authors: ["New Author"] }, [work]);
  assert.equal(result.decision, "unmatched");
  assert.equal(result.work_id, null);
});
