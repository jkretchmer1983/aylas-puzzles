import { makeRng } from "@/gen/rng";
import { INSTANCE_CONTENT_POLICY_VERSION, instanceContentKey } from "@/lib/instance-content";
import type { ParcelSubject, RobotBinding } from "./types";

const THEMES: Array<Omit<RobotBinding, "policyVersion" | "instanceId" | "subjects"> & { subjects: ParcelSubject[] }> = [
  {
    themeId: "canyon-explorers",
    title: "The Robot Took a Shortcut",
    story: "Pip the postal robot has a canyon full of curious deliveries. Plan a careful route around the rocks and bring every parcel to its matching yellow pad.",
    mission: "Build a route that delivers every parcel.",
    subjects: [
      { id: "maps", parcel: "star maps", destination: "Mesa Observatory", icon: "⭐", color: "#4f9fd8" },
      { id: "cookies", parcel: "cactus cookies", destination: "Ranger Café", icon: "🍪", color: "#e59b45" },
      { id: "crystals", parcel: "sun crystals", destination: "Solar Station", icon: "💎", color: "#5bc4d9" },
      { id: "paint", parcel: "desert paints", destination: "Artist Arch", icon: "🎨", color: "#e76f51" },
      { id: "seeds", parcel: "wildflower seeds", destination: "Cactus Garden", icon: "🌻", color: "#77a95c" },
    ],
  },
  {
    themeId: "dino-post",
    title: "A Very Dino Delivery",
    story: "A postcard from Dino Valley has sent Pip on a prehistoric postal round. Match each special parcel to its destination without bumping the canyon boulders.",
    mission: "Deliver the dinosaur valley parcels.",
    subjects: [
      { id: "eggs", parcel: "speckled dino eggs", destination: "Hatchery Hollow", icon: "🥚", color: "#8ab661" },
      { id: "ferns", parcel: "fern snacks", destination: "Diplodocus Diner", icon: "🌿", color: "#5b9b62" },
      { id: "fossils", parcel: "amber fossils", destination: "Fossil Museum", icon: "🦴", color: "#c68b55" },
      { id: "helmets", parcel: "explorer helmets", destination: "Ranger Roost", icon: "🪖", color: "#db9b3d" },
      { id: "cameras", parcel: "field cameras", destination: "Lookout Ledge", icon: "📷", color: "#628ba7" },
    ],
  },
  {
    themeId: "space-mail",
    title: "Postcards from the Stars",
    story: "The depot has become a tiny spaceport for the day. Pip needs your directions to send cosmic cargo to the right pads before the next rocket whistles past.",
    mission: "Route every space parcel home.",
    subjects: [
      { id: "cheese", parcel: "moon cheese", destination: "Lunar Lunchroom", icon: "🧀", color: "#e7bc4f" },
      { id: "bolts", parcel: "rocket bolts", destination: "Launch Pad", icon: "🔩", color: "#8b9ead" },
      { id: "charts", parcel: "comet charts", destination: "Star Observatory", icon: "☄️", color: "#8978c8" },
      { id: "helmets-space", parcel: "space helmets", destination: "Astronaut Airlock", icon: "🪖", color: "#df8b4d" },
      { id: "crystals-space", parcel: "nebula crystals", destination: "Gravity Lab", icon: "🔮", color: "#7e8fd4" },
    ],
  },
  {
    themeId: "reef-rescue",
    title: "The Seaside Special",
    story: "A tide of unusual mail has washed into the desert depot. Help Pip match the reef parcels to their yellow destinations and keep every delivery dry.",
    mission: "Deliver every seaside surprise.",
    subjects: [
      { id: "compass", parcel: "pearl compasses", destination: "Coral Lighthouse", icon: "🧭", color: "#4da9ba" },
      { id: "coral", parcel: "coral samples", destination: "Reef Laboratory", icon: "🪸", color: "#ed8a78" },
      { id: "letters", parcel: "seashell letters", destination: "Seashell School", icon: "🐚", color: "#dca98d" },
      { id: "kelp", parcel: "kelp snacks", destination: "Turtle Café", icon: "🥬", color: "#65a573" },
      { id: "pearls", parcel: "singing pearls", destination: "Mermaid Theatre", icon: "🫧", color: "#9c9bd4" },
    ],
  },
  {
    themeId: "inventors",
    title: "The Great Gadget Round",
    story: "The workshop inventors are waiting for wonderfully odd parcels. Program Pip through the stone yard and deliver each gadget part where it belongs.",
    mission: "Complete the inventors’ delivery round.",
    subjects: [
      { id: "gears", parcel: "copper gears", destination: "Clockwork Workshop", icon: "⚙️", color: "#c78443" },
      { id: "batteries", parcel: "robot batteries", destination: "Charging Station", icon: "🔋", color: "#73a95e" },
      { id: "blueprints", parcel: "invention blueprints", destination: "Idea Laboratory", icon: "📐", color: "#5899c6" },
      { id: "springs", parcel: "bouncy springs", destination: "Toy Foundry", icon: "🌀", color: "#a07fc1" },
      { id: "lamps", parcel: "glow lamps", destination: "Lighthouse Loft", icon: "💡", color: "#e2af44" },
    ],
  },
];

function storageGet(key: string) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* private mode */ }
}

/** Stable per instance; recent themes rotate without changing a resumed puzzle. */
export function robotBinding(instanceSeed: number, band: number): RobotBinding {
  const key = instanceContentKey("robot", band, instanceSeed);
  const cacheKey = `robot-binding:${key}`;
  const cached = storageGet(cacheKey);
  if (cached) {
    try { return JSON.parse(cached) as RobotBinding; } catch { /* rebuild below */ }
  }
  const recentKey = "robot-recent-themes:v1";
  let recent: string[] = [];
  try { recent = JSON.parse(storageGet(recentKey) || "[]") as string[]; } catch { /* ignore */ }
  const rng = makeRng(instanceSeed ^ (band * 7919));
  const start = rng.int(0, THEMES.length - 1);
  let theme = THEMES[start]!;
  for (let i = 0; i < THEMES.length; i++) {
    const candidate = THEMES[(start + i) % THEMES.length]!;
    if (!recent.slice(0, 2).includes(candidate.themeId)) { theme = candidate; break; }
  }
  const subjects = rng.shuffle(theme.subjects);
  const binding: RobotBinding = {
    policyVersion: INSTANCE_CONTENT_POLICY_VERSION,
    instanceId: key,
    themeId: theme.themeId,
    title: theme.title,
    story: theme.story,
    mission: theme.mission,
    subjects,
  };
  storageSet(cacheKey, JSON.stringify(binding));
  storageSet(recentKey, JSON.stringify([theme.themeId, ...recent.filter(id => id !== theme.themeId)].slice(0, 4)));
  return binding;
}

export function robotArtPrompt(title: string, story: string, imagePrompt: string) {
  return `A single warm cinematic story illustration for Ayla's Puzzles, matching a polished cream-and-orange postal robot in a sunny red-rock desert depot. Show the exact story subjects and destinations as readable objects, not a solution or route. No text, letters, numbers, grid, command arrows or interface. Story: ${title}. ${story}. Artist details: ${imagePrompt}`.slice(0, 1490);
}
