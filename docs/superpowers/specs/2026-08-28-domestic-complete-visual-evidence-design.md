# Domestic Complete Visual Evidence Design

**Status:** Approved in principle on 2026-08-28; written review pending

## Objective

Produce complete, customer-readable visual evidence for domestic Browser Runner observations without granting Chrome debugger access, uploading uncropped browser views, or allowing evidence capture failures to block otherwise valid monitoring observations.

## Success criteria

- A normal domestic answer is represented by one complete answer-only long image and its ordered answer-only source segments.
- The extension never persists or uploads an uncropped viewport screenshot.
- Account identity, navigation, history sidebars, unrelated conversations, cookies, tokens, and browser storage are outside the evidence payload.
- A visual-evidence failure never resubmits a Prompt and never turns a collected answer into a terminal task failure.
- The customer UI distinguishes `complete`, `partial`, and `unavailable` visual evidence.
- Existing `browser-runner-observation.v2` clients remain accepted during rollout.
- No database migration is required.

## Non-goals

- Do not add Chrome's `debugger`, `cookies`, `webRequest`, or `<all_urls>` permissions.
- Do not capture browser chrome, extension panels, account menus, or an entire consumer page.
- Do not use OCR as the canonical answer source; the collected structured answer text remains canonical.
- Do not retry the AI request to repair missing screenshots.
- Do not add parallel screenshot capture on one paired browser device.

## Architecture

### 1. Evidence capture session

The content script owns a short-lived evidence capture session after the adapter has accepted a stable answer. It re-verifies the exact submitted Prompt, accepted answer, approved conversation URL, and completion controls before moving the page.

The session locates the narrowest common scroll container for the verified Prompt and answer region. It records the original scroll position, calculates ordered capture frames with a 64 CSS-pixel overlap, and returns one frame at a time. Each frame contains only the crop rectangle, sequence number, total frame count, and its logical vertical offset. At most 18 frames are allowed. If the answer exceeds that bound, the session reports `partial` instead of omitting the overflow silently.

The session restores the original scroll position and removes temporary privacy masks in a `finally` path after success, failure, timeout, or cancellation.

### 2. Least-privilege image capture

The background coordinator continues to use `chrome.tabs.captureVisibleTab` with the existing approved host allowlist. It does not attach the Chrome debugger.

For every frame, the extension:

1. activates and re-verifies the claimed tab and approved URL;
2. waits for layout and scroll position to settle;
3. captures the active viewport;
4. immediately crops it in extension memory to the verified answer-only rectangle;
5. discards the uncropped data URL;
6. encodes the cropped frame as JPEG.

No uncropped viewport bytes are written to extension storage or sent to the Portal.

### 3. Complete image and source segments

The coordinator keeps cropped segments in memory long enough to produce an answer-only composite JPEG. The composite is the primary customer-facing artifact. Ordered cropped segments are the audit and recovery artifacts.

Limits:

- maximum 18 source segments;
- maximum 1 MiB per source segment;
- maximum 4 MiB for the composite;
- maximum 6 MiB aggregate visual evidence per task;
- maximum two `captureVisibleTab` calls per second;
- one capture session at a time per paired device.

Encoding reduces JPEG quality within a bounded floor before declaring an artifact too large. It never removes middle frames to meet a byte limit. If a complete composite cannot be produced, successfully captured source segments remain eligible as `partial` evidence.

### 4. Observation protocol

Add `browser-runner-observation.v3` while retaining v2 validation.

The v3 observation contains:

```ts
visualEvidence: {
  status: "complete" | "partial" | "unavailable";
  primaryArtifactId: string | null;
  segmentArtifactIds: string[];
  expectedSegmentCount: number;
  capturedSegmentCount: number;
}
```

`evidenceArtifactIds` remains the ordered union of the primary artifact and segment artifacts for attachment. A complete observation requires a primary composite and every expected segment. A partial observation contains one or more source segments but no complete composite. An unavailable observation contains no visual artifact.

The server validates that IDs are unique, belong to the active claim, use JPEG media, respect byte limits, and match the declared evidence status. Legacy v2 observations still require exactly one bounded JPEG.

### 5. Failure isolation

Answer collection and evidence collection have separate outcomes:

```text
answer accepted -> answer collected -> evidence attempted -> observation completed
                                      | complete
                                      | partial
                                      | unavailable
```

After `answer collected`, evidence errors are converted into safe capture diagnostics. They do not call the task failure endpoint, do not retain a needs-human task, and do not cause Prompt resubmission. The observation and metrics are persisted from the complete answer text. Only answer collection or observation persistence failures retain the existing task-recovery behavior.

If one or more artifacts were uploaded before evidence capture stopped, v3 completion attaches those artifacts as partial evidence. If no safe crop exists, the observation completes with unavailable visual evidence.

### 6. Customer presentation and export

Response snapshot v2 remains readable and gains additive optional visual-evidence fields. The customer panel shows:

- `Complete visual evidence`: the primary long image, its SHA-256, and the segment count;
- `Partial visual evidence`: the ordered captured segments and an explicit incomplete label;
- `Visual evidence unavailable`: the complete archived answer text/HTML remains available without showing a broken image.

The standard snapshot ZIP includes the primary long image when complete and the ordered segment files plus their hashes. Existing historical snapshots without the new fields render unchanged.

## Privacy controls

- Crop bounds derive only from the exact verified Prompt, accepted answer, and bound completion controls.
- The visible account header, navigation, history sidebar, unrelated messages, and extension UI are outside the crop.
- Fixed or sticky elements intersecting the crop are masked locally only for the capture session and then restored.
- Upload requests use `credentials: "omit"` and carry only the paired runner bearer token plus task-scoped claim headers.
- Filenames contain task IDs and sequence numbers, never account names or Prompt text.
- Errors and diagnostics contain codes and geometry counts, never page text, HTML, cookies, tokens, or account identifiers.
- Operations continue to require a dedicated monitoring Chrome profile and monitoring account.

## Rollout

1. Deploy backward-compatible v3 server validation and customer rendering.
2. Package the new extension with no additional permissions.
3. Enable v3 capture for one domestic surface and run qualification fixtures.
4. Enable the remaining six domestic surfaces after the first surface completes an error-free batch.
5. Keep v2 acceptance during the rollout window; remove it only through a separate reviewed change.

## Testing

- Unit-test frame planning, overlap, bounds, scroll restoration, privacy crop validation, adaptive encoding, and composite ordering.
- Test that an uncropped data URL is never passed to upload or storage APIs.
- Test v2 compatibility and every v3 evidence status against the server contract.
- Test that capture and upload failures still complete an observation once answer text has been collected.
- Test customer rendering for complete, partial, unavailable, and historical evidence.
- Run the existing domestic adapter fixtures to ensure Prompt identity and answer collection remain unchanged.

