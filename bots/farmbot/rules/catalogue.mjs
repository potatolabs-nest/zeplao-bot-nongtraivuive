/**
 * Cây trồng và đất: bảng số của QFarm, không phải bảng số tự nghĩ ra.
 *
 * Sinh ra bởi `tools/gen-catalogue.mjs` từ `config/nc/cropstype.php`, `config/nc/cropstime.php` và
 * `config/nc/upgrade.php` của QFarm 7.0. Mọi con số ở đây — cấp, vòng sinh trưởng, năm mốc
 * giai đoạn, số lần hái, sản lượng, giá hạt, giá bán, kinh nghiệm — đều là số thật; chỉ có tên
 * được đổi sang tiếng Việt, vì một trang trại tiếng Việt ghi 白萝卜 trên gói hạt thì không phải
 * là bản port, mà là bản sao.
 *
 * Đừng sửa tay file này. Sửa `gen-catalogue.mjs` rồi chạy lại.
 */

/// Một cây: 41 loại, xếp theo cấp mở khoá.
///
/// `stages` là **tỉ lệ của cả vòng**, không phải số giây — mốc thật trong QFarm được ghi bằng
/// giây tuyệt đối, mà giây tuyệt đối thì không co giãn được khi cả trò chơi chạy nhanh lên
/// (xem `SPEED`). Chia sẵn ở đây để chỗ dùng chỉ còn một phép nhân.
export const CROPS = [
  {
    "id": 40,
    "name": "Cỏ voi",
    "level": 0,
    "cycle": 28800,
    "stages": [
      0.25,
      0.5,
      0.75,
      1,
      1
    ],
    "picks": 1,
    "yield": 25,
    "seed": 80,
    "sell": 6,
    "exp": 10,
    "cn": "牧草"
  },
  {
    "id": 2,
    "name": "Củ cải trắng",
    "level": 0,
    "cycle": 36000,
    "stages": [
      0.2,
      0.4,
      0.7,
      1,
      1
    ],
    "picks": 1,
    "yield": 16,
    "seed": 125,
    "sell": 17,
    "exp": 15,
    "cn": "白萝卜"
  },
  {
    "id": 3,
    "name": "Cà rốt",
    "level": 0,
    "cycle": 46800,
    "stages": [
      0.1538,
      0.3846,
      0.6923,
      1,
      1
    ],
    "picks": 1,
    "yield": 17,
    "seed": 163,
    "sell": 21,
    "exp": 18,
    "cn": "胡萝卜"
  },
  {
    "id": 64,
    "name": "Hành lá",
    "level": 1,
    "cycle": 39600,
    "stages": [
      0.1818,
      0.3636,
      0.6364,
      1,
      1
    ],
    "picks": 1,
    "yield": 17,
    "seed": 125,
    "sell": 19,
    "exp": 15,
    "cn": "大葱"
  },
  {
    "id": 59,
    "name": "Cải thảo",
    "level": 1,
    "cycle": 50400,
    "stages": [
      0.1429,
      0.2857,
      0.5,
      0.7143,
      1
    ],
    "picks": 1,
    "yield": 17,
    "seed": 168,
    "sell": 22,
    "exp": 19,
    "cn": "大白菜"
  },
  {
    "id": 60,
    "name": "Lúa",
    "level": 2,
    "cycle": 50400,
    "stages": [
      0.1429,
      0.2857,
      0.5,
      0.7143,
      1
    ],
    "picks": 1,
    "yield": 18,
    "seed": 168,
    "sell": 21,
    "exp": 19,
    "cn": "水稻"
  },
  {
    "id": 61,
    "name": "Lúa mì",
    "level": 2,
    "cycle": 50400,
    "stages": [
      0.1429,
      0.2857,
      0.5,
      0.7143,
      1
    ],
    "picks": 1,
    "yield": 18,
    "seed": 168,
    "sell": 21,
    "exp": 19,
    "cn": "小麦"
  },
  {
    "id": 4,
    "name": "Ngô",
    "level": 3,
    "cycle": 50400,
    "stages": [
      0.1429,
      0.2857,
      0.5,
      0.7143,
      1
    ],
    "picks": 1,
    "yield": 17,
    "seed": 175,
    "sell": 23,
    "exp": 19,
    "cn": "玉米"
  },
  {
    "id": 71,
    "name": "Cải thìa",
    "level": 4,
    "cycle": 39600,
    "stages": [
      0.1818,
      0.3636,
      0.6364,
      1,
      1
    ],
    "picks": 1,
    "yield": 18,
    "seed": 135,
    "sell": 21,
    "exp": 15,
    "cn": "小白菜"
  },
  {
    "id": 5,
    "name": "Khoai tây",
    "level": 4,
    "cycle": 54000,
    "stages": [
      0.1333,
      0.2667,
      0.4667,
      0.7333,
      1
    ],
    "picks": 1,
    "yield": 18,
    "seed": 188,
    "sell": 24,
    "exp": 20,
    "cn": "土豆"
  },
  {
    "id": 96,
    "name": "Xà lách",
    "level": 4,
    "cycle": 68400,
    "stages": [
      0.1579,
      0.3158,
      0.5263,
      0.7368,
      1
    ],
    "picks": 1,
    "yield": 21,
    "seed": 195,
    "sell": 24,
    "exp": 25,
    "cn": "生菜"
  },
  {
    "id": 6,
    "name": "Cà tím",
    "level": 5,
    "cycle": 57600,
    "stages": [
      0.125,
      0.3125,
      0.5,
      0.75,
      1
    ],
    "picks": 1,
    "yield": 20,
    "seed": 237,
    "sell": 25,
    "exp": 21,
    "cn": "茄子"
  },
  {
    "id": 51,
    "name": "Táo đỏ",
    "level": 5,
    "cycle": 57600,
    "stages": [
      0.125,
      0.3125,
      0.5,
      0.75,
      1
    ],
    "picks": 1,
    "yield": 20,
    "seed": 237,
    "sell": 25,
    "exp": 21,
    "cn": "红枣"
  },
  {
    "id": 7,
    "name": "Cà chua",
    "level": 6,
    "cycle": 61200,
    "stages": [
      0.1176,
      0.2941,
      0.5294,
      0.7647,
      1
    ],
    "picks": 1,
    "yield": 21,
    "seed": 251,
    "sell": 26,
    "exp": 22,
    "cn": "番茄"
  },
  {
    "id": 8,
    "name": "Đậu Hà Lan",
    "level": 7,
    "cycle": 64800,
    "stages": [
      0.1667,
      0.3333,
      0.5,
      0.7222,
      1
    ],
    "picks": 1,
    "yield": 22,
    "seed": 266,
    "sell": 27,
    "exp": 23,
    "cn": "豌豆"
  },
  {
    "id": 41,
    "name": "Hoa hồng đỏ",
    "level": 7,
    "cycle": 64800,
    "stages": [
      0.1667,
      0.3333,
      0.5,
      0.7222,
      1
    ],
    "picks": 1,
    "yield": 22,
    "seed": 266,
    "sell": 27,
    "exp": 23,
    "cn": "红玫瑰"
  },
  {
    "id": 9,
    "name": "Ớt",
    "level": 8,
    "cycle": 72000,
    "stages": [
      0.15,
      0.35,
      0.55,
      0.75,
      1
    ],
    "picks": 1,
    "yield": 24,
    "seed": 296,
    "sell": 28,
    "exp": 25,
    "cn": "辣椒"
  },
  {
    "id": 103,
    "name": "Hoa loa kèn",
    "level": 8,
    "cycle": 72000,
    "stages": [
      0.15,
      0.35,
      0.55,
      0.75,
      1
    ],
    "picks": 1,
    "yield": 24,
    "seed": 296,
    "sell": 28,
    "exp": 25,
    "cn": "天香百合"
  },
  {
    "id": 10,
    "name": "Bí ngô",
    "level": 9,
    "cycle": 79200,
    "stages": [
      0.1364,
      0.3182,
      0.5455,
      0.7727,
      1
    ],
    "picks": 1,
    "yield": 25,
    "seed": 325,
    "sell": 30,
    "exp": 27,
    "cn": "南瓜"
  },
  {
    "id": 91,
    "name": "Sơn tra",
    "level": 9,
    "cycle": 79200,
    "stages": [
      0.1364,
      0.3182,
      0.5455,
      0.7273,
      1
    ],
    "picks": 1,
    "yield": 25,
    "seed": 325,
    "sell": 30,
    "exp": 27,
    "cn": "山楂"
  },
  {
    "id": 11,
    "name": "Táo",
    "level": 10,
    "cycle": 75600,
    "stages": [
      0.1905,
      0.381,
      0.5714,
      0.7619,
      1
    ],
    "picks": 2,
    "yield": 23,
    "seed": 578,
    "sell": 24,
    "exp": 18,
    "cn": "苹果"
  },
  {
    "id": 1,
    "name": "Dâu tây",
    "level": 10,
    "cycle": 86400,
    "stages": [
      0.1667,
      0.3333,
      0.5417,
      0.75,
      1
    ],
    "picks": 2,
    "yield": 24,
    "seed": 605,
    "sell": 27,
    "exp": 20,
    "cn": "草莓"
  },
  {
    "id": 14,
    "name": "Dưa hấu",
    "level": 11,
    "cycle": 100800,
    "stages": [
      0.1429,
      0.3214,
      0.5357,
      0.75,
      1
    ],
    "picks": 2,
    "yield": 27,
    "seed": 708,
    "sell": 29,
    "exp": 23,
    "cn": "西瓜"
  },
  {
    "id": 15,
    "name": "Chuối",
    "level": 12,
    "cycle": 111600,
    "stages": [
      0.1613,
      0.3548,
      0.5484,
      0.7742,
      1
    ],
    "picks": 2,
    "yield": 29,
    "seed": 900,
    "sell": 32,
    "exp": 25,
    "cn": "香蕉"
  },
  {
    "id": 18,
    "name": "Đào",
    "level": 13,
    "cycle": 151200,
    "stages": [
      0.1905,
      0.381,
      0.5714,
      0.7857,
      1
    ],
    "picks": 2,
    "yield": 32,
    "seed": 1200,
    "sell": 40,
    "exp": 33,
    "cn": "桃子"
  },
  {
    "id": 19,
    "name": "Cam",
    "level": 14,
    "cycle": 133200,
    "stages": [
      0.1892,
      0.3784,
      0.5676,
      0.7838,
      1
    ],
    "picks": 3,
    "yield": 26,
    "seed": 1587,
    "sell": 41,
    "exp": 25,
    "cn": "橙子"
  },
  {
    "id": 46,
    "name": "Quả tình yêu",
    "level": 15,
    "cycle": 111600,
    "stages": [
      0.1613,
      0.3548,
      0.5484,
      0.7742,
      1
    ],
    "picks": 3,
    "yield": 24,
    "seed": 4000,
    "sell": 100,
    "exp": 27,
    "cn": "爱心果"
  },
  {
    "id": 13,
    "name": "Nho",
    "level": 15,
    "cycle": 165600,
    "stages": [
      0.1739,
      0.3696,
      0.5652,
      0.7826,
      1
    ],
    "picks": 3,
    "yield": 29,
    "seed": 1978,
    "sell": 47,
    "exp": 30,
    "cn": "葡萄"
  },
  {
    "id": 23,
    "name": "Lựu",
    "level": 16,
    "cycle": 187200,
    "stages": [
      0.1923,
      0.3846,
      0.5769,
      0.7885,
      1
    ],
    "picks": 3,
    "yield": 30,
    "seed": 2425,
    "sell": 54,
    "exp": 34,
    "cn": "石榴"
  },
  {
    "id": 26,
    "name": "Bưởi",
    "level": 17,
    "cycle": 219600,
    "stages": [
      0.1803,
      0.377,
      0.5738,
      0.7869,
      1
    ],
    "picks": 3,
    "yield": 33,
    "seed": 2855,
    "sell": 58,
    "exp": 39,
    "cn": "柚子"
  },
  {
    "id": 27,
    "name": "Dứa",
    "level": 18,
    "cycle": 230400,
    "stages": [
      0.1875,
      0.3906,
      0.5938,
      0.7969,
      1
    ],
    "picks": 3,
    "yield": 35,
    "seed": 3480,
    "sell": 62,
    "exp": 40,
    "cn": "菠萝"
  },
  {
    "id": 29,
    "name": "Dừa",
    "level": 19,
    "cycle": 198000,
    "stages": [
      0.1818,
      0.3818,
      0.5818,
      0.7818,
      1
    ],
    "picks": 4,
    "yield": 27,
    "seed": 3720,
    "sell": 65,
    "exp": 32,
    "cn": "椰子"
  },
  {
    "id": 45,
    "name": "Kiwi",
    "level": 20,
    "cycle": 165600,
    "stages": [
      0.1739,
      0.3696,
      0.5652,
      0.7826,
      1
    ],
    "picks": 4,
    "yield": 27,
    "seed": 4700,
    "sell": 75,
    "exp": 27,
    "cn": "猕猴桃"
  },
  {
    "id": 31,
    "name": "Bầu",
    "level": 20,
    "cycle": 219600,
    "stages": [
      0.1803,
      0.377,
      0.5738,
      0.7869,
      1
    ],
    "picks": 4,
    "yield": 30,
    "seed": 4742,
    "sell": 71,
    "exp": 36,
    "cn": "葫芦"
  },
  {
    "id": 33,
    "name": "Thanh long",
    "level": 21,
    "cycle": 252000,
    "stages": [
      0.1857,
      0.3857,
      0.5857,
      0.7857,
      1
    ],
    "picks": 4,
    "yield": 32,
    "seed": 5356,
    "sell": 77,
    "exp": 41,
    "cn": "火龙果"
  },
  {
    "id": 34,
    "name": "Anh đào",
    "level": 22,
    "cycle": 259200,
    "stages": [
      0.1944,
      0.3889,
      0.5833,
      0.7917,
      1
    ],
    "picks": 4,
    "yield": 33,
    "seed": 5527,
    "sell": 78,
    "exp": 42,
    "cn": "樱桃"
  },
  {
    "id": 35,
    "name": "Vải",
    "level": 23,
    "cycle": 277200,
    "stages": [
      0.1948,
      0.3896,
      0.5974,
      0.7922,
      1
    ],
    "picks": 4,
    "yield": 34,
    "seed": 6588,
    "sell": 86,
    "exp": 44,
    "cn": "荔枝"
  },
  {
    "id": 38,
    "name": "Đu đủ",
    "level": 24,
    "cycle": 165600,
    "stages": [
      0.1739,
      0.3696,
      0.5652,
      0.7826,
      1
    ],
    "picks": 5,
    "yield": 28,
    "seed": 6590,
    "sell": 80,
    "exp": 26,
    "cn": "木瓜"
  },
  {
    "id": 39,
    "name": "Khế",
    "level": 25,
    "cycle": 165600,
    "stages": [
      0.1739,
      0.3696,
      0.5652,
      0.7826,
      1
    ],
    "picks": 5,
    "yield": 29,
    "seed": 7000,
    "sell": 82,
    "exp": 27,
    "cn": "杨桃"
  },
  {
    "id": 42,
    "name": "Chanh",
    "level": 26,
    "cycle": 111600,
    "stages": [
      0.1613,
      0.3548,
      0.5484,
      0.7742,
      1
    ],
    "picks": 5,
    "yield": 26,
    "seed": 6300,
    "sell": 83,
    "exp": 18,
    "cn": "柠檬"
  },
  {
    "id": 48,
    "name": "Dâu ta",
    "level": 27,
    "cycle": 111600,
    "stages": [
      0.1613,
      0.3548,
      0.5484,
      0.7742,
      1
    ],
    "picks": 5,
    "yield": 27,
    "seed": 6600,
    "sell": 84,
    "exp": 18,
    "cn": "杨梅"
  }
];

