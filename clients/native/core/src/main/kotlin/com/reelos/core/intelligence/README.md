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

This module is not yet connected to core events, storage, or native UI.
