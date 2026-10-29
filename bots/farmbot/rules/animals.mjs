/**
 * Vật nuôi: bảng số của QFarm, và hai cái chuồng.
 *
 * Sinh ra bởi `tools/gen-animals.mjs` từ `config/mc/animaltype.php` và
 * `config/mc/animaltime.php`. Giá, cấp, sức ăn, vòng đời và sản lượng đều là số thật của bản
 * gốc; tên đổi sang tiếng Việt.
 *
 * Đừng sửa tay. Sửa `gen-animals.mjs` rồi chạy lại.
 */

export const ANIMALS = [
  {
    "id": 1001,
    "name": "Gà",
    "product": "Trứng gà",
    "cn": "鸡",
    "house": "nest",
    "level": 0,
    "price": 700,
    "eats": 1,
    "yield": 20,
    "productPrice": 17,
    "beastPrice": 860,
    "productExp": 6,
    "beastExp": 26,
    "grow": 28800,
    "produce": 21420,
    "life": 158400,
    "productime": 15,
    "procreation": 129600
  },
  {
    "id": 1002,
    "name": "Thỏ",
    "product": "Thỏ con",
    "cn": "兔子",
    "house": "nest",
    "level": 1,
    "price": 1200,
    "eats": 2,
    "yield": 12,
    "productPrice": 39,
    "beastPrice": 1460,
    "productExp": 8,
    "beastExp": 28,
    "grow": 36000,
    "produce": 28620,
    "life": 165600,
    "productime": 15,
    "procreation": 129600
  },
  {
    "id": 1501,
    "name": "Cừu",
    "product": "Lông cừu",
    "cn": "羊",
    "house": "shed",
    "level": 2,
    "price": 2000,
    "eats": 3,
    "yield": 24,
    "productPrice": 29,
    "beastPrice": 2860,
    "productExp": 16,
    "beastExp": 24,
    "grow": 54000,
    "produce": 43020,
    "life": 226800,
    "productime": 15,
    "procreation": 172800
  },
  {
    "id": 1003,
    "name": "Ngỗng",
    "product": "Trứng ngỗng",
    "cn": "鹅",
    "house": "nest",
    "level": 3,
    "price": 900,
    "eats": 3,
    "yield": 20,
    "productPrice": 19,
    "beastPrice": 1850,
    "productExp": 8,
    "beastExp": 31,
    "grow": 32400,
    "produce": 25020,
    "life": 183600,
    "productime": 15,
    "procreation": 151200
  },
  {
    "id": 1502,
    "name": "Bò",
    "product": "Bê con",
    "cn": "牛",
    "house": "shed",
    "level": 4,
    "price": 3000,
    "eats": 4,
    "yield": 12,
    "productPrice": 55,
    "beastPrice": 4260,
    "productExp": 17,
    "beastExp": 40,
    "grow": 64800,
    "produce": 43020,
    "life": 280800,
    "productime": 15,
    "procreation": 216000
  },
  {
    "id": 1004,
    "name": "Mèo",
    "product": "Mèo con",
    "cn": "猫",
    "house": "nest",
    "level": 5,
    "price": 3200,
    "eats": 2,
    "yield": 12,
    "productPrice": 56,
    "beastPrice": 4060,
    "productExp": 14,
    "beastExp": 37,
    "grow": 68400,
    "produce": 32220,
    "life": 284400,
    "productime": 15,
    "procreation": 216000
  },
  {
    "id": 1503,
    "name": "Khỉ",
    "product": "Khỉ con",
    "cn": "猴子",
    "house": "shed",
    "level": 6,
    "price": 4000,
    "eats": 3,
    "yield": 12,
    "productPrice": 58,
    "beastPrice": 5260,
    "productExp": 14,
    "beastExp": 38,
    "grow": 72000,
    "produce": 35820,
    "life": 288000,
    "productime": 15,
    "procreation": 216000
  },
  {
    "id": 1005,
    "name": "Công",
    "product": "Công con",
    "cn": "孔雀",
    "house": "nest",
    "level": 7,
    "price": 5000,
    "eats": 3,
    "yield": 24,
    "productPrice": 35,
    "beastPrice": 6060,
    "productExp": 16,
    "beastExp": 39,
    "grow": 75600,
    "produce": 43020,
    "life": 313200,
    "productime": 15,
    "procreation": 237600
  },
  {
    "id": 1504,
    "name": "Kangaroo",
    "product": "Kangaroo con",
    "cn": "袋鼠",
    "house": "shed",
    "level": 8,
    "price": 8000,
    "eats": 4,
    "yield": 12,
    "productPrice": 64,
    "beastPrice": 9860,
    "productExp": 16,
    "beastExp": 40,
    "grow": 64800,
    "produce": 35985,
    "life": 280800,
    "productime": 15,
    "procreation": 216000
  },
  {
    "id": 1006,
    "name": "Chim cánh cụt",
    "product": "Cánh cụt con",
    "cn": "企鹅",
    "house": "nest",
    "level": 9,
    "price": 10000,
    "eats": 3,
    "yield": 16,
    "productPrice": 68,
    "beastPrice": 11860,
    "productExp": 22,
    "beastExp": 44,
    "grow": 82800,
    "produce": 53820,
    "life": 342000,
    "productime": 15,
    "procreation": 259200
  },
  {
    "id": 1505,
    "name": "Hươu sao",
    "product": "Hươu con",
    "cn": "梅花鹿",
    "house": "shed",
    "level": 11,
    "price": 12000,
    "eats": 3,
    "yield": 12,
    "productPrice": 70,
    "beastPrice": 13330,
    "productExp": 14,
    "beastExp": 27,
    "grow": 64800,
    "produce": 35820,
    "life": 280800,
    "productime": 15,
    "procreation": 216000
  },
  {
    "id": 1507,
    "name": "Linh dương",
    "product": "Linh dương con",
    "cn": "羚羊",
    "house": "shed",
    "level": 15,
    "price": 13470,
    "eats": 2,
    "yield": 15,
    "productPrice": 77,
    "beastPrice": 15020,
    "productExp": 19,
    "beastExp": 31,
    "grow": 79200,
    "produce": 46620,
    "life": 410400,
    "productime": 15,
    "procreation": 331200
  },
  {
    "id": 1508,
    "name": "Đà điểu",
    "product": "Trứng đà điểu",
    "cn": "鸵鸟",
    "house": "shed",
    "level": 19,
    "price": 14430,
    "eats": 2,
    "yield": 17,
    "productPrice": 79,
    "beastPrice": 17610,
    "productExp": 21,
    "beastExp": 33,
    "grow": 86400,
    "produce": 53820,
    "life": 518400,
    "productime": 15,
    "procreation": 432000
  },
  {
    "id": 1509,
    "name": "Gấu mèo",
    "product": "Gấu mèo con",
    "cn": "浣熊",
    "house": "shed",
    "level": 23,
    "price": 15940,
    "eats": 2,
    "yield": 16,
    "productPrice": 73,
    "beastPrice": 18120,
    "productExp": 13,
    "beastExp": 35,
    "grow": 72000,
    "produce": 43020,
    "life": 417600,
    "productime": 15,
    "procreation": 345600
  }
];

