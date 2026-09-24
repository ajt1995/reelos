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

`Native-Seek-Colors-12s.mp4` is a second synthetic fixture: red from 0–4 seconds,
green from 4–8, blue from 8–12. The restart test checks actual native pixels at 6 seconds,
not merely a player clock that may have accepted a seek request before decoding it.
It also retains and retires the previous player around a drawable swap.

```text
ffmpeg -f lavfi -i color=c=red:s=320x180:r=10:d=4 -f lavfi -i color=c=lime:s=320x180:r=10:d=4 -f lavfi -i color=c=blue:s=320x180:r=10:d=4 -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]" -map "[v]" -c:v libx264 -preset ultrafast -g 10 -pix_fmt yuv420p Native-Seek-Colors-12s.mp4
```

SHA-256: `964818c84724c72b944d674783975e50ef51d1aec6b81b6df2da9fc133ce5950`.
Both files remain desktop test assets, never consumer catalog/media.

The pixel suite also reuses Android's `Native-Tracks-30s.mp4` to verify paused
replacement after real audio/subtitle track restoration. A successful clock/track
assertion on a hidden drawable does not substitute for visible decoded pixels.
