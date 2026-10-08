# Files served as they are

Everything else on the site is generated. What is here is copied in beside it.

## `fmllibs/`

Two files Forge for Minecraft 1.5 and 1.5.1 fetches into `<game dir>/lib` on
first run, from a host — `files.minecraftforge.net/fmllibs` — that has
answered 404 for years:

| file | sha1 | builds |
|---|---|---|
| `deobfuscation_data_1.5.1.zip` | `22e221a0d89516c1f721d6cab056a7e37471d0a6` | 68 |
| `deobfuscation_data_1.5.zip` | `5f7c142d53776f16304c0bbe10542014abad6af8` | 26 |

Each build names the sha1 it wants in its own `fmlversion.properties`, and
these hash to it. They came out of the Internet Archive:

    https://web.archive.org/web/2016id_/http://files.minecraftforge.net/fmllibs/deobfuscation_data_1.5.1.zip
    https://web.archive.org/web/2014id_/http://files.minecraftforge.net/fmllibs/deobfuscation_data_1.5.zip

They are mirrored rather than pointed at because there is nothing to point
at: this is generated mapping data, not a published artifact, so no maven has
it, and nothing else carries the same bytes. Every launcher that still starts
this era serves its own copy for the same reason. horno fetches them from
here and checks the hash.

The rest of what that era fetches is on Maven Central or Forge's own maven,
and horno takes it from there.
