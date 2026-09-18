import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidate, matchCandidate, normalizeUrl } from "../scripts/match-work-identities.mjs";

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

test("official code URL alone needs review because several papers may share a repo", () => {
  const result = evaluateCandidate({ title: "Open VLA release", links: { code: "https://github.com/openvla/openvla/" } }, work);
  assert.equal(result.decision, "review");
  assert.equal(result.evidence.exact_official_url, "https://github.com/openvla/openvla");
});

test("OpenReview query identity and opaque ID case are preserved", () => {
  const a = { id: "a", title: "One", identifiers: { openreview: "AbC123" }, canonical_url: "https://openreview.net/forum?id=AbC123" };
  assert.notEqual(normalizeUrl(a.canonical_url), normalizeUrl("https://openreview.net/forum?id=Different"));
  assert.equal(evaluateCandidate({ identifiers: { openreview: "abc123" } }, a).decision, "unmatched");
  assert.equal(evaluateCandidate({ url: "https://openreview.net/pdf?utm_source=robot&id=AbC123" }, a).decision, "auto-link");
  assert.equal(evaluateCandidate({ url: "https://openreview.net/forum?id=Different" }, a).decision, "unmatched");
  assert.equal(evaluateCandidate({ identifiers: { openreview: "https://openreview.net/forum?id=AbC123&id=Other" } }, a).decision, "unmatched");
});

test("arXiv abs/pdf, prefixed and legacy IDs match at work level without losing query identity", () => {
  for (const id of ["arXiv:2406.09246v2", "https://arxiv.org/pdf/2406.09246v3.pdf?download=1"]) assert.equal(evaluateCandidate({ identifiers: { arxiv: id } }, work).decision, "auto-link");
  const legacy = { id: "legacy", identifiers: { arxiv: "cs.AI/9901001" } };
  assert.equal(evaluateCandidate({ url: "https://arxiv.org/abs/cs.AI/9901001v2" }, legacy).decision, "auto-link");
  assert.equal(evaluateCandidate({ url: "https://arxiv.org.evil.example/abs/2406.09246" }, work).decision, "unmatched");
});

test("same identifier plus contradictory identifiers cannot auto-link", () => {
  const a = { ...work, identifiers: { arxiv: "2406.09246", doi: "10.1234/one" } };
  const result = matchCandidate({ identifiers: { arxiv: "2406.09246", doi: "10.1234/two" } }, [a]);
  assert.equal(result.decision, "review"); assert.equal(result.work_id, null);
  assert.deepEqual(result.evidence.conflicting_identifier_kinds, ["doi"]);
  assert.equal(result.requires_review, true);
});

test("conflicting explicit and URL IDs and invalid supplied IDs block automatic linking", () => {
  for (const candidate of [
    { identifiers: { arxiv: "2406.09246" }, url: "https://arxiv.org/abs/2405.12213" },
    { identifiers: { arxiv: "2406.09246" }, arxiv: "2405.12213" },
    { identifiers: { arxiv: "2406.09246", doi: "NOT_A_DOI" } },
    { arxiv: "2406.09246", url: "https://openreview.net/forum?id=AbC&id=Other" }
  ]) assert.equal(matchCandidate(candidate, [work]).decision, "review");
});

test("shared repositories give alternatives, never a misleading selected work", () => {
  const other = { ...work, id: "other", identifiers: { arxiv: "2405.12213" }, canonical_url: "https://arxiv.org/abs/2405.12213" };
  const candidate = { code: work.links.code };
  const result = matchCandidate(candidate, [work, other]);
  assert.equal(result.decision, "review"); assert.equal(result.ambiguous, true); assert.equal(result.work_id, null);
  assert.deepEqual(result.alternatives.map((item) => item.work_id).sort(), ["openvla-2024", "other"]);
  assert.deepEqual(result, matchCandidate(candidate, [other, work]));
  // A unique primary identity may select one even if the shared repository points to another.
  const exact = matchCandidate({ ...candidate, arxiv: "2406.09246" }, [other, work]);
  assert.equal(exact.decision, "auto-link"); assert.equal(exact.work_id, work.id);
});

test("duplicate registry identifiers and cross-work identifier conflicts require review", () => {
  const duplicate = { ...work, id: "duplicate" };
  let result = matchCandidate({ arxiv: "2406.09246" }, [work, duplicate]);
  assert.equal(result.decision, "review"); assert.equal(result.work_id, null);
  const other = { id: "other", identifiers: { doi: "10.1234/two", arxiv: "2405.12213" } };
  result = matchCandidate({ arxiv: "2406.09246", doi: "10.1234/two" }, [work, other]);
  assert.equal(result.decision, "review"); assert.equal(result.work_id, null);
});

test("URL normalization retains content query, path case and anchors; rejects credentials", () => {
  assert.equal(normalizeUrl("https://EXAMPLE.com/Article?id=A&utm_source=test"), "https://example.com/Article?id=A");
  assert.notEqual(normalizeUrl("https://example.com/a?id=A"), normalizeUrl("https://example.com/a?id=B"));
  assert.notEqual(normalizeUrl("https://example.com/A"), normalizeUrl("https://example.com/a"));
  assert.notEqual(normalizeUrl("https://example.com/a#one"), normalizeUrl("https://example.com/a#two"));
  assert.equal(normalizeUrl("https://name:secret@example.com/a"), null);
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
});

test("DOI URLs normalize case, missing publication year never acts like year zero", () => {
  assert.equal(evaluateCandidate({ doi: "https://doi.org/10.1234/EXAMPLE" }, { id: "doi", doi: "doi:10.1234/example" }).decision, "auto-link");
  const result = evaluateCandidate({ title: work.title, authors: work.lead_authors }, work);
  assert.equal(result.decision, "unmatched"); assert.equal(result.evidence.year_delta, null);
  assert.equal(matchCandidate({ title: work.title, year: 2024, authors: work.lead_authors }, [work]).work_id, null);
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
