import type { Category, Product } from "./types.js";

export const categoriesSeed: Category[] = [
  { id: "breakfast", title: "Завтраки без суеты", sortOrder: 10, isVisible: true },
  { id: "kids", title: "Для детей", sortOrder: 20, isVisible: true },
  { id: "dinner", title: "Ужин на автопилоте", sortOrder: 30, isVisible: true },
  { id: "heat", title: "Просто разогрей", sortOrder: 40, isVisible: true },
  { id: "stock", title: "Заготовки впрок", sortOrder: 50, isVisible: true },
  { id: "week", title: "Запас на неделю", sortOrder: 60, isVisible: true },
  { id: "sweets", title: "Сладости", sortOrder: 70, isVisible: true },
  { id: "office", title: "Когда праздник в офисе", sortOrder: 80, isVisible: true },
  { id: "beer", title: "Закуски к пиву", sortOrder: 90, isVisible: true }
];

const image = (seed: number) =>
  `https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80&sig=${seed}`;

export const productsSeed: Product[] = [
  { id: "syrniki-1kg", categoryId: "breakfast", title: "Сырники", description: "Домашние сырники для быстрого завтрака.", price: 600, unit: "kg", unitLabel: "1 кг", imageUrl: image(1), stock: 18, isVisible: true, sortOrder: 10 },
  { id: "syrniki-hearts", categoryId: "breakfast", title: "Сырники сердечки с вишней", description: "Сырники с вишней и апельсиновой цедрой.", price: 700, unit: "kg", unitLabel: "1 кг", imageUrl: image(2), stock: 12, isVisible: true, sortOrder: 20 },
  { id: "pancake-cheesecake", categoryId: "breakfast", title: "Блин Чизкейк", description: "Сладкий блин с нежной начинкой.", price: 70, unit: "piece", unitLabel: "75 гр.", imageUrl: image(3), stock: 40, isVisible: true, sortOrder: 30 },
  { id: "pancake-carbonara", categoryId: "breakfast", title: "Блин Карбонара", description: "Сытный блин с карбонарой.", price: 110, unit: "piece", unitLabel: "75 гр.", imageUrl: image(4), stock: 35, isVisible: true, sortOrder: 40 },
  { id: "pancake-shaurma", categoryId: "breakfast", title: "Блин Шаурма с курицей", description: "Блин с куриной начинкой в стиле шаурмы.", price: 60, unit: "piece", unitLabel: "75 гр.", imageUrl: image(5), stock: 44, isVisible: true, sortOrder: 50 },
  { id: "pancake-philadelphia", categoryId: "breakfast", title: "Блин Филадельфия с лососем", description: "Блин с лососем и сливочным вкусом.", price: 250, unit: "piece", unitLabel: "75 гр.", imageUrl: image(6), stock: 15, isVisible: true, sortOrder: 60 },

  { id: "kids-cocoa-syrniki", categoryId: "kids", title: "Сырники с какао", description: "Детские сырники с минимумом сахара.", price: 700, unit: "kg", unitLabel: "1 кг, 20 шт.", imageUrl: image(7), stock: 10, isVisible: true, sortOrder: 10 },
  { id: "kids-chicken-cutlets", categoryId: "kids", title: "Куриные котлетки", description: "Нежные котлетки без лука и чеснока.", price: 700, unit: "kg", unitLabel: "1 кг, 20 шт.", imageUrl: image(8), stock: 14, isVisible: true, sortOrder: 20 },
  { id: "kids-mini-dumplings", categoryId: "kids", title: "Мини-пельмешки куриные", description: "Маленькие куриные пельмешки для детей.", price: 600, unit: "kg", unitLabel: "1 кг", imageUrl: image(9), stock: 9, isVisible: true, sortOrder: 30 },
  { id: "kids-rice-meatballs", categoryId: "kids", title: "Тефтели куриные с рисом", description: "Куриные тефтели с рисом без лишней соли.", price: 600, unit: "kg", unitLabel: "1 кг, 20 шт.", imageUrl: image(10), stock: 11, isVisible: true, sortOrder: 40 },
  { id: "kids-soup-meatballs", categoryId: "kids", title: "Фрикадельки для супа", description: "Заготовка для быстрого детского супа.", price: 600, unit: "kg", unitLabel: "1 кг", imageUrl: image(11), stock: 8, isVisible: true, sortOrder: 50 },
  { id: "kids-lazy-vareniki", categoryId: "kids", title: "Ленивые вареники", description: "Быстрый детский завтрак или ужин.", price: 250, unit: "kg", unitLabel: "1 кг", imageUrl: image(12), stock: 16, isVisible: true, sortOrder: 60 },

  { id: "lazy-pork-cabbage-rolls", categoryId: "dinner", title: "Голубцы ленивые из свинины", description: "Домашний ужин без долгой готовки.", price: 60, unit: "100g", unitLabel: "100 гр.", imageUrl: image(13), stock: 30, isVisible: true, sortOrder: 10 },
  { id: "pork-cabbage-rolls", categoryId: "dinner", title: "Голубцы обычные из свинины", description: "Классические голубцы из свинины.", price: 70, unit: "100g", unitLabel: "100 гр.", imageUrl: image(14), stock: 28, isVisible: true, sortOrder: 20 },
  { id: "pork-cutlet", categoryId: "dinner", title: "Котлета свиная", description: "Сочная свиная котлета.", price: 60, unit: "100g", unitLabel: "100 гр.", imageUrl: image(15), stock: 45, isVisible: true, sortOrder: 30 },
  { id: "chicken-cutlet", categoryId: "dinner", title: "Котлета куриная", description: "Куриная котлета для быстрого ужина.", price: 70, unit: "100g", unitLabel: "100 гр.", imageUrl: image(16), stock: 42, isVisible: true, sortOrder: 40 },
  { id: "beef-chicken-cutlet", categoryId: "dinner", title: "Котлета говядина/курица", description: "Смешанная котлета с насыщенным вкусом.", price: 110, unit: "100g", unitLabel: "100 гр.", imageUrl: image(17), stock: 26, isVisible: true, sortOrder: 50 },
  { id: "lamb-chicken-cutlet", categoryId: "dinner", title: "Котлета баранина/курица", description: "Плотная мясная котлета с бараниной.", price: 200, unit: "100g", unitLabel: "100 гр.", imageUrl: image(18), stock: 10, isVisible: true, sortOrder: 60 },
  { id: "pike-cutlet", categoryId: "dinner", title: "Котлета щука", description: "Рыбная котлета из щуки.", price: 100, unit: "100g", unitLabel: "100 гр.", imageUrl: image(19), stock: 12, isVisible: true, sortOrder: 70 },
  { id: "zander-cutlet", categoryId: "dinner", title: "Котлета судак", description: "Рыбная котлета из судака.", price: 150, unit: "100g", unitLabel: "100 гр.", imageUrl: image(20), stock: 9, isVisible: true, sortOrder: 80 },
  { id: "pork-dumplings", categoryId: "dinner", title: "Пельмени свиные", description: "Классические домашние пельмени.", price: 550, unit: "kg", unitLabel: "1 кг", imageUrl: image(21), stock: 20, isVisible: true, sortOrder: 90 },
  { id: "chicken-dumplings", categoryId: "dinner", title: "Пельмени куриные", description: "Домашние куриные пельмени.", price: 600, unit: "kg", unitLabel: "1 кг", imageUrl: image(22), stock: 22, isVisible: true, sortOrder: 100 },
  { id: "beef-chicken-dumplings", categoryId: "dinner", title: "Пельмени говядина и курица", description: "Сытные пельмени из смешанного фарша.", price: 730, unit: "kg", unitLabel: "1 кг", imageUrl: image(23), stock: 14, isVisible: true, sortOrder: 110 },
  { id: "beef-pork-dumplings", categoryId: "dinner", title: "Пельмени говядина и свинина", description: "Классическая мясная смесь.", price: 730, unit: "kg", unitLabel: "1 кг", imageUrl: image(24), stock: 16, isVisible: true, sortOrder: 120 },
  { id: "lamb-chicken-dumplings", categoryId: "dinner", title: "Пельмени баранина и курица", description: "Премиальные пельмени с бараниной.", price: 1650, unit: "kg", unitLabel: "1 кг", imageUrl: image(25), stock: 7, isVisible: true, sortOrder: 130 },
  { id: "potato-vareniki", categoryId: "dinner", title: "Вареники с картофелем", description: "Простой домашний вариант на каждый день.", price: 250, unit: "kg", unitLabel: "1 кг", imageUrl: image(26), stock: 18, isVisible: true, sortOrder: 140 },
  { id: "cottage-cheese-vareniki", categoryId: "dinner", title: "Вареники с творогом", description: "Нежные вареники с творогом.", price: 250, unit: "kg", unitLabel: "1 кг", imageUrl: image(27), stock: 19, isVisible: true, sortOrder: 150 },
  { id: "curd-onion-vareniki", categoryId: "dinner", title: "Вареники с творогом и зеленым луком", description: "Сытные вареники с творогом и зеленью.", price: 250, unit: "kg", unitLabel: "1 кг", imageUrl: image(28), stock: 12, isVisible: true, sortOrder: 160 },
  { id: "cherry-vareniki", categoryId: "dinner", title: "Вареники с вишней", description: "Сладкие вареники с вишней.", price: 700, unit: "kg", unitLabel: "1 кг", imageUrl: image(29), stock: 10, isVisible: true, sortOrder: 170 },
  { id: "potato-mushroom-vareniki", categoryId: "dinner", title: "Вареники с картофелем и грибами", description: "Вареники с картофелем и грибами.", price: 500, unit: "kg", unitLabel: "1 кг", imageUrl: image(30), stock: 13, isVisible: true, sortOrder: 180 },

  { id: "chicken-fillet-tomato-cheese", categoryId: "heat", title: "Куриное филе с томатами и сыром", description: "Готовое блюдо, которое нужно только разогреть.", price: 185, unit: "100g", unitLabel: "100 гр.", imageUrl: image(31), stock: 16, isVisible: true, sortOrder: 10 },
  { id: "beef-mashed-potato", categoryId: "heat", title: "Томленая говядина с пюре", description: "Готовый сытный обед.", price: 450, unit: "piece", unitLabel: "350 гр.", imageUrl: image(32), stock: 8, isVisible: true, sortOrder: 20 },
  { id: "beef-truffle-mash", categoryId: "heat", title: "Томленая говядина с трюфельным пюре", description: "Готовое блюдо с пармезаном.", price: 560, unit: "piece", unitLabel: "350 гр.", imageUrl: image(33), stock: 6, isVisible: true, sortOrder: 30 },
  { id: "croquettes-roll", categoryId: "heat", title: "Крокеты с куриным рулетом", description: "Картофельные крокеты с моцареллой.", price: 100, unit: "piece", unitLabel: "1 шт., 80 гр.", imageUrl: image(34), stock: 20, isVisible: true, sortOrder: 40 },
  { id: "pink-salmon-200", categoryId: "heat", title: "Горбуша в кляре с соусом тар тар", description: "Порция рыбы с соусом.", price: 375, unit: "piece", unitLabel: "200 гр.", imageUrl: image(35), stock: 10, isVisible: true, sortOrder: 50 },
  { id: "pink-salmon-1300", categoryId: "heat", title: "Горбуша в кляре с соусом тар тар", description: "Большая порция для семьи или стола.", price: 2250, unit: "piece", unitLabel: "1,3 кг", imageUrl: image(36), stock: 4, isVisible: true, sortOrder: 60 },

  { id: "broth-300", categoryId: "stock", title: "Бульон куриный/рыбный", description: "Основа для быстрого супа.", price: 120, unit: "ml", unitLabel: "300 мл", imageUrl: image(37), stock: 25, isVisible: true, sortOrder: 10 },
  { id: "broth-1l", categoryId: "stock", title: "Бульон куриный/рыбный", description: "Литр бульона для домашних блюд.", price: 300, unit: "l", unitLabel: "1 л", imageUrl: image(38), stock: 18, isVisible: true, sortOrder: 20 },
  { id: "borsch-chicken", categoryId: "stock", title: "Борщ с курицей", description: "Готовый борщ на несколько порций.", price: 520, unit: "l", unitLabel: "1 л", imageUrl: image(39), stock: 12, isVisible: true, sortOrder: 30 },
  { id: "solyanka", categoryId: "stock", title: "Солянка", description: "Готовая солянка на несколько порций.", price: 680, unit: "l", unitLabel: "1 л", imageUrl: image(40), stock: 9, isVisible: true, sortOrder: 40 },

  { id: "family-box", categoryId: "week", title: "Бокс Семейный", description: "Пельмени, вареники, котлеты и сырники на неделю.", price: 2300, unit: "box", unitLabel: "1 бокс", imageUrl: image(41), stock: 5, isVisible: true, sortOrder: 10 },
  { id: "meat-box", categoryId: "week", title: "Бокс Мясной", description: "Мясной запас из пельменей и котлет.", price: 3200, unit: "box", unitLabel: "1 бокс", imageUrl: image(42), stock: 4, isVisible: true, sortOrder: 20 },
  { id: "premium-box", categoryId: "week", title: "Бокс Премиум", description: "Премиальный набор с равиоли и мясными позициями.", price: 2300, unit: "box", unitLabel: "1 бокс", imageUrl: image(43), stock: 3, isVisible: true, sortOrder: 30 },

  { id: "mochi", categoryId: "sweets", title: "Моти в ассортименте", description: "Нежный десерт в ассортименте.", price: 190, unit: "piece", unitLabel: "1 шт.", imageUrl: image(44), stock: 30, isVisible: true, sortOrder: 10 },
  { id: "curd-rings", categoryId: "sweets", title: "Творожные кольца", description: "Творожное кольцо к чаю.", price: 360, unit: "piece", unitLabel: "150 гр., 1 шт.", imageUrl: image(45), stock: 16, isVisible: true, sortOrder: 20 },
  { id: "zephyr", categoryId: "sweets", title: "Зефир", description: "Легкий сладкий десерт.", price: 50, unit: "piece", unitLabel: "1 шт.", imageUrl: image(46), stock: 45, isVisible: true, sortOrder: 30 },

  { id: "office-strong", categoryId: "office", title: "Бокс Мощный", description: "Фуршетный гастробокс с канапе и закусками.", price: 4600, unit: "box", unitLabel: "1 кг", imageUrl: image(47), stock: 2, isVisible: true, sortOrder: 10 },
  { id: "office-not-strong", categoryId: "office", title: "Бокс Не Такой Мощный", description: "Фуршетный гастробокс для офиса.", price: 4200, unit: "box", unitLabel: "900 гр.", imageUrl: image(48), stock: 2, isVisible: true, sortOrder: 20 },
  { id: "office-caprese", categoryId: "office", title: "Бокс Капрезе", description: "Канапе капрезе для легкого фуршета.", price: 1100, unit: "box", unitLabel: "600 гр.", imageUrl: image(49), stock: 4, isVisible: true, sortOrder: 30 },
  { id: "office-pepperoni", categoryId: "office", title: "Бокс Пепперони", description: "Канапе пепперони с оливкой и зеленью.", price: 950, unit: "box", unitLabel: "300 гр.", imageUrl: image(50), stock: 5, isVisible: true, sortOrder: 40 },
  { id: "office-sea", categoryId: "office", title: "Бокс Морской", description: "Брускетты с лососем и канапе с креветкой.", price: 3500, unit: "box", unitLabel: "600 гр.", imageUrl: image(51), stock: 2, isVisible: true, sortOrder: 50 },
  { id: "office-cheese", categoryId: "office", title: "Бокс Сырный", description: "Брускетты с сыром, грушей и сливочным сыром.", price: 1800, unit: "box", unitLabel: "550 гр.", imageUrl: image(52), stock: 3, isVisible: true, sortOrder: 60 },
  { id: "office-fruit", categoryId: "office", title: "Бокс Фруктовый", description: "Ассорти фруктов и ягод с сыром бри.", price: 1650, unit: "box", unitLabel: "850 гр.", imageUrl: image(53), stock: 3, isVisible: true, sortOrder: 70 },
  { id: "office-delicacy", categoryId: "office", title: "Бокс Деликатесный", description: "Брускетты с ростбифом, бужениной и курицей.", price: 1800, unit: "box", unitLabel: "750 гр.", imageUrl: image(54), stock: 3, isVisible: true, sortOrder: 80 },

  { id: "chicken-jerky", categoryId: "beer", title: "Джерки куриные", description: "Сушеная куриная закуска.", price: 225, unit: "100g", unitLabel: "100 гр.", imageUrl: image(55), stock: 20, isVisible: true, sortOrder: 10 },
  { id: "chicken-mince-brushwood", categoryId: "beer", title: "Хворост из куриного фарша", description: "Хрустящая куриная закуска.", price: 225, unit: "100g", unitLabel: "100 гр.", imageUrl: image(56), stock: 20, isVisible: true, sortOrder: 20 },
  { id: "chicken-balyk", categoryId: "beer", title: "Куриный балык", description: "Плотная куриная закуска.", price: 225, unit: "100g", unitLabel: "100 гр.", imageUrl: image(57), stock: 20, isVisible: true, sortOrder: 30 }
];
