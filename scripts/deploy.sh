#!/usr/bin/env bash
#
# Deploy to the production VPS.
#
#   ./scripts/deploy.sh
#
# Builds locally and ships the result, because the host shares 1.8 GB of RAM
# with nine other applications and a Vite build there risks taking the box into
# swap. Dependency installs and migrations only run when something actually
# changed, so a code-only deploy stays quick.
#
# Config and theme extension changes are NOT covered here -- those live in
# Shopify, not on the server. Run `shopify app deploy` for them.

set -euo pipefail

HOST=volera
APP_DIR=/home/huseyin/wallifyig-app
APP_USER=huseyin
PM2_APP=wallifyig
BRANCH=main
URL=https://wallifyig.app

step() { printf "\n\033[1m==> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[31mdurduruldu:\033[0m %s\n" "$1" >&2; exit 1; }

# Run PM2 as the user that owns the daemon holding this app.
remote_pm2() { ssh "$HOST" "sudo -u $APP_USER -H env HOME=/home/$APP_USER pm2 $*"; }

# ---- preflight -------------------------------------------------------------
step "Ön kontrol"

[ -n "$(git status --porcelain)" ] && fail "çalışma alanı temiz değil; commit'le veya stash'le"

current_branch=$(git rev-parse --abbrev-ref HEAD)
[ "$current_branch" = "$BRANCH" ] || fail "$BRANCH üzerinde değilsin (şu an: $current_branch)"

git fetch -q origin "$BRANCH"
# The server pulls from origin, so anything unpushed would not ship.
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] \
  || fail "lokal $BRANCH origin ile aynı değil; önce 'git push' yap"

echo "  $BRANCH @ $(git rev-parse --short HEAD), origin ile senkron"

# ---- build -----------------------------------------------------------------
step "Lokalde build"
npm run build >/dev/null
[ -f build/server/index.js ] || fail "build/server/index.js üretilmedi"
echo "  build hazır ($(du -sh build | cut -f1))"

# ---- ship the build --------------------------------------------------------
step "Build'i sunucuya gönder"
# --stats is parsed rather than decorative: an rsync that silently transfers
# nothing leaves the previous build serving, and the directory listing
# afterwards looks identical either way.
transferred=$(rsync -az --delete --stats build/ "$HOST:$APP_DIR/build/" \
  | awk '/Number of regular files transferred|Number of files transferred/ {print $NF; exit}')
echo "  transfer edilen dosya: ${transferred:-0}"

local_hash=$(shasum -a 256 build/server/index.js | cut -d' ' -f1)
remote_hash=$(ssh "$HOST" "sha256sum $APP_DIR/build/server/index.js | cut -d' ' -f1")
[ "$local_hash" = "$remote_hash" ] || fail "sunucudaki build lokalle eşleşmiyor (rsync başarısız)"
echo "  hash doğrulandı"

# ---- source, dependencies, schema -----------------------------------------
step "Sunucuda kaynak ve bağımlılıklar"
ssh "$HOST" "bash -euo pipefail -s" <<REMOTE
cd "$APP_DIR"

before_lock=\$(git rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
before_migrations=\$(git rev-parse HEAD:prisma/migrations 2>/dev/null || echo none)

sudo -u $APP_USER git fetch -q origin $BRANCH
sudo -u $APP_USER git merge --ff-only origin/$BRANCH >/dev/null
echo "  kod: \$(git rev-parse --short HEAD)"

after_lock=\$(git rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
after_migrations=\$(git rev-parse HEAD:prisma/migrations 2>/dev/null || echo none)

if [ "\$before_lock" != "\$after_lock" ]; then
  echo "  bağımlılıklar değişti -> npm ci"
  sudo -u $APP_USER npm ci --omit=dev >/dev/null
else
  echo "  bağımlılıklar değişmedi, atlandı"
fi

# Cheap, and required whenever the schema or the client version moved.
sudo -u $APP_USER npx prisma generate >/dev/null 2>&1
echo "  prisma client üretildi"

if [ "\$before_migrations" != "\$after_migrations" ]; then
  echo "  yeni migration var -> migrate deploy"
  sudo -u $APP_USER npx prisma migrate deploy 2>&1 | grep -E "Applying|successfully|No pending" | sed 's/^/    /'
else
  echo "  yeni migration yok, atlandı"
fi

chown -R $APP_USER:$APP_USER build
REMOTE

# ---- restart ---------------------------------------------------------------
step "Yeniden başlat"
remote_pm2 restart "$PM2_APP" --update-env >/dev/null
remote_pm2 save >/dev/null
echo "  pm2 restart edildi"

# ---- verify ----------------------------------------------------------------
step "Doğrulama"
# Give the server a moment to bind its port before judging it.
for _ in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL/" || echo 000)
  [ "$code" = "200" ] && break
  sleep 1
done

status=$(remote_pm2 describe "$PM2_APP" | awk -F'│' '/status/ {gsub(/ /,"",$3); print $3; exit}')
errlog=$(ssh "$HOST" "f=\$(sudo -u $APP_USER -H env HOME=/home/$APP_USER pm2 describe $PM2_APP | awk -F'│' '/error log path/ {gsub(/ /,\"\",\$3); print \$3; exit}'); wc -c < \"\$f\" 2>/dev/null || echo 0")

echo "  $URL/ -> HTTP $code"
echo "  pm2 durumu -> $status"
echo "  hata log -> ${errlog} byte"

if [ "$code" != "200" ] || [ "$status" != "online" ]; then
  echo
  echo "  son hata log satırları:"
  remote_pm2 logs "$PM2_APP" --err --lines 15 --nostream 2>/dev/null | sed 's/^/    /' || true
  fail "deploy sağlıksız; yukarıdaki log'a bak. Geri almak için: git revert + tekrar deploy"
fi

printf "\n\033[32mdeploy tamam\033[0m\n"
