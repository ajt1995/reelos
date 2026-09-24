# Desktop caption validation fixture

`Native-Captions-10s.mkv` is generated synthetic black video with the existing test-only English
SubRip cue. No real title, downloaded media or live catalog entry is involved. It isolates glyph
pixels from moving video colors for actual native-renderer screenshot comparisons.

Generated with the already installed FFmpeg:

```text
ffmpeg -f lavfi -i color=c=black:s=640x360:r=10:d=10 -i clients/native/android/src/androidTest/assets/track-en.srt -map 0:v -map 1:s -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:s srt -t 10 Native-Captions-10s.mkv
```

This fixture proves only the tested plain-text subtitle renderer behavior, not bitmap/ASS styles,
remote sources, UI controls, audio quality, or a whole-film playback session.
