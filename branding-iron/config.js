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
  address:     "2230 S 77 Sunshine Strip",
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
        { name: "Half Pound Burger",        desc: "Juicy half pound beef patty — build it your way with jalapeños, lettuce, tomato, pickles & more at the condiment bar", price: "", popular: true  },
        { name: "Double Meat Burger",       desc: "Two beef patties stacked high — customize your toppings at the condiment bar",                                          price: "", popular: false },
        { name: "Triple Meat Burger",       desc: "Three patties for the serious burger lover — load it up your way",                                                      price: "", popular: false },
        { name: "Fish Sandwich",            desc: "Crispy golden fish fillet with your choice of toppings",                                                                price: "$6.35", popular: false },
        { name: "Chicken Fried Sandwich",   desc: "Golden fried chicken sandwich — fresh toppings your way",                                                              price: "$6.35", popular: false },
        { name: "Hot Dog",                  desc: "Classic Texas-style hot dog",                                                                                           price: "", popular: false },
      ]
    },
    {
      category: "Combos",
      icon: "🤠",
      items: [
        { name: "Double Meat Burger Combo", desc: "Double meat burger + fries + drink",                           price: "$13.79", popular: true  },
        { name: "Triple Meat Burger Combo", desc: "Triple meat burger + fries + drink",                           price: "$14.99", popular: false },
        { name: "Half Pound Burger Combo",  desc: "Half pound burger + fries + drink",                            price: "$14.99", popular: false },
      ]
    },
    {
      category: "Wings",
      icon: "🍗",
      items: [
        { name: "Buffalo Wings",            desc: "Crispy wings tossed in classic buffalo sauce",                 price: "", popular: true  },
        { name: "Mango Wings",              desc: "Sweet and tangy mango glazed wings",                           price: "", popular: false },
      ]
    },
    {
      category: "Sides",
      icon: "🍟",
      items: [
        { name: "Fries",                    desc: "Classic golden fries",                                         price: "", popular: false },
        { name: "Cheese Fries",             desc: "Fries topped with melted cheese",                              price: "", popular: true  },
        { name: "Seasoned Fries",           desc: "Fries with our signature seasoning blend",                     price: "", popular: false },
        { name: "Sweet Potato Fries",       desc: "Crispy sweet potato fries",                                    price: "", popular: false },
        { name: "Tater Tots",               desc: "Golden crispy tater tots",                                     price: "", popular: false },
        { name: "Onion Rings",              desc: "Golden crispy onion rings",                                    price: "", popular: false },
        { name: "Bacon Fries",              desc: "Fries loaded with crispy bacon",                               price: "", popular: false },
        { name: "Nachos",                   desc: "Loaded nachos",                                                price: "$4.99", popular: false },
      ]
    },
    {
      category: "Kids",
      icon: "👦",
      items: [
        { name: "Kids Combo",               desc: "Kid-sized burger + fries + drink — perfect for the little ones", price: "", popular: false },
      ]
    },
    {
      category: "Drinks",
      icon: "🥤",
      items: [
        { name: "Fountain Drinks",          desc: "Coke, Sprite, Dr Pepper, Sweet Tea and more",                  price: "", popular: false },
        { name: "Milkshakes",              desc: "Thick and creamy milkshakes",                                   price: "", popular: true  },
      ]
    },
  ],

};
