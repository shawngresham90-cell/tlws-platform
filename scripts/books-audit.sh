#!/usr/bin/env bash
# Books audit (network step, runs on a GitHub Actions runner — the build
# sandbox cannot reach Amazon). For each owner-supplied a.co short link and
# each ASIN already on the site: resolve the redirect chain, capture the final
# Amazon URL, pull the page <title> and product image URL, and download the
# cover JPG. Everything lands in data/books-audit/ + public/covers-raw/ as
# plain committed files for human review. Read-only against Amazon; touches
# repo files only. Never writes to any database or deploys anything.
set -uo pipefail

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
OUT="data/books-audit"
COVERS="public/covers-raw"
mkdir -p "$OUT" "$COVERS"

# label|url  (a.co links exactly as the owner sent them; dp URLs for ASINs
# already shipped on /books so their links + covers get verified too)
REFS=(
  "owner-link-0bWGALX2|https://a.co/d/0bWGALX2"
  "owner-link-03d0iojz|https://a.co/d/03d0iojz"
  "site-carnivore-03cOB4V3|https://a.co/d/03cOB4V3"
  "site-dot-B0FDL26V8Q|https://www.amazon.com/dp/B0FDL26V8Q"
  "site-defensive-B0FHQPQ3QR|https://www.amazon.com/dp/B0FHQPQ3QR"
  "site-discipline-B0FK3XQL5S|https://www.amazon.com/dp/B0FK3XQL5S"
)

json="$OUT/audit.json"
md="$OUT/audit.md"
echo "[" > "$json"
{
  echo "# Amazon books audit — raw results"
  echo
  echo "Resolved on a GitHub Actions runner ($(date -u +%Y-%m-%dT%H:%MZ)). Each"
  echo "entry: the URL as supplied, the final resolved Amazon URL, the page"
  echo "title Amazon served, and whether a cover image was captured."
  echo
} > "$md"

first=1
for ref in "${REFS[@]}"; do
  label="${ref%%|*}"
  url="${ref#*|}"
  page="/tmp/page-$label.html"

  final=$(curl -sL --max-redirs 10 --max-time 45 -A "$UA" \
    -H "Accept-Language: en-US,en;q=0.9" \
    -o "$page" -w '%{url_effective}' "$url" || echo "FETCH-FAILED")
  status="ok"
  [ "$final" = "FETCH-FAILED" ] && status="fetch-failed"

  title=""
  image=""
  if [ -s "$page" ]; then
    title=$(sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' "$page" | head -1 | cut -c1-300)
    case "$title" in
      *"Robot Check"*|*"captcha"*|*"Sorry"*) status="bot-blocked" ;;
    esac
    # Product image: prefer data-old-hires, then hiRes, then og:image.
    image=$(grep -o 'data-old-hires="[^"]*"' "$page" | head -1 | sed 's/data-old-hires="//;s/"$//')
    [ -z "$image" ] && image=$(grep -o '"hiRes":"[^"]*"' "$page" | head -1 | sed 's/"hiRes":"//;s/"$//')
    [ -z "$image" ] && image=$(grep -o 'property="og:image" content="[^"]*"' "$page" | head -1 | sed 's/.*content="//;s/"$//')
  fi

  cover=""
  if [ -n "$image" ]; then
    if curl -sL --max-time 45 -A "$UA" -o "$COVERS/$label.jpg" "$image" \
      && [ "$(stat -c%s "$COVERS/$label.jpg" 2>/dev/null || echo 0)" -gt 5000 ]; then
      cover="$COVERS/$label.jpg"
    else
      rm -f "$COVERS/$label.jpg"
    fi
  fi

  [ $first -eq 0 ] && echo "," >> "$json"
  first=0
  python3 - "$label" "$url" "$final" "$status" "$title" "$image" "$cover" >> "$json" <<'PY'
import json, sys
label, url, final, status, title, image, cover = sys.argv[1:8]
print(json.dumps({"label": label, "suppliedUrl": url, "finalUrl": final,
                  "status": status, "pageTitle": title, "imageUrl": image,
                  "coverFile": cover}, indent=1), end="")
PY

  {
    echo "## $label"
    echo
    echo "- supplied: \`$url\`"
    echo "- resolved: \`$final\`"
    echo "- status: $status"
    echo "- page title: $title"
    echo "- cover: ${cover:-not captured}"
    echo
  } >> "$md"

  sleep 3  # politeness between requests
done
echo "" >> "$json"
echo "]" >> "$json"

# ---- Cover images via the Amazon Associates image widget -------------------
# Product-page scraping gets bot-walled on datacenter IPs, but the SiteStripe
# image widget is DESIGNED for direct embedding: it 302s to the book's real
# m.media-amazon.com cover by ASIN. One request per book, saved as a repo
# file for human review before anything is wired into the site.
ASINS=(
  "truckers-carnivore-cookbook|B0F9TT5S6G"
  "dot-survival-guide|B0FDL26V8Q"
  "defensive-driving-for-truck-drivers|B0FHQPQ3QR"
  "discipline-over-everything|B0FK3XQL5S"
  "broken-but-built|B0FLPJ4PVM"
  "meth-is-the-devils-poison|B0FW74VQNT"
)
{
  echo "## Cover fetch (Associates image widget)"
  echo
} >> "$md"
for entry in "${ASINS[@]}"; do
  slug="${entry%%|*}"
  asin="${entry#*|}"
  wurl="https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=$asin&Format=_SL800_&ID=AsinImage&MarketPlace=US&ServiceVersion=20070822&WS=1&tag=truckinglif0d-20"
  out="$COVERS/$slug.jpg"
  curl -sL --max-time 45 -A "$UA" -o "$out" "$wurl" || true
  bytes=$(stat -c%s "$out" 2>/dev/null || echo 0)
  kind=$(file -b "$out" 2>/dev/null || echo unknown)
  # The widget returns a tiny GIF spacer when it has nothing — keep real JPEGs only.
  if [ "$bytes" -gt 5000 ] && printf '%s' "$kind" | grep -qi 'JPEG'; then
    echo "- $slug ($asin): OK — $bytes bytes, $kind" >> "$md"
  else
    rm -f "$out"
    echo "- $slug ($asin): NOT USABLE — $bytes bytes, $kind" >> "$md"
  fi
  sleep 2
done

echo "wrote $json, $md; covers in $COVERS/"
