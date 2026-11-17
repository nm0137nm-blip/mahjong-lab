# Mortal AI integration — development checkpoint

Updated: 2026-11-18 (JST)

## Goal

Add a verified strong mahjong decision engine to Mahjong LAB's existing real-time tile-efficiency coach, while preserving the playable GitHub Pages app and the existing CPU as a baseline.

## Confirmed

- A development branch exists: `dev/mortal-ai-checkpoint-20261118`; the public `main` branch is not being modified.
- GitHub App access is restricted to `nm0137nm-blip/mahjong-lab`.
- A user-supplied `model.onnx` for the Mortal-S42 ONNX candidate was received in the ChatGPT development conversation. A prior verification reported a SHA-256 match to the published file (43,673,425 bytes). The weights themselves are **not** stored in this repository.
- Local proof-of-concept work covers MJAI conversion/static validation, model interface checks with mock inputs, and information separation between players; these do **not** yet establish real model inference or playing strength.

## Still required before shipping

1. Run the authentic ONNX model with a compatible runtime, record runtime and exact model hash.
2. Feed feature tensors produced by the genuine Mortal / libriichi feature encoder; validate live observations and legal-action masks against the reference implementation.
3. Confirm action indexing, dealer and round context, riichi/call/kan handling, and hidden-information separation.
4. Compare actions and gameplay outcomes against existing CPUs using statistically sufficient, seat-rotated trials and fixed seeds where possible.
5. Verify performance and offline availability on iPhone Safari before enabling the new model in the public app.

## Release safety

- Do not claim the present CPU is a high-dan-level coach.
- Do not label Mortal Q-values as expected hand scores or winning probabilities.
- Do not put the ~44 MB weights into the public deployment without checking license, provenance, and deployment behavior.
- Preserve the currently playable `main` branch until comprehensive tests succeed.

## Next development step

Establish reproducible real inference and genuinely encoded observations; report pass/fail evidence before deploying any AI replacement.
