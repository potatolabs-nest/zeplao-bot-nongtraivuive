#!/usr/bin/env bash
# Đưa con bot lên máy chủ như một service của riêng nó.
#
#   deploy/deploy-bot.sh
#
# Tách khỏi mọi thứ deploy API, cố ý. Một bot là client của API công khai: nó không chia phần nào
# của lần chuyển giao blue-green, không ai đợi nó, và một lần deploy API không khởi động lại nó
# cũng không bị nó làm chậm. Sự tách biệt ấy là toàn bộ lý do nó được deploy chứ không chỉ được
# viết ra.
#
# Token nằm ở /opt/zeplao/farmbot/.env trên máy chủ và không bao giờ nằm trong git. Tạo một con bot
# ở https://kuku.vn/bot rồi ghi vào đó một lần:
#
#   ZEPLAO_BOT_TOKEN=<token>
set -euo pipefail

BOT=farmbot
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Máy chủ ở đâu, và tới đó bằng cách nào. Không có giá trị mặc định, cố ý: địa chỉ kèm cổng là một
# cánh cửa người khác gõ được, và một file deploy công khai thì không phải chỗ để đăng nó.
#
#   ZEPLAO_HOST=root@<địa chỉ>
#   ZEPLAO_SSH_PORT=<cổng>
#   ZEPLAO_SSH_KEY=~/.ssh/<khoá>
[ -f "$ROOT/deploy/.env" ] && . "$ROOT/deploy/.env"

