# AllStays — `discovery_only`, `license_required`

**Nothing from AllStays has been fetched, downloaded, scraped or copied.** Their
host is blocked at this environment's egress proxy in any case (403 CONNECT),
but the restriction here is deliberate and would apply on an open network too.

---

## Registration

| Field | Value |
|---|---|
| `source_id` | `allstays` |
| `classification` | **`discovery_only`** |
| `license_status` | **`license_required`** |
| `authorization` | **NOT HELD** |
| May be used as a source of record | **No** |
| May be scraped | **No** |
| Paid PDF may be purchased for reuse | **No** |

## What `discovery_only` means, precisely

AllStays may inform **which questions to ask an authoritative source**. It may
never supply a value that lands in the directory.

**Permitted** — only after a license is in place, and even then only as a
pointer:

- Knowing that an independent truck stop *appears to exist* near a given exit,
  so an official state DOT or operator source can be asked about it.

**Forbidden, license or not:**

- Copying **names**, **coordinates**, **parking counts**, **amenities**,
  **hours**, **directions** or **descriptions**.
- Reproducing their **exclusive locations** — sites that appear in their
  inventory and nowhere authoritative. Those are the product.
- **Scraping** the site, its map endpoints, or its mobile app APIs.
- **Purchasing the paid PDF to extract data from it.** Buying a product does not
  license redistribution of its contents.
- Treating an AllStays listing as evidence that truck parking is permitted
  anywhere.

## Why it is registered at all

Independent truck stops are the one category with no national operator export.
Love's, Pilot and TA each publish their own network; nobody publishes the
independents. AllStays has spent years assembling exactly that, which makes them
a plausible **licensing partner** and an implausible free source.

Registering them as `discovery_only` makes the boundary explicit rather than
leaving it to judgement in the moment.

## Route to legitimate use

A structured, licensed feed with redistribution and update rights — see
`LICENSING-REQUEST.md`. Until such an agreement exists in writing, this source
contributes **nothing** to any gate line, and no gate percentage may count a row
that came from it.
