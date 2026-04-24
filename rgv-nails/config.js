const SHOP = {
  name:        "RGV Luxury Nails",
  nameShort:   "RGV Nails",
  tagline:     "Where Luxury Meets Perfection.",
  rating:      "4.6",
  reviews:     "106",
  phone:       "(956) 440-8400",
  phoneRaw:    "9564408400",
  address:     "2021 W Lincoln St Ste B",
  city:        "Harlingen",
  state:       "TX",
  zip:         "78552",

  facebook:    "",
  instagram:   "",

  hours: [
    { day: "Monday",            time: "Closed"                  },
    { day: "Tuesday–Saturday",  time: "9:30 AM – 6:00 PM"      },
    { day: "Sunday",            time: "11:30 AM – 2:00 PM"     },
  ],
  hoursShort: "Tue–Sat 9:30am–6pm · Sun 11:30am–2pm",
  closedDays: [1], // Monday

  colorPrimary: "#c9748f",
  colorGold:    "#c9a96e",
  colorDark:    "#1a0d12",

  logo:   "logo.png",
  heroBg: "hero.jpg",

  services: [
    {
      category: "Nails",
      icon: "💅",
      items: [
        { name: "Acrylic Nails",           desc: "Full set of acrylic nails shaped and polished to perfection"       },
        { name: "Basic Manicure",          desc: "Classic manicure with shaping, cuticle care and polish"            },
        { name: "Deluxe Manicure",         desc: "Upgraded manicure with exfoliation, mask and extended massage"     },
        { name: "Shellac",                 desc: "Long-lasting gel polish that stays chip-free for weeks"            },
        { name: "Dip Nails",               desc: "Dip powder for a durable, lightweight and natural-looking finish"  },
        { name: "Keratin Treatment Nails", desc: "Strengthening keratin treatment for healthier, smoother nails"     },
      ]
    },
    {
      category: "Pedicures",
      icon: "🦶",
      items: [
        { name: "Basic Pedicure",  desc: "Foot soak, nail shaping, cuticle care and polish"                         },
        { name: "Deluxe Pedicure", desc: "Upgraded pedicure with scrub, mask, extended massage and hot towel"       },
      ]
    },
    {
      category: "Waxing",
      icon: "✨",
      items: [
        { name: "Eyebrow Wax",   desc: "Clean and defined brows shaped to your preference"                          },
        { name: "Lip Wax",       desc: "Smooth and clean upper lip waxing"                                          },
        { name: "Full Face Wax", desc: "Complete face waxing for smooth, hair-free skin"                            },
        { name: "Body Waxing",   desc: "Ask us about full body waxing services"                                     },
      ]
    },
    {
      category: "Lashes & Brows",
      icon: "👁️",
      items: [
        { name: "Eyelash Extensions", desc: "Custom lash extensions for a dramatic or natural look"                  },
        { name: "Eyelash Perm",       desc: "Semi-permanent lash lift that curls and opens your eyes"               },
        { name: "Brow Lamination",    desc: "Fluffy, defined brows that stay in place all day"                      },
      ]
    },
  ],

  timeSlots: {
    "Tuesday":   ["9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM"],
    "Wednesday": ["9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM"],
    "Thursday":  ["9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM"],
    "Friday":    ["9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM"],
    "Saturday":  ["9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM"],
    "Sunday":    ["11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM"],
  },
};
