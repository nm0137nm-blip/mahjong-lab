# CP2.2.3 — Real Mortal-S42 ONNX inference, synthetic input only

Date: 2026-11-18 (JST). Status: **real trained-model inference SUCCESS; live Mahjong analysis NOT YET VERIFIED**.

## Reproducible evidence

- The user's locally provided `model.onnx` (43,673,425 bytes) matched public SHA-256 `30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4`.
- Found a locally preinstalled **ONNX Runtime C library 1.21.0** at `/usr/lib/x86_64-linux-gnu/libonnxruntime.so.1.21`. Used its versioned C API via Python `ctypes` because the Python `onnxruntime` package was unavailable.
- Loaded authentic weights and ran the network with synthetic `obs[1,1012,34]` (float32) and `mask[1,46]` (bool). Returned actual `q[1,46]` model output.
- 11/11 runtime tests passed: input/output interface, finite Q on legal actions, deterministic repeat, changed observation changes output, six legal-action mask patterns, no state leak between masks. When only action 24 was legal, it was selected and all 45 illegal actions received -Infinity.
- On a shared **Linux CPU**, 35 measured inference runs (after 5 warmups) had median 61.921 ms, p95 124.004 ms. **Not an iPhone benchmark** and not a gameplay result. Session load ~0.3s.

## Remaining release blockers

1. **Genuine observation encoder**: Rust `libriichi` must convert valid MJAI gameplay to the precise V4 input features. Not available in the current environment. A synthetic tensor does not establish valid Mahjong inference.
2. **Semantic checks**: action mapping and legal masks, red fives, calls, kan and riichi, hidden information, dealer/round context.
3. **Strength assessment**: no head-to-head or human-level ranking demonstrated; Mortal-S42 must not be represented as Mortal 4.1b or Soul-level strength by default.
4. **iPhone**: need ONNX Web runtime, WASM support/benchmark and offline packaging, with cache strategy.
5. **Licensing**: confirm model distribution conditions before any public release.
6. **Q values are NOT point expectancy, win rate or deal-in probability**.

## Security, privacy, billing

- **No model weights, personal data, credentials, raw user hands/screenshots or results** are in this GitHub branch.
- Added `.gitignore` to prevent accidentally committing weights, private observations and common secret files. Ignore rules are a safeguard, not a substitute for review.
- Tests use locally generated *synthetic* inputs, never send observations to external services.
- **No payments, purchases, subscriptions, or chargeable GitHub Actions job was initiated**.
- `main` remains unchanged; this is a development-only checkpoint.

## Reproduction

Full tested scripts, local observations and machine-readable summary were provided as a conversation artifact: `mahjong-lab-mortal-real-inference-cp26.zip`. The model weights are intentionally **not** included.

Next: produce verifiably genuine `libriichi` observation/mask arrays and feed them through this working ONNX inference path.
