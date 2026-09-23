# Local learning boundary

`LocalLearning` is a bounded, profile-local preference learner. `observe` uses
regularized stochastic-gradient user/item factors; `observeArm` uses a separate
five-value contextual LinUCB bandit with Sherman–Morrison rank-one covariance
inverse maintenance. A caller supplies `LearningGate` from the platform resource
governor and cancellation state. A false decision makes the update a no-op.
State is memory-only until a caller durably stores each profile's typed
`ProfileLearningSnapshot` and restores it. No network or model download occurs.

`LearnedEmbedding` validates actual supplied 512-value Float32 vectors and
their model identity, version, and provenance. It does not make vectors,
encode queries, or equate matrix-factorization coordinates with semantic
embeddings. A null cosine result means the model space cannot be compared.

`ReelCore.rankedHomeMedia` now calls `NativeTasteCoordinator`; the shared native
presentation consumes that ordering. Reactions are durably saved by CoreStore, then
bounded factors are replayed deterministically from the latest snapshot. Reset and
neutral Dismiss remove earlier feedback; Library and explicit search retain all titles.
This ranks rated/exact-seed items only, not semantic recommendations for unseen titles.
The default gate only checks interruption and JVM heap headroom. Full device-governor,
event/feature-spine and production encoder integration remain required work.
