/* Exact dashboard-selected thumbnails, served as immutable CDN assets.
 * Keyed by the bundled filename a catalog record names in `thumbnail`, never by game ID,
 * so choosing a different dashboard thumbnail changes the picture shown. */
import v1_count from "@/assets/catalog/v1-count.jpg.asset.json";
import v1_odd from "@/assets/catalog/v1-odd.jpg.asset.json";
import v1_groups from "@/assets/catalog/v1-groups.jpg.asset.json";
import v1_sides from "@/assets/catalog/v1-sides.jpg.asset.json";
import v1_riddle from "@/assets/catalog/v1-riddle.jpg.asset.json";
import v1_sudoku from "@/assets/catalog/v1-sudoku.jpg.asset.json";
import v1_pattern from "@/assets/catalog/v1-pattern.jpg.asset.json";
import v1_add from "@/assets/catalog/v1-add.jpg.asset.json";
import v1_take from "@/assets/catalog/v1-take.jpg.asset.json";
import v1_size from "@/assets/catalog/v1-size.jpg.asset.json";
import v1_sequence from "@/assets/catalog/v1-sequence.jpg.asset.json";
import v1_lineup from "@/assets/catalog/v1-lineup.jpg.asset.json";
import v1_coins from "@/assets/catalog/v1-coins.jpg.asset.json";
import v1_balance from "@/assets/catalog/v1-balance.jpg.asset.json";
import v1_magic from "@/assets/catalog/v1-magic.jpg.asset.json";
import v1_nim from "@/assets/catalog/v1-nim.jpg.asset.json";
import v1_clock from "@/assets/catalog/v1-clock.jpg.asset.json";
import v1_evenodd from "@/assets/catalog/v1-evenodd.jpg.asset.json";
import v1_cipher from "@/assets/catalog/v1-cipher.jpg.asset.json";
import v1_position from "@/assets/catalog/v1-position.jpg.asset.json";
import v1_colors from "@/assets/catalog/v1-colors.jpg.asset.json";
import v1_shapepick from "@/assets/catalog/v1-shapepick.jpg.asset.json";
import v1_double from "@/assets/catalog/v1-double.jpg.asset.json";
import v1_share from "@/assets/catalog/v1-share.jpg.asset.json";
import v1_missing from "@/assets/catalog/v1-missing.jpg.asset.json";
import v1_days from "@/assets/catalog/v1-days.jpg.asset.json";
import v1_legs from "@/assets/catalog/v1-legs.jpg.asset.json";
import v1_change from "@/assets/catalog/v1-change.jpg.asset.json";
import v1_fraction from "@/assets/catalog/v1-fraction.jpg.asset.json";
import v2_trains from "@/assets/catalog/v2-trains.jpg.asset.json";
import v2_robot from "@/assets/catalog/v2-robot.jpg.asset.json";
import v2_curiosity from "@/assets/catalog/v2-curiosity.jpg.asset.json";
import v2_sofa from "@/assets/catalog/v2-sofa.jpg.asset.json";
import v2_waterway from "@/assets/catalog/v2-waterway.jpg.asset.json";
import v2_suitcase from "@/assets/catalog/v2-suitcase.jpg.asset.json";
import v2_seating from "@/assets/catalog/v2-seating.jpg.asset.json";
import v2_rooftop from "@/assets/catalog/v2-rooftop.jpg.asset.json";
import v2_moon from "@/assets/catalog/v2-moon.jpg.asset.json";
import v2_one_sofa from "@/assets/catalog/v2-one-sofa.jpg.asset.json";
import v2_bridge from "@/assets/catalog/v2-bridge.jpg.asset.json";
import v2_dinosaur from "@/assets/catalog/v2-dinosaur.jpg.asset.json";

export const CATALOG_THUMBNAILS: Readonly<Record<string, string>> = {
  "v1-count.jpg": v1_count.url,
  "v1-odd.jpg": v1_odd.url,
  "v1-groups.jpg": v1_groups.url,
  "v1-sides.jpg": v1_sides.url,
  "v1-riddle.jpg": v1_riddle.url,
  "v1-sudoku.jpg": v1_sudoku.url,
  "v1-pattern.jpg": v1_pattern.url,
  "v1-add.jpg": v1_add.url,
  "v1-take.jpg": v1_take.url,
  "v1-size.jpg": v1_size.url,
  "v1-sequence.jpg": v1_sequence.url,
  "v1-lineup.jpg": v1_lineup.url,
  "v1-coins.jpg": v1_coins.url,
  "v1-balance.jpg": v1_balance.url,
  "v1-magic.jpg": v1_magic.url,
  "v1-nim.jpg": v1_nim.url,
  "v1-clock.jpg": v1_clock.url,
  "v1-evenodd.jpg": v1_evenodd.url,
  "v1-cipher.jpg": v1_cipher.url,
  "v1-position.jpg": v1_position.url,
  "v1-colors.jpg": v1_colors.url,
  "v1-shapepick.jpg": v1_shapepick.url,
  "v1-double.jpg": v1_double.url,
  "v1-share.jpg": v1_share.url,
  "v1-missing.jpg": v1_missing.url,
  "v1-days.jpg": v1_days.url,
  "v1-legs.jpg": v1_legs.url,
  "v1-change.jpg": v1_change.url,
  "v1-fraction.jpg": v1_fraction.url,
  "v2-trains.jpg": v2_trains.url,
  "v2-robot.jpg": v2_robot.url,
  "v2-curiosity.jpg": v2_curiosity.url,
  "v2-sofa.jpg": v2_sofa.url,
  "v2-waterway.jpg": v2_waterway.url,
  "v2-suitcase.jpg": v2_suitcase.url,
  "v2-seating.jpg": v2_seating.url,
  "v2-rooftop.jpg": v2_rooftop.url,
  "v2-moon.jpg": v2_moon.url,
  "v2-one-sofa.jpg": v2_one_sofa.url,
  "v2-bridge.jpg": v2_bridge.url,
  "v2-dinosaur.jpg": v2_dinosaur.url,
};
