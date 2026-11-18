# CP2.5.9: corpus-scale learning → conditional coaching facts
## Corpus and clean split
Canonical run 44309389655, commit 6ae46191915a0dc5680f45462d0efc2c3e5f2a98. 80 training games: 11,338 decisions (8,810 turn,2,528 reaction), 20 validation:3,391 (2,624 turn,767 reaction). 20 final-test games not downloaded or opened. All 100 train/validation match IDs, seeds, checkpoint, phase, legal masks, best action and Q rows validated; zero duplicate public scene+legal action hashes. Four training and one validation progression fallbacks; unmatched snapshots/masks excluded at collection. Accepted labels still matched legal masks. Scope not Phoenix-table distribution. No double counting of duplicate CI run.
## Learning curve
Same 2,355 discard-only validation decisions (20 half-games), 7,892 discard-only training (80). 3,446/1,036 non-discard-only excluded. Fixed 25-feature pairwise logistic ranker, standardized on training, C=.1, equal total weight by decision. For 4/10/20/40 half-games average four random subsets (seeds 259..262; no validation tuning); 80 all. 
| matches | normalized gap % | exact % |
|---|---:|---:|
|4|10.587|57.431|
|10|9.600|60.053|
|20|9.512|60.032|
|40|9.342|60.329|
|80|9.088|61.062|
Fixed min shanten/max ukeire/max retained dora/tile order baseline: 53.291% exact, 73.631% top2, 14.512% normalized gap. Linear:61.062% exact,82.930% top2,9.088% gap. Match-cluster paired bootstrap 95% interval for baseline-minus-linear gap reduction:4.038..6.974 percentage points. Exploratory, not generalization to human games. Gains taper. Depth-7 gradient model observed 60.934% exact and 8.549% gap; multi-depth run timed out before completion, not a selected production model.
## Conditional comparisons independent of Q direction
Within each discard-only decision, choose one ordered legal pair per predicate with SHA256(id|rule|actionA|actionB) minimum, before reading Q. Features and Q exact; normalized Q gap >.02 = support, <-.02 reverse, otherwise near tie. Bootstrap whole matches 4,000 resamples (seed259), not independent decisions or causal attribution; unadjusted for multiple comparisons. No-riichi means no OTHER player declared riichi; not necessarily no threat. Conditions use minimum shanten over all legal discards unless otherwise noted. Initial screen >=100 decisions and >=10 matches in EACH split, lower exploratory CI support >.5 and lower CI normalized delta >0. Additional conservative choice: do not pass small dora/ukeire tradeoff into coach because weak support and multiple comparisons. 
| predicate A vs B | train n/support% | val n/support% | status |
|---|---:|---:|---|
| same min shanten/dora, ukeire +5+, no opponent reach |3398/86.55|925/84.65|pilot bank|
| same min shanten, abs ukeire difference<=2, retained dora +1, no opponent reach |1761/78.53|583/78.04|pilot bank|
| same min shanten, ukeire -1..-4, dora +1, no opponent reach |1020/56.86|325/59.08|weak; not promoted|
| both singleton suited tiles, same min shanten/dora, abs ukeire diff<=2, A has zero same-suit neighbors ±2, B >=2, no opponent reach |901/86.13|323/83.28|pilot bank|
| same previous conditions, both isolated, A terminal B rank3..7 |359/83.29|90/82.22|insufficient sample|
| same min shanten/dora, abs ukeire diff<=2, one opponent reach, A genbutsu and B not for that player |621/91.95|162/93.83|pilot bank|
| min shanten>=2, A +1 shanten, same dora, one opponent reach, A genbutsu and B not |202/75.25|65/81.54|insufficient sample|
| min shanten 0, A 1-shanten, same dora, one opponent reach, A genbutsu and B not |49/10.20|28/3.57|insufficient sample, reverse direction; not generalized|
| A min shanten, B +1 shanten, same dora, no opponent reach |5591/88.39|1716/89.10|pilot bank|
Neighbor count is NOT suji safety. "Non-genbutsu" is NOT dangerous proven. Dora retention uses visible candidate fact including red.
## Connection, not simple prediction
Runtime retrieves at most the conditions that apply to the exact S42 top vs player choice (if same, next highest legal Q). Only matched S42 decisions, all legal actions discards; full candidate facts; otherwise no augmentation. Conditional population supports are not selected pair's individual probability. Contradiction explicitly retained. No training case IDs, keys or predictions sent to production prompt. Current baseline prompt and default mode remain unchanged. Dev v4e adds optional evidence for A/B evaluation, not production.
At validation comparison selection (S42 top vs simple efficiency choice, second Q if equal), five-rule bank covered 616/2355 cases (26.16%); 428 with support, 159 with opposite nontrivial direction, 29 all near tie. Comparison target selects top with Q, so this is coverage/contradiction diagnostic, NOT a blind accuracy metric. It demonstrates the need for contradictory evidence and additional features.
Actual validation example validation-09-s42-01-038: p6 cut vs m0 cut; 2-shanten both, ukeire 30 vs29, retained dora 1 vs0. Actual live Majiang engine recalculated these and development buildPrompt opt-in retrieved DORA_TIE; default identical, Q retained; stale, special-action, wrong source rejected. This is an integration check, not independent explanation quality.
## A/B evaluation before promotion
Same model, same fresh chat or standardized isolated sessions, random labels and counterbalanced order. Prepare at least 60 diagnostic matched comparisons (pilot on consumed validation), then >=500 fresh decisions across categories; retain cases where rules oppose Q and uncovered cases, not only successes. A=current v4.2; C=same prompt with conditional evidence only. Optional B=same prompt with discard-prediction output only, to separate the mechanism. Score exact factual claims with deterministic engine, paired blinded expert rubric (0–2 each: actual strategic comparison, factual precision, alternative route and tradeoff, counterfactual condition, practical coaching). Do not provide sample labels/Q from other cases. Independent expert judges ideally two; disagreement adjudicated; measure paired change with match-cluster CI plus severe-error rate and per-category results. No GO solely from proxy, sample size or agreement. Actual LLM answers and paired independent language quality evaluation remain pending; ChatGPT Plus does not provide a bulk programmable model endpoint. No paid LLM service used. Keep the final 20-half-game corpus unopened until a candidate and evaluation protocol are frozen; if opened for rule testing, use a fresh language holdout. 