/// Tra theo id. Không có gì để tra hộ: một cây không có trong bảng thì không trồng được.
const BY_ID = new Map(CROPS.map((one) => [one.id, one]));
export const cropById = (id) => BY_ID.get(Number(id)) ?? null;

/// Đất của một nông trại: sáu thửa lúc đầu, và mỗi thửa sau phải bỏ tiền ra khai.
///
/// Mười tám thửa là trần, không phải hai mươi tư như QFarm. Trần ở đây là **cái khung**: khung
/// widget rộng chừng 390 pixel, ba thửa một hàng, và hai mươi tư thửa là tám hàng — một trang
/// trại dài hơn cái điện thoại đang xem nó thì phần dưới không ai chạm tới.
export const LAND = [
  {
    "level": 0,
    "cost": 0
  },
  {
    "level": 0,
    "cost": 0
  },
  {
    "level": 0,
    "cost": 0
  },
  {
    "level": 0,
    "cost": 0
  },
  {
    "level": 0,
    "cost": 0
  },
  {
    "level": 0,
    "cost": 0
  },
  {
    "level": 5,
    "cost": 10000
  },
  {
    "level": 7,
    "cost": 20000
  },
  {
    "level": 9,
    "cost": 30000
  },
  {
    "level": 11,
    "cost": 50000
  },
  {
    "level": 13,
    "cost": 70000
  },
  {
    "level": 15,
    "cost": 90000
  },
  {
    "level": 17,
    "cost": 120000
  },
  {
    "level": 19,
    "cost": 150000
  },
  {
    "level": 21,
    "cost": 180000
  },
  {
    "level": 23,
    "cost": 230000
  },
  {
    "level": 25,
    "cost": 300000
  },
  {
    "level": 27,
    "cost": 500000
  }
];

