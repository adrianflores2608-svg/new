/* ============================================================
   BARBERSHOP WEBSITE CONFIG
   To reuse for a new client — only edit THIS file.
   ============================================================ */

const SHOP = {

  // ── Business Info ──────────────────────────────────────────
  name:        "Notorious Cutz",
  tagline:     "Sharp cuts. Clean fades. Classic shaves. Walk out feeling your best.",
  est:         "2016",
  rating:      "4.9",
  phone:       "(956) 873-2957",
  phoneRaw:    "9568732957",
  address:     "201B North Sam Houston",
  city:        "San Benito",
  state:       "TX",
  zip:         "78586",

  // ── Social ─────────────────────────────────────────────────
  facebook:    "https://www.facebook.com/share/18FXdneorz/?mibextid=wwXIfr",
  instagram:   "",   // add Instagram URL here when ready

  // ── Hours ──────────────────────────────────────────────────
  hours: [
    { day: "Monday",    open: false },
    { day: "Tuesday",   open: true,  time: "11:00 AM – 8:00 PM" },
    { day: "Wednesday", open: true,  time: "11:00 AM – 8:00 PM" },
    { day: "Thursday",  open: true,  time: "11:00 AM – 8:00 PM" },
    { day: "Friday",    open: true,  time: "11:00 AM – 8:00 PM" },
    { day: "Saturday",  open: true,  time: "11:00 AM – 8:00 PM" },
    { day: "Sunday",    open: false },
  ],
  hoursShort:  "Tue–Sat 11am–8pm",

  // ── Colors ─────────────────────────────────────────────────
  // Change these two lines to instantly retheme the whole site
  colorPrimary: "#dc2020",   // main accent color (red)
  colorHover:   "#ff3b3b",   // hover/light version

  // ── Images ─────────────────────────────────────────────────
  logo:       "logo.png",
  shopPhoto:  "IMG_7025.jpeg",   // used as section background
  gallery: [
    { file: "IMG_7027.jpeg", label: "Taper Fade" },
    { file: "IMG_7026.jpeg", label: "Crop Fade"  },
    { file: "IMG_7023.jpeg", label: "Kids Fade"  },
    { file: "IMG_7024.jpeg", label: "Skin Fade"  },
    { file: "IMG_7025.jpeg", label: "The Shop"   },
  ],

  // ── Services ───────────────────────────────────────────────
  services: [
    { icon: "✂",  name: "Classic Haircut",       desc: "Scissor or clipper cut, tailored to your style",      price: "$20", duration: "30 min", featured: false },
    { icon: "👑",  name: "Skin Fade",             desc: "Zero to skin fade with a clean finish every time",    price: "$25", duration: "40 min", featured: true  },
    { icon: "🧔",  name: "Beard Trim & Shape",    desc: "Line-up, shape, and hot towel finish",                price: "$15", duration: "20 min", featured: false },
    { icon: "🌞",  name: "Cut + Beard Combo",     desc: "Full haircut plus beard trim — best value",           price: "$35", duration: "55 min", featured: false },
    { icon: "👦",  name: "Kids Cut (12 & under)", desc: "Patient, friendly cuts for the little ones",         price: "$15", duration: "25 min", featured: false },
    { icon: "✨",  name: "Hot Towel Shave",       desc: "Traditional straight razor shave with hot towel",    price: "$30", duration: "45 min", featured: false },
  ],

  // ── Booking Time Slots ─────────────────────────────────────
  timeSlots: [
    "11:00 AM","11:30 AM","12:00 PM","12:30 PM",
    "1:00 PM","1:30 PM","2:00 PM","2:30 PM",
    "3:00 PM","3:30 PM","4:00 PM","4:30 PM",
    "5:00 PM","5:30 PM","6:00 PM","6:30 PM",
    "7:00 PM","7:30 PM","8:00 PM"
  ],

  // ── Closed Days (0=Sun, 1=Mon) ─────────────────────────────
  closedDays: [0, 1],

  // ── Deposit ────────────────────────────────────────────────
  depositAmount: "$10",

  // ── Barbers ────────────────────────────────────────────────
  barbers: [
    { value: "any",   label: "No Preference (First Available)" },
    { value: "owner", label: "Owner / Head Barber" },
  ],

};
