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
      category: "Burgers & Combos",
      icon: "🍔",
      items: [
        { name: "Double Meat Burger Combo",       desc: "Double beef patty burger + fries + drink",                                                    price: "$13.79", popular: true  },
        { name: "Half Pound Burger Combo",         desc: "Juicy half pound beef patty burger + fries + drink",                                         price: "$14.99", popular: false },
        { name: "Triple Meat Burger Combo",        desc: "Triple beef patty burger + fries + drink",                                                   price: "$14.99", popular: false },
        { name: "Phillipe Cheese Sandwich Combo",  desc: "Phillipe cheese sandwich + fries + drink",                                                   price: "$14.99", popular: false },
        { name: "Pulled Pork on Bun Combo",        desc: "Tender pulled pork on a bun + fries + drink",                                               price: "$14.39", popular: false },
        { name: "3 Chicken Strip Combo",           desc: "3 crispy chicken strips + fries + drink",                                                    price: "$13.55", popular: false },
        { name: "Jumbo Hot-Dog Combo",             desc: "Jumbo hot dog + fries + drink",                                                              price: "$11.15", popular: false },
        { name: "Chicken Fried Sandwich",          desc: "Golden fried chicken sandwich with your choice of toppings",                                 price: "$6.35",  popular: false },
        { name: "Fish Sandwich",                   desc: "Crispy golden fish fillet with fresh toppings",                                              price: "$6.35",  popular: false },
      ]
    },
    {
      category: "Wings",
      icon: "🍗",
      items: [
        { name: "Buffalo Wings",                   desc: "Crispy wings tossed in classic buffalo sauce",                                               price: "",       popular: true  },
        { name: "Mango Wings",                     desc: "Sweet and tangy mango glazed wings",                                                         price: "",       popular: false },
      ]
    },
    {
      category: "Sides",
      icon: "🍟",
      items: [
        { name: "Nachos",                          desc: "Loaded nachos with cheese",                                                                  price: "$4.99",  popular: true  },
        { name: "Cheese Sticks",                   desc: "Golden fried mozzarella cheese sticks with dipping sauce",                                  price: "$4.49",  popular: false },
        { name: "Fries",                           desc: "Classic golden fries",                                                                       price: "",       popular: false },
        { name: "Cheese Fries",                    desc: "Fries topped with melted cheese",                                                            price: "",       popular: false },
        { name: "Seasoned Fries",                  desc: "Fries with signature seasoning blend",                                                       price: "",       popular: false },
        { name: "Sweet Potato Fries",              desc: "Crispy sweet potato fries",                                                                  price: "",       popular: false },
        { name: "Tater Tots",                      desc: "Golden crispy tater tots",                                                                   price: "",       popular: false },
        { name: "Onion Rings",                     desc: "Golden crispy onion rings",                                                                  price: "",       popular: false },
        { name: "Bacon Fries",                     desc: "Fries loaded with crispy bacon",                                                             price: "",       popular: false },
      ]
    },
    {
      category: "Kids Combos",
      icon: "👦",
      items: [
        { name: "Kids 4 Count Chicken Nugget",     desc: "4 nuggets + small fries + soda (Cola, Diet Cola, or Lemon-Lime)",                           price: "$5.99",  popular: false },
        { name: "Kids 6 Count Chicken Nugget",     desc: "6 chicken nuggets + small fries + soda (Cola, Diet Cola, or Lemon-Lime)",                   price: "$6.99",  popular: true  },
        { name: "Kids Burger Combo",               desc: "Juicy burger + small fries + soda (Cola, Diet Cola, or Lemon-Lime)",                        price: "$6.99",  popular: false },
        { name: "Kids Burrito Combo",              desc: "Soft tortilla wrap + small fries + soda (Cola, Diet Cola, or Lemon-Lime)",                  price: "$5.99",  popular: false },
        { name: "Kids Corn Dog Combo",             desc: "Mini hotdog in cornmeal batter + small fries + soda (Cola, Diet Cola, or Lemon-Lime)",      price: "$5.99",  popular: false },
        { name: "Kids Hot Dog Combo",              desc: "Hot dog + small fries + soda (Cola, Diet Cola, or Lemon-Lime)",                             price: "$6.99",  popular: false },
      ]
    },
    {
      category: "Drinks",
      icon: "🥤",
      items: [
        { name: "Fountain Drinks",                 desc: "Cola, Diet Cola, Lemon-Lime and more",                                                       price: "",       popular: false },
        { name: "Milkshakes",                      desc: "Thick and creamy milkshakes",                                                                price: "",       popular: true  },
      ]
    },
  ],

};
