/* ============================================================
   TEXAS BRANDING IRON BURGERS — Config
   Edit this file only to rebrand for a new client.
   ============================================================ */

const SHOP = {

  // ── Business Info ──────────────────────────────────────────
  name:        "Texas Branding Iron Burgers",
  nameShort:   "Branding Iron",
  tagline:     "Boldly seasoned. Texas sized. Fired to perfection.",
  rating:      "4.1",
  reviews:     "288",
  phone:       "(956) 230-5809",
  phoneRaw:    "9562305809",
  address:     "77 Sunshine Strip",
  city:        "Harlingen",
  state:       "TX",
  zip:         "78550",

  // ── Social ─────────────────────────────────────────────────
  facebook:    "",
  instagram:   "",

  // ── Hours ──────────────────────────────────────────────────
  hoursShort:  "Open Daily 11am–9pm",
  hours: [
    { day: "Monday–Sunday", time: "11:00 AM – 9:10 PM" },
  ],

  // ── Colors ─────────────────────────────────────────────────
  colorPrimary: "#c17f24",
  colorDark:    "#1a0f00",
  colorAccent:  "#8B4513",

  // ── Images ─────────────────────────────────────────────────
  logo:      "logo.png",
  heroBg:    "hero.jpg",
  gallery: [
    { file: "food1.jpg", label: "Signature Burger" },
    { file: "food2.jpg", label: "BBQ Stack"        },
    { file: "food3.jpg", label: "Loaded Fries"     },
    { file: "food4.jpg", label: "Combo Meal"       },
    { file: "food5.jpg", label: "The Shop"         },
  ],

  // ── Menu ───────────────────────────────────────────────────
  menu: [
    {
      category: "Burgers",
      icon: "🍔",
      items: [
        { name: "Half Pound Burger",        desc: "Juicy half pound beef patty with your choice of toppings — jalapeños, lettuce, tomato, pickles",  price: "", popular: true  },
        { name: "Double Meat Burger",       desc: "Two beef patties stacked high with fresh toppings your way",                                       price: "", popular: false },
        { name: "Triple Meat Burger",       desc: "Three patties for the serious burger lover",                                                       price: "", popular: false },
        { name: "Fish Sandwich",            desc: "Crispy fish fillet with fresh toppings",                                                           price: "$6.35", popular: false },
        { name: "Chicken Fried Sandwich",   desc: "Golden fried chicken sandwich with your choice of toppings",                                       price: "$6.35", popular: false },
      ]
    },
    {
      category: "Combos",
      icon: "🤠",
      items: [
        { name: "Double Meat Burger Combo", desc: "Double meat burger + fries + drink",                     price: "$13.79", popular: true  },
        { name: "Triple Meat Burger Combo", desc: "Triple meat burger + fries + drink",                     price: "$14.99", popular: false },
        { name: "Half Pound Burger Combo",  desc: "Half pound burger + fries + drink",                      price: "$14.99", popular: false },
      ]
    },
    {
      category: "Wings",
      icon: "🍗",
      items: [
        { name: "Buffalo Wings",            desc: "Crispy wings tossed in buffalo sauce",                   price: "", popular: true  },
      ]
    },
    {
      category: "Sides",
      icon: "🍟",
      items: [
        { name: "Nachos",                   desc: "Loaded nachos",                                          price: "$4.99", popular: true  },
      ]
    },
    {
      category: "Kids",
      icon: "👦",
      items: [
        { name: "Kids Combo",               desc: "Kid-sized burger combo with fries and drink",            price: "", popular: false },
      ]
    },
    {
      category: "Drinks",
      icon: "🥤",
      items: [
        { name: "Fountain Drinks",          desc: "Coke, Sprite, Dr Pepper, Sweet Tea and more",           price: "", popular: false },
      ]
    },
  ],

};
