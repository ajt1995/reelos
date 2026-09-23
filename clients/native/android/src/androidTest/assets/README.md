# Physical test fixture only

`Native-Validation-30s.mp4` is generated locally with the already-installed FFmpeg:

`ffmpeg -f lavfi -i testsrc2=duration=30:size=640x360:rate=24 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart Native-Validation-30s.mp4`

SHA-256: `f3f1bd4b7aac8bb37b423013c2d983c0d793282ec60ed944d56c4b91e92bcd58`.
It contains test patterns, no personal data, and no audio. The invalid fixture is plain text.
The test-only `mutable` content URI serves valid video for its first two opens, then the
invalid fixture. This checks that import validates retained private bytes rather than
trusting an earlier open of a changing provider.
Both belong exclusively to the instrumentation test APK, never the application catalog or release APK.
This checks real local decoder output/seek/resume, not catalog correctness, subtitles, audio, or sustained movie playback.