SSH_KEY=${ZEPLAO_SSH_KEY:?đặt nó trong deploy/.env}
SSH_PORT=${ZEPLAO_SSH_PORT:?đặt nó trong deploy/.env}
HOST=${ZEPLAO_HOST:?đặt nó trong deploy/.env}
SSH_KEY=${SSH_KEY/#\~/$HOME}

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
remote() { ssh -i "$SSH_KEY" -p "$SSH_PORT" "$HOST" "$@"; }

step "luật và luồng"
( cd "$ROOT/bots/$BOT" && npm test --silent )

step "bảng kiểu"
node "$ROOT/tools/css-check.mjs"

# Khung phải **chạy được**, không chỉ tải về được.
#
# Mọi phép kiểm khác chỉ hỏi "file có tới nơi không", mà một cái khung trắng thì không cần file nào
# biến mất cả: một file trả về `200` mà thân rỗng, hay hai file khai trùng một cái tên, cũng cho ra
# đúng kết quả ấy — trang chết ở giữa dây, im lặng. Cách duy nhất từng phát hiện ra nó là có người
# mở trò chơi lên rồi nhắn "trắng bóc".
step "khung chạy thật"
if node "$ROOT/tools/widget-selftest.mjs"; then
  :
else
  code=$?
  # Không có Chrome (2) thì nói to rồi đi tiếp — không thể bắt mọi cái máy phải có trình duyệt.
  # Trang hỏng thật (1) thì dừng: đi tiếp lúc này là đẩy một cái khung trắng ra cho người chơi.
  if [ "$code" = 2 ]; then
    echo "CHƯA THỬ ĐƯỢC khung — không chạy được trình duyệt trên máy này" >&2
  else
    echo "khung KHÔNG CHẠY — dừng trước khi upload" >&2
    exit 1
  fi
fi

step "upload"
# data/ là của con bot và sống qua mọi lần deploy. Tạo ở đây chứ không để con bot tự tạo: một
# container không tạo được bind mount của chính nó.
remote "mkdir -p /opt/zeplao/$BOT/data"

# Nông trại, trước khi chạm vào bất cứ thứ gì.
#
# Đây là thứ duy nhất ở đó không dựng lại được từ mã nguồn: ai có bao nhiêu tiền, ai đã trồng gì,
# ai nuôi gì. Mọi file khác trên máy chủ ấy là bản sao của một file trong git. Một bản sao kèm ngày
# tháng không tốn gì, và là khác biệt giữa một lần deploy hỏng và một buổi chiều hỏng.
remote "mkdir -p /opt/zeplao/backup
  if [ -f /opt/zeplao/$BOT/data/farms.json ]; then
    cp -a /opt/zeplao/$BOT/data/farms.json \
      /opt/zeplao/backup/$BOT-farms-\$(date +%Y%m%d-%H%M%S).json
    ls -t /opt/zeplao/backup/$BOT-farms-*.json | tail -n +31 | xargs -r rm --
    echo \"nông trại: \$(wc -c < /opt/zeplao/$BOT/data/farms.json) byte, đã sao lưu\"
  fi"

# Mọi thứ con bot nhập, không phải một danh sách file.
#
# Bản đầu của bên bot bài chép hai file. Rồi luật dọn sang `rules/`, và một lần deploy chép điểm
# vào mà không chép thứ nó nhập sẽ để lại một con bot chạy tốt trên máy đã viết ra nó và chết trên
# máy chủ ở lần khởi động **kế tiếp** — có thể vài ngày sau, và lúc ấy nó trông giống đủ thứ trừ
# một lần deploy.
#
# **Không có `--delete`.** Nó từng ở đó một ngày và nó xoá mất token của con bot: `.env` sống trên
# máy chủ và không ở đâu khác, nên từ phía rsync nó là một file mà nguồn không có. Ở đây không cần
# xoá gì — một file thừa sót lại từ bản cũ thì vô hại, và cái giá của nó không là gì so với cái giá
# của việc xoá nhầm thứ chỉ máy chủ mới có.
rsync -a \
  --exclude 'widget/' --exclude 'node_modules/' --exclude '*.test.mjs' \
  --exclude 'data/' --exclude '.env' \
  -e "ssh -i $SSH_KEY -p $SSH_PORT" \
  "$ROOT/bots/$BOT/" "$HOST:/opt/zeplao/$BOT/"

# Thứ máy chủ sở hữu thì vẫn thuộc về nó. Kiểm chứ không đoán: lần deploy đã xoá mất token ấy báo
# thành công ở mọi bước nó có, và chỉ gục ba bước sau đó khi đọc một file không còn nữa.
remote "test -s /opt/zeplao/$BOT/.env || { echo 'MẤT .env — token của bot không còn'; exit 1; }
  test -d /opt/zeplao/$BOT/data || { echo 'MẤT data/ — nông trại không còn'; exit 1; }
  echo 'token và nông trại còn nguyên'"

step "unit"
scp -q -i "$SSH_KEY" -P "$SSH_PORT" \
  "$ROOT/deploy/zeplao-$BOT.service" \
  "$HOST:/etc/systemd/system/zeplao-$BOT.service"

# Khung, qua đúng cái endpoint mà bất kỳ tác giả nào cũng dùng từ máy của họ. Không có đường đi tắt
# bên trong, và một lần deploy dùng đường tắt là một lần deploy đang thử một thứ không ai khác làm
# được.
#
# **Trước khi restart, không phải sau.** Một phiên ghim đúng bản khung lúc nó được mở, cố ý: người
# viết tải bản mới lên giữa ván thì không được đổi cái bàn dưới bốn người đang chơi. Điều đó làm
# cho thứ tự ở đây chịu lực — làm ngược lại thì con bot mới lên và phát những cái khung ghim vào
# bản **cũ** trong suốt thời gian upload.
step "khung"
TOKEN=$(remote "grep -o 'ZEPLAO_BOT_TOKEN=.*' /opt/zeplao/$BOT/.env | cut -d= -f2-")
WIDGET_API=${ZEPLAO_WIDGET_API:-https://kuku.vn/api/bot}
ZIP=$(mktemp -t farm-widget-XXXXXX).zip
# Nén từ **bên trong** thư mục, và bỏ mọi file ẩn: máy chủ từ chối cả gói nếu có `.DS_Store`,
# `__MACOSX`, hay bất cứ tên nào bắt đầu bằng dấu chấm.
( cd "$ROOT/bots/$BOT/widget" && zip -qrX "$ZIP" . -x '.*' '*/.*' '__MACOSX/*' )

# Kiểm trước khi công bố: mọi phép kiểm một lần upload làm, và không công bố gì cả. Nó cũng trả lời
# gói này **thêm hay bớt** view nào so với bản đang chạy.
curl -sS --fail-with-body -o /tmp/farm-dry.json -X POST "$WIDGET_API/setWidget?dryRun=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/zip' \
  --data-binary "@$ZIP" || {
    echo "gói khung bị từ chối:" >&2
    cat /tmp/farm-dry.json >&2
    rm -f "$ZIP"
    exit 1
  }
node -e '
  const one = JSON.parse(require("node:fs").readFileSync("/tmp/farm-dry.json", "utf8"));
  console.log(`gói: ${one.files} file, ${one.bytes} byte`);
  if (one.wouldRefuse) { console.error("sẽ bị từ chối: " + one.wouldRefuse); process.exit(1); }
'

WIDGET_JSON=$(curl -sS --max-time 180 -X POST "$WIDGET_API/setWidget" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/zip' \
  --data-binary "@$ZIP")
rm -f "$ZIP"
echo "$WIDGET_JSON"

WIDGET_VERSION=$(node -e '
  const one = JSON.parse(process.argv[1]);
  if (!Number.isInteger(one.version)) process.exit(2);
  process.stdout.write(String(one.version));
' "$WIDGET_JSON")
BOT_ID=$(curl -sS --max-time 30 "$WIDGET_API/getMe" -H "Authorization: Bearer $TOKEN" \
  | node -e '
    const chunks = [];
    process.stdin.on("data", (one) => chunks.push(one));
    process.stdin.on("end", () => {
      const bot = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      process.stdout.write(String(bot.id));
    });
  ')

# Và mọi file phải đọc được từ **mọi** edge công khai, không chỉ từ cái vừa nhận upload.
#
# Một khung host thì bất biến, nhưng chỉ khi mọi edge công khai đọc được mọi file của bản mà API
# vừa công bố. Nếu một máy có metadata mà chưa có file, một số trình duyệt bị ghim vào một bản trả
# 404 và cái khung mở ra trắng.
step "file khung"
FARM_FILES="index.html style.css zeplao.js draw.js farm.js"
for round in 1 2 3; do
  for host in https://kuku.vn https://api-bot.kuku.vn; do
    for file in "" "/" $FARM_FILES; do
      url="$host/api/widgets/$BOT_ID/$WIDGET_VERSION/$file"
      code=$(curl -L -sS -o /dev/null -w '%{http_code}' \
        --connect-timeout 10 --max-time 25 --retry 2 --retry-delay 2 \
        -H 'Cache-Control: no-cache' \
        -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0' \
        "$url")
      if [ "$code" != 200 ]; then
        echo "file khung thiếu sau khi upload: $code $url" >&2
        exit 1
      fi
    done
  done
done
echo "khung v$WIDGET_VERSION đọc được từ mọi host công khai"

# Và bản **đã upload** phải chạy thật, không phải bản trên máy này.
step "khung đã upload chạy thật"
if node "$ROOT/tools/widget-selftest.mjs" --live "$BOT_ID" "$WIDGET_VERSION"; then
  :
else
  code=$?
  if [ "$code" = 2 ]; then
    echo "CHƯA THỬ ĐƯỢC bản v$WIDGET_VERSION — không chạy được self-test" >&2
  else
    echo "bản v$WIDGET_VERSION KHÔNG CHẠY — dừng trước khi restart bot" >&2
    exit 1
  fi
fi

step "khởi động"
remote "if [ ! -f /opt/zeplao/$BOT/.env ]; then
  echo 'không có token ở /opt/zeplao/$BOT/.env — tạo bot ở https://kuku.vn/bot rồi ghi:'
  echo '  ZEPLAO_BOT_TOKEN=<token>'
  exit 3
fi
chmod 600 /opt/zeplao/$BOT/.env
docker pull -q node:22-alpine >/dev/null
systemctl daemon-reload
# Bật nhưng **không** khởi động ở đây. \`--now\` khởi động nó, và lệnh restart ở dòng sau đua với
# cái container nó vừa tạo — docker từ chối cái tên, systemd ghi một dòng failure, và năm giây sau
# mọi thứ lên bình thường. Một lệnh deploy **lần nào cũng fail một lần** là một lệnh deploy mà
# không ai đọc log nữa. \`restart\` tự khởi động một unit đang tắt, nên đây là toàn bộ việc ấy.
systemctl enable zeplao-$BOT >/dev/null 2>&1
systemctl restart zeplao-$BOT
sleep 6
systemctl is-active zeplao-$BOT"

# Và nông trại vẫn ghi được từ **bên trong** container.
#
# Chỉ-đọc ở phần mã và ghi được ở `data/` là hai cái mount chồng lên nhau, và chồng ngược chiều thì
# được một con bot chạy ngon, trồng cây, trả tiền — rồi mất sạch mọi thứ đã trả ngay khi restart.
# Không có gì trong chuyện đó hiện ra ở một dòng log cho tới lúc có người thấy vườn mình đi lùi.
# Kiểm bằng một dòng, sau mỗi lần khởi động, vì nó tốn đúng một dòng.
step "nông trại ghi được"
remote "docker exec zeplao-$BOT sh -c 'touch /app/data/.probe && rm /app/data/.probe' \
    || { echo 'NÔNG TRẠI KHÔNG GHI ĐƯỢC — mount sai chiều'; exit 1; }
  echo 'nông trại ghi được'"

step "kiểm"
# Con bot tự nói gì lúc khởi động, đọc lại bằng chính token của nó. Bất cứ gì khác là token sai.
remote "journalctl -u zeplao-$BOT -n 5 --no-pager | tail -3"
