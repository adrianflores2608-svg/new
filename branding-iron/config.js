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
  hoursShort:  "Mon–Sun 10am–10pm",
  hours: [
    { day: "Monday–Thursday", time: "10:00 AM – 10:00 PM" },
    { day: "Friday–Saturday", time: "10:00 AM – 11:00 PM" },
    { day: "Sunday",          time: "11:00 AM – 9:00 PM"  },
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
        { name: "The Branding Iron",   desc: "Double smash patty, cheddar, caramelized onions, house sauce",  price: "$12.99", popular: true  },
        { name: "Texas BBQ Burger",    desc: "Smoked brisket, BBQ sauce, onion rings, pepper jack",           price: "$13.99", popular: false },
        { name: "Classic Smash",       desc: "Single smash patty, American cheese, pickles, mustard",        price: "$9.99",  popular: false },
        { name: "Jalapeño Inferno",    desc: "Double patty, jalapeños, ghost pepper sauce, pepper jack",     price: "$13.99", popular: false },
        { name: "Mushroom Swiss",      desc: "Sautéed mushrooms, Swiss cheese, garlic aioli",                price: "$11.99", popular: false },
      ]
    },
    {
      category: "Sides",
      icon: "🍟",
      items: [
        { name: "Loaded Fries",        desc: "Crispy fries, cheese sauce, bacon, jalapeños",                 price: "$6.99",  popular: true  },
        { name: "Onion Rings",         desc: "Beer battered, golden crispy",                                 price: "$5.99",  popular: false },
        { name: "Regular Fries",       desc: "Seasoned with our Texas blend",                                price: "$3.99",  popular: false },
        { name: "Coleslaw",            desc: "House-made creamy coleslaw",                                   price: "$2.99",  popular: false },
      ]
    },
    {
      category: "Drinks",
      icon: "🥤",
      items: [
        { name: "Fountain Drinks",     desc: "Coke, Sprite, Dr Pepper, Sweet Tea",                          price: "$2.99",  popular: false },
        { name: "Milkshakes",          desc: "Vanilla, Chocolate, Strawberry",                              price: "$5.99",  popular: true  },
        { name: "Lemonade",            desc: "Fresh squeezed, regular or strawberry",                       price: "$3.99",  popular: false },
      ]
    },
    {
      category: "Combos",
      icon: "🤠",
      items: [
        { name: "Classic Combo",       desc: "Any burger + fries + drink",                                  price: "$14.99", popular: true  },
        { name: "Family Pack",         desc: "4 burgers + 4 fries + 4 drinks",                              price: "$49.99", popular: false },
        { name: "Kids Meal",           desc: "Small burger + small fries + drink + toy",                    price: "$7.99",  popular: false },
      ]
    },
  ],

};
