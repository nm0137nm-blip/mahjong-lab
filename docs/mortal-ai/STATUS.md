# 麻雀LAB Mortal AI — Development status

Updated: 2026-11-18 JST. Branch: `dev/mortal-ai-checkpoint-20261118` (public `main` unchanged).

## Completed

1. **Verified the user-provided Mortal-S42-ONNX checkpoint** by SHA-256. Weights were NOT uploaded or committed.
2. **Executed genuine learned ONNX inference** via locally installed ONNX Runtime **1.21.0** using the versioned C API (Python ctypes; no pip/network required).
3. Verified input/output interface `obs[1,1012,34]` float32 / `mask[1,46]` bool -> `q[1,46]`. 11/11 synthetic-input regression checks passed, including forced legal-action masks and deterministic repeats.
4. Measured synthetic-input desktop Linux CPU latency (35 repetitions after 5 warm-ups): median ~61.9ms, p95 ~124ms. This is **not iPhone performance**.
5. Added source reproduction: `scripts/mortal/standalone_ort_smoke.py` and `docs/mortal-ai/CP2.2.3-REAL-INFERENCE.md`.
6. Added `.gitignore` to reduce accidental uploads of weights, raw observations and secret files.

## NOT achieved

- The Rust `libriichi` observation encoder has **not** been compiled or run in this environment; real mahjong states are NOT connected to inference.
- Mortal-S42 strength vs existing CPU or against high-dan players has **not** been demonstrated.
- Browser ONNX Web + offline iPhone implementation has **not** been tested.
- No inference Q-value should be presented as expected score, win rate or deal-in probability.

## Release gates

Actual legitimate MJAI -> exact `libriichi` observation and mask -> real model output -> rule-conformance tests -> competitive tests -> iPhone browser tests -> license review -> only then deploy.

## Privacy, billing and scope

All tests used synthetic arrays and local runtime. No personal details, user scores, screenshots, secrets or model weights have been committed. No payment, subscription, paid compute service, or GitHub Actions run was initiated. All GitHub writes are on the development branch; no public gameplay deployment change.

See `CP2.2.3-REAL-INFERENCE.md` for verification details and limitations.