/// Nâng thửa thứ `n` (tính từ 0) lên đất đỏ, theo bảng của QFarm.
export const RED_LAND = [
  {
    "level": 28,
    "cost": 200000
  },
  {
    "level": 29,
    "cost": 220000
  },
  {
    "level": 30,
    "cost": 240000
  },
  {
    "level": 31,
    "cost": 260000
  },
  {
    "level": 32,
    "cost": 290000
  },
  {
    "level": 33,
    "cost": 320000
  },
  {
    "level": 34,
    "cost": 350000
  },
  {
    "level": 35,
    "cost": 380000
  },
  {
    "level": 36,
    "cost": 410000
  },
  {
    "level": 37,
    "cost": 440000
  },
  {
    "level": 38,
    "cost": 480000
  },
  {
    "level": 39,
    "cost": 520000
  },
  {
    "level": 40,
    "cost": 560000
  },
  {
    "level": 41,
    "cost": 600000
  },
  {
    "level": 42,
    "cost": 650000
  },
  {
    "level": 43,
    "cost": 700000
  },
  {
    "level": 44,
    "cost": 770000
  },
  {
    "level": 45,
    "cost": 900000
  },
  {
    "level": 47,
    "cost": 1100000
  },
  {
    "level": 49,
    "cost": 1300000
  },
  {
    "level": 51,
    "cost": 1500000
  },
  {
    "level": 53,
    "cost": 1700000
  },
  {
    "level": 55,
    "cost": 1900000
  },
  {
    "level": 57,
    "cost": 2100000
  }
];

/// Bao nhiêu thửa một nông trại có thể có.
export const MAX_PLOTS = LAND.length;

/// Đất đỏ cho thêm ngần này sản lượng, cho cây không phải cây đỏ.
export const RED_BONUS = 1.1;
