# zeplao-bot-nongtraivuive

Một con bot cho [Cúc Cu](https://kuku.vn): **nông trại**. Trồng cây, tưới nước, hái quả, nuôi vật
trong bãi chăn, và ghé vườn hàng xóm hái trộm.

Gõ `/nongtrai` trong một nhóm và một khu vườn mở ra trong một khung nổi trong cuộc trò chuyện.

**Đây là bản port của [QFarm 7.0](https://github.com/hieuck/qfarm)** — bản Trung Quốc của
*Happy Farm*, trò chơi nông trại trên Facebook một thời. Port chứ không phải phỏng theo: bảng cây,
bảng vật nuôi, đường cong kinh nghiệm và giá đất đều là **số của bản gốc**, lấy thẳng từ những file
cấu hình PHP trong `qfarm/`. Xem [Những con số đến từ đâu](#những-con-số-đến-từ-đâu).

## Hai điều đọc trước

### Cỏ là thời gian, không phải một bữa ăn

Đây là chỗ QFarm thật sự khác mọi trò nuôi thú khác, và nó đáng được chép lại.

Trong phần lớn trò chơi kiểu này, mỗi con vật có một cái đồng hồ riêng và một bữa ăn; cho ăn là
bấm một nút, và bấm nút ấy chỉ để tắt một biểu tượng đang nhấp nháy. Ở QFarm thì **cỏ là thời
gian**: cái máng giữ một số bó cỏ, mỗi con ăn một số bó mỗi bốn giờ, và cái máng ấy quyết định cả
bãi chăn lớn nhanh được bao nhiêu. Một cái máng đầy nuôi sáu con chạy đúng tốc độ; một cái máng cạn
thì cả bãi **đứng im** — và không con nào chết.

Đó là toàn bộ sự khác nhau giữa một trò chơi người ta dám rời đi và một trò chơi bắt người ta quay
lại. Người bỏ ba ngày vẫn về được, chỉ muộn ba ngày.

Hệ quả là một quyết định thật: **trồng cỏ hay mua cỏ**. Cỏ trồng tốn một thửa đất và 80 đồng cho 25
bó — 3,2 đồng một bó; cỏ mua là 60 đồng một bó. Một nông trại nuôi nhiều phải dành đất cho cỏ, và
dành bao nhiêu là tuỳ nó nuôi bao nhiêu. Không có đáp án đúng, chỉ có đáp án của từng người.

### Hái trộm không lấn vào phần sàn

Một người đi ngủ mà mất cả vụ mùa là một trò chơi chỉ có một chiến thuật: canh me lúc người khác
vắng mặt. Nên ba thứ chặn nó, cả ba đều của QFarm:

- **Sàn**: chủ ruộng giữ sáu phần mười vụ mùa, và không ai lấy được vào phần ấy.
- **Một lần một vụ, mỗi người**: một thửa đã bị bạn hái thì thôi. Mười người ghé qua không biến
  thành một cái máy hút.
- **Chó**: nhà ai đang có chó ăn thì chó cắn được, phạt 40–80 đồng, tiền về tay chủ nhà.

Và muốn đi hái trộm thì trong túi phải có ít nhất 300 đồng, **và mình phải đang trồng cây gì đó**.
Điều kiện thứ hai là điều kiện quan trọng: nó biến việc hái trộm từ một nghề thành một việc những
người trồng cây làm với nhau.

## Cái khung

Khung rộng chừng 390×640 trên điện thoại và không bao giờ chiếm cả màn hình, nên thứ nằm trong đó
là do quyết định chứ không phải xếp bừa rồi mong nó vừa:

| | |
| --- | --- |
| Trên | Ai đang nhìn, **cấp**, và **ví tiền** — ở mọi màn, từ khung hình đầu tiên. Dấu `+` cạnh ví là quà của ngày, và nó chỉ hiện khi có quà để nhận |
| Giữa | Một trong năm: khu vườn, bãi chăn, chợ (có cả túi để bán), hàng xóm, sổ. Hoặc một màn cho một thửa đất |
| Dưới | Năm tab, và **một chấm đỏ trên tab đang có việc** |

Vài thứ là như thế có chủ ý:

- **Một chấm đỏ trên tab đang có việc.** Nông trại là một trò chơi người ta mở ra để xem *có gì cần
  làm không*; nếu câu trả lời ấy phải tìm bằng cách bấm vào từng tab thì phần lớn những lần mở ra
  kết thúc bằng việc đóng lại.
- **Nút bị khoá phải nói vì sao**, và câu ấy đến từ **bot**, không từ trang. `Không thành bộ`,
  `Chưa chín`, `Cần cấp 5`. Một cái nút sáng rồi bấm không ra gì tệ hơn một cái nút tối có ghi lý do.
- **Chạm một thửa đang chín là hái luôn**, không đi qua màn của thửa ấy. Hái là việc làm nhiều nhất,
  và bắt người ta đi qua một màn nữa để hái là bắt họ đi qua một màn nữa mười tám lần một buổi.
- **Cây vẽ bằng SVG dựng ra**, không bằng ảnh. Một cái khung widget không gọi được ra ngoài — không
  CDN, không máy chủ nào, kể cả máy chủ của chính bot — nên hoặc là bốn mươi mốt cây nhân sáu giai
  đoạn ảnh, hoặc là một hàm từ số ra hình. Hàm thì cây **mọc thật sự**, và thêm một cây mới không
  cần thêm một tấm ảnh nào.

## Ba quyết định chịu lực

### Một người một khu vườn, không phải một phòng một khu vườn

Một phiên widget thuộc về **một cuộc trò chuyện**, và `showSession` từ chối mở phiên cho người
không ở trong cuộc trò chuyện ấy — đúng như vậy, nếu không thì bot nào cũng đẩy được màn hình của
phòng lạ lên trước mặt bất kỳ ai. Nhưng một khu vườn là thứ một người **sở hữu**: nó phải theo họ
từ nhóm này sang nhóm khác, chứ không phải biến mất khi họ đi làm việc ở chỗ khác.

Nên phiên thuộc về **người**, nằm trong phòng của chính người đó, và chỉ có **bức ảnh của khu vườn**
là đi theo. Một người ở năm nhóm vẫn chỉ có một khu vườn và một túi tiền.

Nó cũng xoá luôn `setSessionPlayers`: một phiên có đúng một người, là chủ của nó — nên `role` trên
mỗi hành động không nói lên điều gì, và mọi phép kiểm đều dựa vào **người gửi có phải chủ khung
không** chứ không dựa vào cái khung tự khai.

### Không ai nhận được trạng thái của người khác

`pushState` không có `to` đi tới mọi người đang mở khung; có `to` thì đi tới một người. Một khu
vườn là của một người — không có gì để cả phòng cùng nhìn — nên **mọi lần đẩy đều có `to`**.

Bên bot bài có một phép kiểm **đọc mã nguồn** để canh chuyện bài của người này lọt vào lần đẩy
chung. Ở đây không cần phép kiểm ấy, vì không có lần đẩy chung nào để lọt vào. Cái có là một phép
kiểm đọc thẳng **những gì đã đi qua dây** và đòi hỏi mọi lần đẩy đều có `to` đúng bằng chủ của
trạng thái trong đó.

### Trạng thái sống trên đĩa, không sống trong tiến trình

Bên bot bài thì ngược lại, và ngược lại có lý: một ván bài là một cuộc trò chuyện đang xảy ra, nên
một lần khởi động lại quên nó là **đúng**. Một khu vườn thì không — nó lớn lên trong lúc không ai
nhìn, và một cái cây trồng hôm qua mà hôm nay không còn nữa là một trò chơi hỏng.

Nên `farms.json` nằm trên đĩa, và cả trò chơi chỉ cần đọc hai con số — số cỏ trong máng, và nhịp
thật lần cuối đồng hồ được quay — rồi hỏi các hàm thuần xem từ đó tới giờ đã có gì xảy ra. Đóng
bot lại, mở lại ba ngày sau, và cái máng vẫn trả lời đúng.

Ghi thì ra file tạm rồi **đổi tên** vào chỗ: đổi tên là phép nguyên tử trên cùng một ổ đĩa, nên một
lần ghi bị cắt ngang — mất điện, bot bị giết — để lại file **cũ nguyên vẹn** chứ không phải một file
cụt.

## Một đồng hồ cho cả nông trại

Mỗi thửa đất **không** tự đếm lấy. Cả nông trại và cả bãi chăn nghe **một cái đồng hồ trò chơi**,
và lý do không phải tiết kiệm chỗ: mười tám thửa cùng nghe một cái đồng hồ thì **không thể lệch
nhau**. Mỗi thửa tự đếm lấy thì một lần bot khởi động lại giữa chừng, một lần đồng hồ máy đổi, hay
một lần ghi xuống đĩa hỏng đều để lại mười tám thửa lệch nhau vài giây — và cái lệch ấy không bao
giờ tự liền lại.

Có một phép kiểm cho đúng tính chất ấy: chia một quãng thời gian thành mười lần nhìn nhỏ phải cho
ra kết quả **y hệt** một lần nhìn to.

## Nó chạy nhanh hơn QFarm hai mươi lần

**Đây là chỗ duy nhất trong cả bản port mà một con số không phải của QFarm**, và nó là con số phải
chọn chứ không phải con số phải chép.

QFarm để cây cải củ mất mười tiếng và cây vải mất bảy mươi bảy. Nó làm được thế vì nó là một trò
chơi người ta mở **hai lần một ngày**: trồng buổi sáng, hái buổi tối. Một cái khung trong một nhóm
chat thì khác — người ta mở nó ra, nhìn thấy một cái cây, và cái cây ấy phải nói được điều gì đó
trong vòng vài phút, nếu không thì lần sau họ mở là để làm việc khác.

Hai mươi lần đặt cây ngắn nhất ở **hai mươi tư phút** và cây dài nhất ở **gần bốn tiếng**: đủ ngắn để
ngồi xem một cái cây lớn, đủ dài để rời đi rồi quay lại thì nó vẫn còn là một cái cây.

Mọi con số của QFarm vẫn nằm nguyên trong `catalogue.mjs` — phép chia xảy ra đúng một lần, ở một
chỗ. Ai muốn bản chậm thật thì đặt `FARM_SPEED=1` và không phải sửa một dòng luật nào.

Ba chỗ khác cố ý làm khác bản gốc, và cả ba đều được ghi ngay tại chỗ trong mã:

- **Cây lâu năm phải lớn lại rồi mới chín lần nữa.** Bản gốc đặt cờ chín ngay sau mỗi lần hái, tức
  là hái được liên tục không chờ gì — nhưng dòng `q = now - cropstime[2]` nằm ngay cạnh đó cho thấy
  ý định là *lớn lại từ mốc thứ ba*, và một dòng chạy trước đã nuốt mất ý định ấy. Ở đây làm theo
  ý định.
- **Cỏ dại và sâu bọ trừ thẳng một phần mười sản lượng mỗi thứ, trần một nửa.** Bản gốc cộng dồn
  theo thời gian từng hành động và cũng chặn ở một nửa. Cùng trần, một luật dễ nói hơn: nhìn vào
  thửa đất là biết mình sắp mất bao nhiêu.
- **"Một nửa" của một con vật là một nửa của thứ nó thật sự cho được, không phải một nửa của
  `output`.** Hai con số ấy không bằng nhau: một con gà có `output = 20` mà cả đời chỉ cho được tám
  phần. Bản gốc so với `output`, nên với con gà thì ngưỡng ấy **không bao giờ mở** — tính năng chết
  mà không có gì cho biết nó đã chết. Ở đây sức chứa được tính từ vòng đời và nhịp cho sản phẩm, và
  cùng con số ấy dùng cho cả cái thanh trong khung lẫn ngưỡng lấy trộm.
- **Khai đất gác bằng cả cấp lẫn tiền.** Bản gốc gác bằng cả hai, nhưng phép kiểm cấp ở đó so `exp`
  với một khoá tên là `exp` mà bảng ấy không có — nên trên thực tế chỉ tiền có tác dụng. Một cái
  gác hỏng trong bản gốc không phải lý do để viết lại một cái gác hỏng.

## Những con số đến từ đâu

`data-raw/` chứa bảng gốc, cào ra từ những file cấu hình PHP của QFarm 7.0 bằng
`tools/parse-php-data.mjs`. Hai file sinh ra mã nguồn từ đó, và **không file nào trong `rules/` được
sửa tay**:

```bash
node tools/gen-catalogue.mjs    # -> bots/farmbot/rules/catalogue.mjs
node tools/gen-animals.mjs      # -> bots/farmbot/rules/animals.mjs
```

Hai file ấy **không nằm trong git**: chúng dựng lại được từ `data-raw/` trong một phần nghìn giây,
nên để chúng trong kho là để hai bản sao của cùng một con số trôi khỏi nhau. `npm test` dựng chúng
trước khi chạy, nên một bản checkout mới chỉ cần `cd bots/farmbot && npm test` là đủ.

| Thứ | Từ đâu |
| --- | --- |
| Cấp, vòng sinh trưởng, năm mốc giai đoạn, số lần hái, sản lượng, giá hạt, giá bán, kinh nghiệm | `config/nc/cropstype.php` + `cropstime.php` |
| Đường cong kinh nghiệm (`exp để tới cấp L = 100·L·(L+1)`) | `source/common.func.php:qf_toLevel()` |
| Giá đất và cấp mở đất | `config/nc/upgrade.php`, `source/nc/mod/user_reclaim.php` |
| Giá vật nuôi, sức ăn, vòng đời, nhịp cho sản phẩm, sản lượng | `config/mc/animaltype.php` + `animaltime.php` |
| Số thửa lúc đầu, bốn bài học trên bốn thửa đầu tiên | `source/nc/user_init.php` |
| Bảng số quả hái trộm, sàn sáu phần mười, chó cắn 20%/40% | `source/nc/mod/farmlandstatus_scrounge.php` |
| Cỏ là thời gian; một phần mười kinh nghiệm khi cho ăn hộ | `source/mc/mod/cgi_feed_food.php` |
| Hạn mức 50 lần phá và 150 lần làm hộ mỗi ngày | `source/cron/daily.php` |
| Ngưỡng "hơn một nửa" khi lấy trộm sản phẩm, và 500 đồng vốn của kẻ trộm | `source/mc/mod/cgi_steal_product.php` |

Chỉ **tên** được đổi sang tiếng Việt — `白萝卜` thành `Củ cải trắng`. Một trang trại tiếng Việt ghi
`白萝卜` trên gói hạt thì không phải một bản port, mà là một bản sao.

Bảng cây bị **cắt từ 752 xuống 41**: bản gốc có bảy trăm loại cây vì nó chạy mười triệu người chơi
trong bảy năm, và phần lớn trong đó là cây sự kiện, cây trang trí và cây mùa. Bốn mươi mốt loại này
là những cây còn lại sau khi bỏ hoa, bỏ cây chỉ mở một lần, bỏ mọi thứ không mọc được ở một thửa
đất thường — và chúng trải đều từ cấp 0 tới cấp 27. Con số của từng cây trong đó thì nguyên vẹn.

## Bố cục

| | |
| --- | --- |
| `bots/farmbot/farmbot.mjs` | Phần nói chuyện: vòng lặp dài, phiên, ảnh chụp, sổ trên đĩa, ghé vườn hàng xóm |
| `bots/farmbot/rules/farm.mjs` | Thửa đất, cây, cỏ dại, hái trộm, đất, kinh nghiệm |
| `bots/farmbot/rules/ranch.mjs` | Bãi chăn: cỏ là thời gian, sản phẩm, chuột |
| `bots/farmbot/rules/catalogue.mjs` | Bốn mươi mốt cây — **sinh ra**, đừng sửa tay |
| `bots/farmbot/rules/animals.mjs` | Mười bốn con vật và hai loại chuồng — **sinh ra** |
| `bots/farmbot/widget/` | Trang trong khung: `index.html`, `style.css`, `draw.js`, `farm.js` |
| `bots/farmbot/farm.test.mjs` | Luật: cây mọc, cỏ trong máng, tiền |
| `bots/farmbot/flow.test.mjs` | Con bot, đầu-cuối, trước một bản đóng vai ứng dụng |
| `tools/parse-php-data.mjs` | Đọc bảng PHP của QFarm thành JSON |
| `tools/gen-catalogue.mjs`, `tools/gen-animals.mjs` | Sinh hai file bảng số |
| `tools/css-check.mjs` | Mọi id và class trang vẽ ra, đối chiếu với bảng kiểu |
| `tools/widget-selftest.mjs` | Mở khung trong một trình duyệt thật cho tới khi nó vẽ ra chữ |
| `deploy/` | Unit systemd và script đưa nó lên máy chủ |

Mọi module dưới `rules/` đều **thuần**: cây và số vào, cây và số ra, và không biết mạng là gì. Đó
là điều cho phép một luật được kiểm bằng một phép gọi hàm thay vì bằng một khu vườn đang chạy.

## Chạy nó

1. Tạo một bot ở [kuku.vn/bot](https://kuku.vn/bot) và chép token. Nó chỉ hiện một lần.
2. Tải khung lên — một con bot không có khung thì không mở được phiên nào cả:

   ```bash
   cd bots/farmbot/widget && zip -qrX /tmp/w.zip . -x '.*' '*/.*' '__MACOSX/*' && \
     curl -X POST https://api-bot.kuku.vn/setWidget \
       -H "Authorization: Bearer $ZEPLAO_BOT_TOKEN" \
       -H 'Content-Type: application/zip' --data-binary @/tmp/w.zip
   ```
3. `ZEPLAO_BOT_TOKEN=... node bots/farmbot/farmbot.mjs`
4. Trong một nhóm, thêm bot vào rồi gõ `/nongtrai`.

`ZEPLAO_BOT_API` trỏ nó vào chỗ khác ngoài production. `FARM_STORE` nói nông trại của mọi người
được giữ ở đâu (`/app/data/farms.json` mặc định, là đường dẫn bên trong container). `FARM_SPEED`
đặt tốc độ lớn lên — mặc định 20, đặt 1 để có bản chậm thật của QFarm.

## Bộ thử

```bash
cd bots/farmbot && npm test      # 69 phép kiểm, không mạng, khoảng ba giây
node tools/css-check.mjs         # trang vẽ ra có được tạo hình không
node tools/widget-selftest.mjs   # khung chạy thật trong một trình duyệt
```

Bộ thử thứ hai **chạy con bot thật** trước một bản đóng vai ứng dụng, và bản đóng vai ấy thực thi
đúng một luật mà cả thiết kế phiên dựa vào: một phiên chỉ mở được cho người ở trong cuộc trò
chuyện của nó. Không có luật ấy ở đây thì bộ thử sẽ vui vẻ chứng minh rằng hai người ở hai nhóm
khác nhau chơi được với nhau, trong khi production từ chối đúng việc ấy.

Một phép kiểm chỉ đáng tin bằng việc nó **đỏ khi luật sai**, nên ba luật chịu lực nhất của trò
chơi — sàn sáu phần mười, ngưỡng một nửa của bãi chăn, và trí nhớ một-lần-một-người — đã được thử
bằng cách cố tình làm hỏng luật rồi xem có gì đỏ không. Bỏ sàn đi thì **bảy** phép kiểm đỏ; bỏ
ngưỡng bãi chăn thì hai; bỏ trí nhớ một-lần-một-người thì hai.

Bốn lỗi đã bắt được bằng cách ấy, và cả bốn đều **không báo gì cả** — chúng chỉ hiện ra như một
tính năng không ai dùng được:

- `raid()` đúng và đã được kiểm từ lâu, nhưng **không có đường nào từ cái khung tới nó**.
- Ngưỡng lấy trộm so với một nửa của `output`, mà một con gà có `output = 20` và cả đời chỉ cho
  được tám phần — nên với con gà ấy, ngưỡng không bao giờ mở.
- Sản phẩm vật nuôi vào túi và **không có gì đọc ra**: bắt được mười quả trứng rồi nhận một con số
  mình không thấy ở đâu, và không bán được.
- Hai đường ghi vào cùng một túi bằng hai kiểu khoá khác nhau — `1001` và `"1001"`.

Ba phép kiểm là bài kiểm số học của cả trò chơi, và chúng là lý do bảng số sinh ra từ bản gốc chứ
không được nghĩ ra:

- **Mọi cây trồng ra rồi bán phải có lãi.** Một cây trồng ra rồi bán mà lỗ là một cái bẫy.
- **Một vụ mùa phải trả hơn một lần hái trộm.** Nếu không thì cả trò chơi chỉ có một chiến thuật, và
  nó không phải chiến thuật của một trò chơi nông trại.
- **Mọi con vật nuôi phải có lãi.** Cùng lý do.

## Đưa lên máy chủ

```bash
deploy/deploy-bot.sh
```

Chạy bộ thử → kiểm bảng kiểu → **mở khung trong một trình duyệt** → tải lên → kiểm từng file trên
mọi host công khai → khởi động lại → đọc lại dòng con bot tự nói lúc lên → kiểm nông trại ghi được
từ trong container. Token nằm ở `/opt/zeplao/farmbot/.env`, mode 600, và không bao giờ ở trong git.

Thứ tự ấy chịu lực ở hai chỗ. **Khung lên trước khi restart**, vì một phiên ghim đúng bản khung lúc
nó được mở — làm ngược lại thì con bot mới lên và phát những cái khung ghim vào bản cũ. Và **khung
phải chạy được, không chỉ tải về được**: mọi phép kiểm khác chỉ hỏi file có tới nơi không, mà một
cái khung trắng thì không cần file nào biến mất cả.

## Cái khung trắng

Bên `zeplao-bot-tien-len` có hai tài liệu viết cho đội kuku về cái khung trắng, và cả hai đều áp
dụng ở đây: một `404` mang theo `immutable` một năm bị CDN đóng băng, và một gói được giải nén lên
đĩa cục bộ của đúng cái máy nhận upload. Cho tới khi phía máy chủ sửa, trang tự phòng bằng cách
**mỗi lần thử lại dùng một khoá cache mới hoàn toàn** — một khoá cố định cũng đóng băng được.

`tools/widget-selftest.mjs` là thứ biến việc ấy từ một cuộc điều tra thành một phép kiểm. Nó mở
khung ở **tầng trên cùng** — nơi `parent === window`, nên `postMessage` của trang rơi trở lại vào
chính nó và một người nghe đặt trước khi trang chạy sẽ nghe `ready` đúng như máy chủ thật nghe — và
kiểm năm thứ: ba file đã nạp **và đã chạy**, `ready` đã được gửi, một khu vườn thật đã được vẽ ra,
bảng kiểu đã tới nơi, và không có gì ném ra ngoài.

Chạy nó với `--live <botId> <version>` để kiểm **bản đã upload**, đọc từ web công khai — đó là chế
độ đáng giá, vì gói trên máy này đã chạy được rồi mới tới lúc upload.

### Ba lỗi nó đã bắt được

Cả ba đều thuộc loại **không báo gì cả**, và cả ba đều cho ra đúng một cái khung trắng:

1. **Hai file khai trùng một cái tên ở tầng toàn cục.** `draw.js` đặt `window.drawFarm` làm chỗ nối,
   mà `farm.js` có một hàm tên `drawFarm` — hàm ấy ghi đè, im lặng, và triệu chứng là
   *draw.plot is not a function* ở một chỗ cách cái tên trùng cả trăm dòng. Đây đúng là lỗi mà
   README của bên bot bài đã ghi lại; nó xảy ra lần nữa ở đây.
2. **`export` trong một script cổ điển.** `index.html` nạp ba file bằng thẻ `<script>` thường, và
   thẻ thường không hiểu `export`: gặp nó là `SyntaxError` lúc phân tích, trước khi một dòng nào
   chạy — không phải một hàm không gọi được, mà **cả file không tồn tại**.
3. **Một phép chèn vào hư không.** `index.html` không có thẻ `<head>` lẫn `<body>` — HTML cho phép
   bỏ cả hai — nên đoạn mã đóng vai máy chủ được chèn "vào đầu tài liệu" nằm ngoài `<html>`, bị coi
   là chữ trong thân trang, và không bao giờ chạy.

## Chưa có gì

- **Khoá cứng tốc độ.** `FARM_SPEED` là một biến môi trường, không phải một bảng cân bằng đã được
  thử ở nhiều mức. Con số 20 được chọn bằng lập luận, không bằng cách chơi thử một tuần.
- **Bãi chăn chưa có con chó.** Hái trộm trên nông trại thì có đủ ba thứ chặn (sàn sáu phần mười,
  một lần một vụ mỗi người, và chó cắn); lấy trộm sản phẩm trong bãi chăn thì mới có ngưỡng một
  nửa sức chứa và một lần mỗi con, chưa có gì tương đương con chó — tức là bên ấy chưa có gì
  **phạt** người lấy trộm.
- **Chưa có nhiệm vụ.** Bản gốc có hai chuỗi nhiệm vụ cho người mới; ở đây bốn thửa đất lúc đầu tự
  làm việc ấy, và chưa có gì thay cho phần còn lại.
- **Chưa có hoa và quà tặng.** Bản gốc cho tặng hoa cho hàng xóm (`allflower.php`, hai mươi bó hoa
  ghép từ quả) và nó là cách duy nhất trong trò chơi nói được một điều gì đó với một người cụ thể.
  Phần xã hội ở đây mới có hái trộm và làm hộ — tức là mới có những việc lấy và cho, chưa có việc
  **tặng**.
- **Chưa công khai.** Cùng tình trạng như `@tienlenbot`: chỉ chủ bot mới thêm nó vào phòng được.
