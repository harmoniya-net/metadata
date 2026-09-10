# metadata

A plain Mojang `version.json` for every published Forge and NeoForge build,
served from this repository's GitHub Pages site.

**No installer, ever.** A launcher never downloads one, never runs one, never
reads an install profile, and needs no idea that Forge exists. If it can read a
Mojang version JSON, it can launch every Forge and NeoForge build ever
published — a 2012 jar mod exactly as a 2025 processor build.

Resolve a build against the index, fetch its document, and treat it like any
other version JSON: resolve `inheritsFrom` against Mojang's, download the
libraries, start `mainClass`. That is the whole integration.

## Where things are

```
https://harmoniya-net.github.io/metadata/
  forge/
    index.json                          every Minecraft version and its builds
    versions/<mc>/<build>.json          one build's document
    versions/<mc>/latest.json
    versions/<mc>/recommended.json
    versions/<mc>/best.json             recommended if there is one, else latest
    skipped.json                        builds that produced nothing, with the reason

  neoforge/                             the same five
```

An index entry:

```json
{
  "versions": {
    "1.20.1": {
      "latest": "1.20.1-47.4.10",
      "latestUrl": "…/forge/versions/1.20.1/1.20.1-47.4.10.json",
      "recommended": "1.20.1-47.4.10",
      "recommendedUrl": "…",
      "best": "1.20.1-47.4.10",
      "bestUrl": "…",
      "builds": [{ "build": "1.20.1-47.4.10", "url": "…" }]
    }
  }
}
```

Both families are laid out and spelled identically; only the addresses differ.

NeoForge publishes no promotions, so its index decides for itself: `latest` is
the newest build, `recommended` the newest whose version carries no qualifier.

## horno

The work an installer would have done still has to happen somewhere, and that
somewhere is [horno](https://github.com/harmoniya-net/horno) — it fetches the
installer where there is one and runs its processors, and rewrites the client
jar where there is not.

Which is a detail, because horno arrives the way everything else does: builds
that need it name it as their `mainClass` and list it among their libraries.
Fetch what the document lists and start what it says, and the rest happens on
the way into the game.

`forge/versions/1.20.1/1.20.1-47.4.10.json`, trimmed to the parts that are not
an ordinary version JSON:

```json
{
  "id": "1.20.1-forge-47.4.10",
  "inheritsFrom": "1.20.1",
  "mainClass": "net.harmoniya.horno.Main",
  "arguments": {
    "jvm": [
      "-Dhorno.librariesDir=${library_directory}",
      "-Dhorno.installer=${library_directory}/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar",
      "-Dhorno.installerUrl=https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar",
      "-Dhorno.installerSha1=66bfea9963bfa60d88bab6b2750e74a958392715",
      "-Dhorno.minecraft=${library_directory}/com/mojang/minecraft/1.20.1/minecraft-1.20.1-client.jar"
    ]
  },
  "libraries": [
    { "name": "net.harmoniya:horno:0.1.0", "downloads": { "artifact": {
      "path": "net/harmoniya/horno/0.1.0/horno-0.1.0.jar",
      "url": "https://github.com/harmoniya-net/horno/releases/download/0.1.0/horno-0.1.0.jar",
      "sha1": "1aa0f0b2b75a5d376d0717da1fdc593db3c9430b",
      "size": 96275
    } } }
  ]
}
```

Thirty more libraries follow, all ordinary. The `-Dhorno.*` arguments are
horno's alone: a launcher passes them through with the rest of the JVM line and
never reads one. Note the installer among them — it is named there rather than
declared a library, because it is horno's input and has no business on the
game's classpath.

## Running it

```sh
node src/index.mjs                       # every Forge build
node src/index.mjs --mc 1.7.10           # one Minecraft version
node src/index.mjs --only 1.4.7-6.6.2.534

node src/neoforge-index.mjs              # every NeoForge build
node src/neoforge-index.mjs --mc 1.21.1
node src/neoforge-index.mjs --only 21.1.172

npm test
```

A sliced run (`--mc`, `--only`) writes documents only, leaving `index.json` and
the aliases alone: one build is no evidence about which is newest.

| | |
|---|---|
| `HORNO_TAG` | the horno release the documents name |
| `HORNO_JAR` | a local jar to hash instead, for runs made before that release exists |
| `SITE_BASE` | the host the index's URLs are absolute against |
| `CONCURRENCY` | parallel builds, default 12 |

Everything read is cached under `.cache/`, so only the first run pays for it.
