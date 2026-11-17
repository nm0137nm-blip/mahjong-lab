# 麻雀LAB / Mortal AI — Current checkpoint

Last updated: 2026-11-18 JST. All changes limited to `dev/mortal-ai-checkpoint-20261118`.

## Completed / verified

- **CP2.2.3**: Genuine user-provided Mortal-S42 ONNX weights ran through local ONNX Runtime 1.21 C API (not a mock). 11/11 synthetic-input regression checks passed; Linux CPU median ~61.9ms after warmups. See `CP2.2.3-REAL-INFERENCE.md`.
- **CP2.2.4**: Built the **authentic Rust libriichi V4 observation encoder** on a free, standard GitHub-hosted Ubuntu runner and captured one *fictional MJAI scene* as `obs[1012,34]` and `mask[46]`. Encoder code matched the user's provided Mortal source at four verified Git blob SHAs.
- Fed the exact encoder-generated feature bytes into the actual trained Mortal-S42 model on local CPU; validated digest `b6499f28617d477298e1aa4834633f962359194f7d17024e44460feea06d9c5b` and computed 46 Q values. Best legal action for this deliberately synthetic case was 37 (riichi); **not a general strategy assertion**.
- A reproduction workflow is in `.github/workflows/mortal-encoder-validation.yml`. Successful public GitHub Actions run: https://github.com/nm0137nm-blip/mahjong-lab/actions/runs/44184696820 .
- `tests/fixtures/synthetic_libriichi_v4_obs.b64` contains **only fictional model features**, not any user data. Never commit actual model weights.

## NOT achieved / deployment blockers

1. Live Mahjong LAB state -> MJAI -> Rust feature encoder -> Mortal decision handling over diverse gameplay, including pon/chi/kans, riichi acceptance, red fives and final scoring.
2. Strength evaluation of the specific Mortal-S42 checkpoint vs present CPU; no high-rank/strong-AI claim yet.
3. iPhone browser ONNX inference, offline data cache, frame-rate/memory impact.
4. License review of model weights and any redistributed runtime/source.

Raw Q values are **not** point EV, win percentage, or deal-in probability. The current public Mahjong LAB coach remains unchanged.

## Security and billing guarantees for this checkpoint

- No payment, purchase, subscription, billing setting change, paid runner or paid service initiated.
- Only free standard GitHub Actions in a **public** repo. No uploaded model, personal data, user hand histories, user images, secrets, or workflow artifacts.
- Workflow has `permissions: {}`, only public synthetic information and upstream source. Existing deployed `main` app remains unchanged.
- `.gitignore` protects against accidental weights/secret file additions; public commits are also manually reviewed.

Details: `CP2.2.4-ENCODER-TO-INFERENCE.md`.
