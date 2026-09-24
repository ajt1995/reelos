# Physical test fixture only

`Native-Validation-30s.mp4` is generated locally with the already-installed FFmpeg:

`ffmpeg -f lavfi -i testsrc2=duration=30:size=640x360:rate=24 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart Native-Validation-30s.mp4`

`Native-Tracks-30s.mp4` reuses that synthetic video with two AAC sine tracks and two embedded
mov_text caption tracks. English/Spanish are track labels, not speech or translation evaluation.
Sine levels are reduced to 0.005 before encoding. This is test-APK-only media, never a live catalog.
Reproduce with the installed FFmpeg:

```text
ffmpeg -i Native-Validation-30s.mp4 -f lavfi -i sine=frequency=440:duration=30 -f lavfi -i sine=frequency=660:duration=30 -i track-en.srt -i track-es.srt -map 0:v:0 -map 1:a:0 -map 2:a:0 -map 3:s:0 -map 4:s:0 -c:v copy -c:a aac -b:a 32k -filter:a volume=0.005 -c:s mov_text -metadata:s:a:0 language=eng -metadata:s:a:1 language=spa -metadata:s:s:0 language=eng -metadata:s:s:1 language=spa -disposition:s:0 0 -disposition:s:1 0 -movflags +faststart -t 30 Native-Tracks-30s.mp4
```

SHA-256: `f3f1bd4b7aac8bb37b423013c2d983c0d793282ec60ed944d56c4b91e92bcd58`.
It contains test patterns, no personal data, and no audio. The invalid fixture is plain text.
The test-only `mutable` content URI serves valid video for its first two opens, then the
invalid fixture. This checks that import validates retained private bytes rather than
trusting an earlier open of a changing provider.
Both belong exclusively to the instrumentation test APK, never the application catalog or release APK.
This checks real local decoder output/seek/resume, not catalog correctness, subtitles, audio, or sustained movie playback.