const BY_ID = new Map(ANIMALS.map((one) => [one.id, one]));
export const animalById = (id) => BY_ID.get(Number(id)) ?? null;

/// Hai loại chuồng, số chỗ có sẵn, trần, và giá từng lần mở thêm một chỗ.
export const HOUSES = {
  "nest": {
    "start": 2,
    "max": 8,
    "costs": [
      0,
      3000,
      20000,
      60000,
      120000,
      210000,
      300000
    ]
  },
  "shed": {
    "start": 0,
    "max": 6,
    "costs": [
      5000,
      40000,
      90000,
      160000,
      250000,
      350000
    ]
  }
};

/// Cỏ: cây số 40 của nông trại, giá mua, và sức chứa của máng.
///
/// **Cỏ trồng rẻ hơn cỏ mua, và đó là cả thiết kế.** Một gói hạt cỏ 80 đồng cho 25 bó, tức 3,2
/// đồng một bó; mua thẳng ở tiệm thì 60. Nên nông trại nuôi bãi chăn, và bãi chăn trả lại bằng
/// sản phẩm — vòng ấy là vòng của bản gốc, chỉ có điều ở đây nó nhìn thấy được ngay trên một
/// khung hình thay vì nằm trong hai chỗ khác nhau của một trang Flash.
export const GRASS = {
  "crop": 40,
  "buy": 60,
  "hopper": 1000,
  "perHours": 4
};
