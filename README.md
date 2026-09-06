# ReelOS

Install. Point. Stream.

A Linux disc that turns a spare computer into a house media server.
Boot it, answer a few questions, request titles in the ReelOS page,
watch them in Jellyfin or Plex.

This repo is the source and the update channel. The ISO is too big for GitHub.
If you are cutting a disc:

```
node iso/pack-appliance.mjs
bash iso/remaster-iso.sh
```

Do not commit the ISO.

No API keys in the tree. Indexers are not included — you add your own.

Default login after install: `reelos` / `reelos`. Change it.
