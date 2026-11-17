# CP2.2.4 — genuine libriichi V4 observation → pretrained Mortal-S42 ONNX

Date: 2026-11-18 (JST).

**Milestone: end-to-end inference on ONE PUBLIC SYNTHETIC Mahjong scene succeeded. This is NOT proof of strong play or complete game integration.**

## Evidence chain

1. Used one standard GitHub-hosted runner `ubuntu-24.04` in a public repository, free under GitHub's public-repository Actions policy. Workflow restricted to this development branch, `permissions: {}`, no secrets, no artifacts, no paid runners.
2. Cloned public upstream `Equim-chan/Mortal` at commit `0cff2b52982be5b1163aa9a62fb01f03ce91e0d2`. Compiled its Rust `libriichi` Python extension.
3. Created a deliberately **fictional** MJAI scene (East 1, 25000 each, self hand `1m..9m,1p,2p,3p,E`, draw `5s`; opponents' hands masked `?`). No user hand or match history was sent.
4. Through `libriichi.mjai.Bot` captured the **authentic V4 feature encoder** output `obs[1012,34]` float32 and `mask[46]` bool.
5. Recovered this synthetic feature tensor from GitHub logs, zlib+base64, and checked uncompressed raw SHA-256: `b6499f28617d477298e1aa4834633f962359194f7d17024e44460feea06d9c5b`.
6. Fed those exact bytes into **actual trained Mortal-S42** model (model SHA-256 `30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4`) locally through ONNX Runtime 1.21.0 C API; returned `q[1,46]`, with legal-action mask applied.

## Observed legal moves / Q values

Legal action indices: `[0,1,2,3,4,5,6,7,8,9,10,11,22,27,37]`.

Top five among **legal** actions for this synthetic scene:

| Action index | Raw model Q (not points) |
|---:|---:|
| 37 (riichi declaration) | 0.9627015591 |
| 22 (5s) | -1.9642283916 |
| 27 (East wind) | -3.3547084332 |
| 9 (1p) | -7.8507814407 |
| 8 (9m) | -8.3121471405 |

Note: riichi can be a separate decision stage before a discard; do not interpret this table as a complete turn/action sequence. The model was not evaluated for correct policy on a broad range of hands. Absolute Q values are **not** expected point values or probabilities.

Local Linux runtime for this exact synthetic sample: **25.768ms** for inference (not an iPhone benchmark).

## Reproduction references

- CI workflow: `.github/workflows/mortal-encoder-validation.yml`
- Public synthetic encoded sample: `tests/fixtures/synthetic_libriichi_v4_obs.b64`
- GitHub Actions run: https://github.com/nm0137nm-blip/mahjong-lab/actions/runs/44184696820
- Tested local ONNX C API script: `scripts/mortal/standalone_ort_smoke.py`
- Full generated local tests and results are in the user-delivered development ZIP; no model weight files in GitHub.

## Remaining gaps before app integration

- Real gameplay feed from Mahjong LAB to MJAI, and validated feature/step parity over **many** nontrivial states (calls, riichi, kan, riichi acceptance, terminal states, red fives, score/wind/dealer).
- Model strength vs current CPU, with reproducible seat-swapped trials and confidence intervals.
- Browser runtime / offline packaging / iPhone hardware performance.
- Model and code licensing review before any release.
- Do not use model's raw Q values as EV points or win-rate statistics.

## Privacy and billing

Only public upstream source and fictional, generated tiles were used on GitHub-hosted infrastructure. No private screenshots, user logs, wallet/payment data, model weights, GitHub secrets, or credentials were transferred. No purchase, subscription or billing change was made. Standard public-repository runners are free; no artifacts or larger runners used. All commits went to `dev/mortal-ai-checkpoint-20261118`; deployed `main` is unchanged.
