/**
 * PUBLIC WEBSITE CONTENT - STATIC, EDIT HERE.
 *
 * !! PLACEHOLDER COPY !!  The facilities, rules, about text and location below are generic
 * starter text, NOT verified facts about the hostel. Replace or delete anything that is not true
 * BEFORE the site goes live. No fees appear here on purpose ("Contact for Pricing").
 * Phone/WhatsApp numbers are NOT here: the Warden sets them in Admin > Settings.
 * Never put student or parent data in this file.
 */

export const site = {
  name: "Varindavan Boys Hostel",
  tagline: "A safe, disciplined and caring home for students away from home.",
  shortAbout:
    "Varindavan Boys Hostel gives students a settled place to live and study, with daily evening room checks and clear updates for parents.",
};

export const trustPoints = [
  {
    title: "Daily evening room checks",
    body: "Every evening the Warden visits each room and records who is present, so no student goes unnoticed.",
  },
  {
    title: "Parents stay informed",
    body: "Parents get their own secure Parent Portal with the daily report for their son, and can acknowledge it with one tap.",
  },
  {
    title: "Clear rules, fairly applied",
    body: "A simple code of conduct that every resident and family knows from day one.",
  },
];

export const about = {
  heading: "About the hostel",
  paragraphs: [
    "PLACEHOLDER: Write a short, honest introduction to the hostel here - when it started, who runs it and what kind of students it serves.",
    "PLACEHOLDER: Describe the hostel's approach to discipline, study time and student welfare in a few sentences.",
  ],
  values: [
    { title: "Safety first", body: "Daily checks and a responsible, approachable Warden." },
    { title: "Study-friendly", body: "A calm environment where students can focus." },
    { title: "Honest communication", body: "Parents hear from the hostel regularly and directly." },
  ],
};

export const roomTypes = [
  { name: "Single room", description: "A room for one student, for those who prefer privacy and quiet.", points: ["One student per room", "Bed, study table and storage (confirm)"] },
  { name: "Double room", description: "A room shared by two students, a popular and friendly choice.", points: ["Two students per room", "Beds, study tables and storage (confirm)"] },
];

export const facilities = [
  { title: "Furnished rooms", body: "PLACEHOLDER: Describe the furniture provided in each room." },
  { title: "Study environment", body: "PLACEHOLDER: Study hours, quiet areas or a study room." },
  { title: "Clean washrooms", body: "PLACEHOLDER: Washroom facilities and cleaning routine." },
  { title: "Drinking water", body: "PLACEHOLDER: Drinking water arrangements." },
  { title: "Power and lighting", body: "PLACEHOLDER: Electricity and backup arrangements." },
  { title: "Meals", body: "PLACEHOLDER: Mess or meal arrangements, if any." },
  { title: "Laundry", body: "PLACEHOLDER: Laundry arrangements, if any." },
  { title: "Security", body: "PLACEHOLDER: Gate timings and visitor policy." },
];

export const rules = [
  "PLACEHOLDER: Residents must be inside the hostel by the gate-closing time.",
  "PLACEHOLDER: Evening room checking is held daily; students must be available in their rooms.",
  "PLACEHOLDER: Respect for staff, fellow residents and hostel property is expected at all times.",
  "PLACEHOLDER: Visitors are allowed only at fixed times and with the Warden's permission.",
  "PLACEHOLDER: Smoking, alcohol and other prohibited items are not allowed.",
  "PLACEHOLDER: Prior permission is needed for staying out overnight.",
];

export const location = {
  /** Shown as plain text. */
  address: "PLACEHOLDER: Full hostel address, city and PIN code.",
  landmark: "PLACEHOLDER: Nearby landmark / how to reach us.",
  /** Search text for Google Maps (e.g. "Varindavan Boys Hostel, <area>, <city>"). Leave "" to hide the map. */
  mapsQuery: "",
};

/** Static gallery. Files live in /public/gallery. These are PLACEHOLDER illustrations; swap in real photos. */
export const gallery = [
  { src: "/gallery/room.svg", alt: "Illustration of a hostel room", caption: "Rooms (placeholder image)" },
  { src: "/gallery/study.svg", alt: "Illustration of a study area", caption: "Study area (placeholder image)" },
  { src: "/gallery/corridor.svg", alt: "Illustration of a hostel corridor", caption: "Corridor (placeholder image)" },
  { src: "/gallery/common.svg", alt: "Illustration of a common area", caption: "Common area (placeholder image)" },
  { src: "/gallery/washroom.svg", alt: "Illustration of washroom facilities", caption: "Washrooms (placeholder image)" },
  { src: "/gallery/building.svg", alt: "Illustration of the hostel building", caption: "Building (placeholder image)" },
];

export const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/rooms", label: "Rooms" },
  { href: "/availability", label: "Availability" },
  { href: "/facilities", label: "Facilities" },
  { href: "/rules", label: "Rules" },
  { href: "/gallery", label: "Gallery" },
  { href: "/location", label: "Location" },
  { href: "/contact", label: "Contact" },
];
