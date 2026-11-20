import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowRight, Check, Clock3, LoaderCircle, Play, RotateCcw, X } from "lucide-react";
import { playForestSound, setForestSoundEnabled } from "@/lib/forest-audio";
import { playAllNote } from "@/lib/play-all";
import { roleAdapterResolver } from "@/host/eligibility";
import { publicGameById } from "@/host/public-games";
import { consumeMenuReturn, readPreferredBand, saveMenuReturn, savePreferredBand, type MenuReturnState } from "@/lib/menu-state";
import { claimMenuScroll, isInitialPageRender } from "@/lib/scroll-ownership";
import {
  PUBLIC_BANDS,
  bandById,
  gamesForBand,
  playableGamesForBand,
  type CatalogGame,
} from "@/lib/public-catalog";
import { refreshCatalog, useCatalog, useManifestStatus, useRegistry } from "@/lib/catalog-store";
import { HOST_ROLE } from "@/host/config";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import sceneLandscape from "@/assets/stacked/stacked-worlds-landscape.webp.asset.json";
import scenePortrait from "@/assets/stacked/stacked-worlds-portrait.webp.asset.json";
import scenePhoneTall from "@/assets/stacked/stacked-worlds-phone-tall.webp.asset.json";
import { SCENE_DRIFT_BOOT, useSceneParallax } from "@/lib/scene-parallax";
import { AgeDropdown } from "@/components/commons/AgeDropdown";
import "@fontsource/baloo-2/800.css";
import "@/puzzle-commons.css";

type HomeSearch = { band?: number | undefined; pick?: 1 | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const band = Number(search.band);
    return {
      band: Number.isInteger(band) && band >= 1 && band <= 6 ? band : undefined,
      pick: search.pick ? 1 : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Ayla’s Puzzles — Every puzzle has a story." },
      { name: "description", content: "Choose an age and find something worth figuring out: story puzzle adventures for curious kids." },
      { property: "og:title", content: "Ayla’s Puzzles — Every puzzle has a story." },
      { property: "og:description", content: "Choose an age and find something worth figuring out: story puzzle adventures for curious kids." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PuzzleCommons,
});

function PuzzleCommons() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [band, setBand] = useState(search.band ?? 3);
  const catalog = useCatalog();
  const registry = useRegistry();
  // Role-aware playability: master build = installed adapters; production hub = available + registered host.
  const resolveAdapter = useMemo(() => roleAdapterResolver(catalog, registry), [catalog, registry]);
  const [preview, setPreview] = useState<CatalogGame>();
  const [quickBar, setQuickBar] = useState(false);
  const dockRef = useRef<HTMLElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  useSceneParallax(sceneRef);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const selectedBand = bandById(band);
  const games = useMemo(() => gamesForBand(catalog, band, resolveAdapter), [catalog, band, resolveAdapter]);
  const manifestStatus = useManifestStatus();
  // Hub: until this load's release registry is known (first visit, slow or failed fetch), published games are
  // "checking", never mislabelled Coming soon; they only become playable from the real registry.
  const registryUnknown = HOST_ROLE === "hub" && manifestStatus !== "fresh" && Object.keys(registry.games).length === 0;
  const ready = games.filter((game) => game.adapter);
  const checking = registryUnknown ? games.filter((game) => !game.adapter && game.release === "available") : [];
  const upcoming = games.filter((game) => !game.adapter && !checking.includes(game));
  const playable = useMemo(() => playableGamesForBand(catalog, band, resolveAdapter), [catalog, band, resolveAdapter]);

  useEffect(() => {
    if (search.band) setBand(search.band);
    else {
      const saved = readPreferredBand();
      if (saved) setBand(saved);
    }
  }, [search.band]);

  useEffect(() => { savePreferredBand(band); }, [band]);
  useEffect(() => {
    try { setForestSoundEnabled(localStorage.getItem("forest-sound") !== "off"); } catch { setForestSoundEnabled(true); }
  }, []);

  // Offline and private-dashboard responses keep the last valid catalog.
  useEffect(() => { void refreshCatalog(true); }, []);

  // Return from a game: restore the saved menu position exactly once, before paint, for the age it was saved
  // with. A deliberate age choice or the visitor's own wheel/touch/key scrolling cancels a pending restore, and
  // on a full page load a scroll already made before hydration wins.
  const pendingReturn = useRef<MenuReturnState | undefined>(undefined);
  useLayoutEffect(() => {
    const saved = consumeMenuReturn();
    if (!saved || (isInitialPageRender() && window.scrollY > 0)) return;
    pendingReturn.current = saved;
    claimMenuScroll();
    const drop = () => { pendingReturn.current = undefined; };
    const options = { passive: true, once: true } as const;
    window.addEventListener("wheel", drop, options);
    window.addEventListener("touchstart", drop, options);
    window.addEventListener("keydown", drop, options);
    return () => {
      window.removeEventListener("wheel", drop);
      window.removeEventListener("touchstart", drop);
      window.removeEventListener("keydown", drop);
    };
  }, []);
  useLayoutEffect(() => {
    const saved = pendingReturn.current;
    if (!saved || saved.band !== band) return;
    pendingReturn.current = undefined;
    window.scrollTo({ top: saved.scrollY, behavior: "instant" });
  }, [band]);

  // Compact age bar appears once the in-flow dock has slid up behind the place the bar occupies (just under the
  // protected sign, where the canopy hides the dock). Both bar and dock are out of/fixed in layout and move
  // monotonically with scroll, so toggling this cannot change page height or bounce across the threshold.
  useEffect(() => {
    const dock = dockRef.current;
    const quick = quickRef.current;
    if (!dock || !quick) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const railTop = quick.parentElement?.getBoundingClientRect().top ?? 0;
      setQuickBar(dock.getBoundingClientRect().bottom <= railTop + quick.offsetHeight);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);

  const chooseBand = (next: number) => {
    pendingReturn.current = undefined;
    setBand(next);
    savePreferredBand(next);
    void navigate({ to: "/", search: { band: next }, replace: true, resetScroll: false });
  };

  // Menu card = single-game session; Play all = shuffled no-repeat session. The session shell owns the
  // queue and the one prepared next instance; the menu keeps age and scroll for Back.
  const launch = (game: CatalogGame) => {
    const current = playableGamesForBand(catalog, band, resolveAdapter).find((item) => item.id === game.id);
    const gameId = current?.adapter?.templateId;
    if (!gameId || !publicGameById(gameId)) return;
    saveMenuReturn(band, window.scrollY);
    playForestSound("tap");
    void navigate({ to: "/session", search: { band, mode: "single", game: gameId } });
  };

  const playAll = () => {
    if (!playable.length) return;
    saveMenuReturn(band, window.scrollY);
    playForestSound("tap");
    void navigate({ to: "/session", search: { band, mode: "all" } });
  };

  const openPreview = (game: CatalogGame, trigger: HTMLButtonElement) => {
    previewTrigger.current = trigger;
    setPreview(game);
  };
  const closePreview = () => {
    setPreview(undefined);
    requestAnimationFrame(() => previewTrigger.current?.focus({ preventScroll: true }));
  };

  const onAgeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % PUBLIC_BANDS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + PUBLIC_BANDS.length) % PUBLIC_BANDS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = PUBLIC_BANDS.length - 1;
    else return;
    event.preventDefault();
    const selected = PUBLIC_BANDS[next];
    if (!selected) return;
    const id = selected.id;
    chooseBand(id);
    document.getElementById(`age-tab-${id}`)?.focus();
  };

  return <main className="puzzle-commons">
    {/* Top canopy: the exact top slice of the same scene (same art, scale and drift) laid over the scrolling
        content, opaque through the hanging sign and softly fading below it, so content melts into the scene
        before it reaches the sign. Placed before the scene so the server-booted driver already finds it. */}
    <div className="commons-canopy" data-scene-follow aria-hidden="true" suppressHydrationWarning><SceneArt /></div>
    <div ref={sceneRef} className="commons-scene" aria-hidden="true" suppressHydrationWarning>
      <SceneArt priority />
      <span className="commons-scene-travel" />
      <span className="commons-scene-vh" />
      {/* Runs during HTML parse so the drift is right even if the visitor scrolls before hydration; the hook adopts it. */}
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCENE_DRIFT_BOOT }} />
    </div>
    <section className="commons-hero" aria-labelledby="commons-title">
      <div className="commons-hero-copy">
        {/* The hanging logo is painted into the scene; this names it for assistive tech. */}
        <p className="commons-visually-hidden">Ayla’s Puzzles</p>
        <h1 id="commons-title"><span className="commons-h1-line">Every puzzle</span> <span className="commons-h1-line">has a story.</span></h1>
        <p className="commons-tagline">Choose an age and find something worth figuring out.</p>
      </div>
    </section>

    <section ref={dockRef} className="commons-age-dock" aria-label="Choose your age">
      <div className="commons-age-main">
        <h2 id="age-label">Choose your age</h2>
        {/* Landscape: all six ages as tabs. Portrait (any width): one tactile dropdown. CSS shows one by orientation. */}
        <div className="commons-age-tabs" role="tablist" aria-labelledby="age-label">
          {PUBLIC_BANDS.map((item, index) => <button
            key={item.id}
            id={`age-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={band === item.id}
            aria-controls="commons-catalog"
            tabIndex={band === item.id ? 0 : -1}
            className="commons-age-tab"
            onClick={() => chooseBand(item.id)}
            onKeyDown={(event) => onAgeKeyDown(event, index)}
          >{band === item.id && <Check aria-hidden="true" />}{item.label}</button>)}
        </div>
        <AgeDropdown idPrefix="age-select" band={band} onChoose={chooseBand} labelId="age-label" />
      </div>
    </section>

    {/* The rail rides just below the protected sign (it follows the scene drift); the bar itself only shows/hides. */}
    <div className="commons-age-quick-rail" data-scene-follow suppressHydrationWarning>
    <div ref={quickRef} className={`commons-age-quick${quickBar ? " is-shown" : ""}`} inert={!quickBar} aria-hidden={!quickBar}>
      <div className="commons-age-quick-inner">
        <div className="commons-age-quick-tabs" role="group" aria-label="Quick age choice">
          {PUBLIC_BANDS.map((item) => <button
            key={item.id}
            type="button"
            aria-pressed={band === item.id}
            className="commons-age-tab"
            onClick={() => chooseBand(item.id)}
          >{band === item.id && <Check aria-hidden="true" />}{item.label}</button>)}
        </div>
        <AgeDropdown idPrefix="age-quick" band={band} onChoose={chooseBand} label="Choose your age" closed={!quickBar} />
      </div>
    </div>
    </div>

    <div id="commons-catalog" role="tabpanel" aria-labelledby={`age-tab-${band}`} className="commons-catalog">
      <p className="commons-result" aria-live="polite">{games.length} puzzle {games.length === 1 ? "adventure" : "adventures"} for ages {selectedBand.min}–{selectedBand.max}</p>
      <section aria-labelledby="ready-heading" className="commons-section">
        <div className="commons-section-heading ready"><span aria-hidden="true" /><h2 id="ready-heading">Ready to play</h2><span aria-hidden="true" /></div>
        {ready.length > 0 && <div className="commons-play-all-row">
          <button className="commons-play-all" type="button" onClick={playAll} disabled={!playable.length} aria-describedby="play-all-note">
            <Play aria-hidden="true" fill="currentColor" />Play all<ArrowRight aria-hidden="true" />
          </button>
          <p id="play-all-note" className={`commons-play-all-note${playable.length === 1 ? " is-single" : ""}`}>{playAllNote(playable, selectedBand)}</p>
        </div>}
        {ready.length ? <div className="commons-grid" style={{ "--n": Math.min(ready.length, 5) } as CSSProperties}>{ready.map((game) => <GameCard key={game.id} game={game} onPlay={() => launch(game)} onPreview={openPreview} />)}</div>
          : checking.length ? <>
            <p className="commons-empty" role="status">{manifestStatus === "failed" ? "We couldn’t check which adventures are ready. Check your connection and try again." : "Checking which adventures are ready…"}</p>
            <div className="commons-grid" style={{ "--n": Math.min(checking.length, 5) } as CSSProperties}>{checking.map((game) => <GameCard key={game.id} game={game} checking={manifestStatus === "failed" ? "failed" : "pending"} onPlay={() => void refreshCatalog(true)} onPreview={openPreview} />)}</div>
          </>
          : <p className="commons-empty">These adventures are still being prepared. Try another age for a game ready now.</p>}
      </section>
      <section aria-labelledby="coming-heading" className="commons-section coming">
        <div className="commons-section-heading"><span aria-hidden="true" /><h2 id="coming-heading">Coming soon</h2><span aria-hidden="true" /></div>
        {upcoming.length ? <div className="commons-grid" style={{ "--n": Math.min(upcoming.length, 5) } as CSSProperties}>{upcoming.map((game) => <GameCard key={game.id} game={game} onPlay={() => launch(game)} onPreview={openPreview} />)}</div> : <p className="commons-empty">Every adventure for this age is ready to play!</p>}
      </section>
    </div>

    <footer className="commons-footer"><span>Ayla’s Puzzles</span><p>A little thinking. A lot of adventure.</p></footer>

    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) closePreview(); }}>
      <DialogContent className="commons-preview" showCloseButton={false}>
        {preview && <>
          <DialogTitle>{preview.name}</DialogTitle>
          <DialogDescription>{preview.description}</DialogDescription>
          <div className="commons-preview-art"><img src={preview.thumbnailUrl} alt={`Preview illustration for ${preview.name}`} /></div>
          <p className="commons-preview-ages">For ages {preview.minAge}–{preview.maxAge}</p>
          <div className="commons-preview-status"><Clock3 aria-hidden="true" />Coming soon</div>
          <button type="button" className="commons-preview-close" autoFocus onClick={closePreview}><X aria-hidden="true" />Close</button>
        </>}
      </DialogContent>
    </Dialog>
  </main>;
}

/** The approved Stacked Worlds scene, logo included; portrait recompose for portrait screens, tall scene for narrow phones. */
function SceneArt({ priority = false }: { priority?: boolean }) {
  return <picture>
    {/* Must match the narrow-phone media query in puzzle-commons.css. */}
    <source media="(orientation: portrait) and (max-aspect-ratio: 2/3)" srcSet={scenePhoneTall.url} width={772} height={1920} />
    <source media="(orientation: portrait)" srcSet={scenePortrait.url} width={1086} height={1448} />
    <img src={sceneLandscape.url} width={1536} height={1024} alt="" fetchPriority={priority ? "high" : "auto"} decoding="async" />
  </picture>;
}

function GameCard({ game, onPlay, onPreview, checking }: { game: CatalogGame; onPlay: () => void; onPreview: (game: CatalogGame, trigger: HTMLButtonElement) => void; checking?: "pending" | "failed" | undefined }) {
  if (checking) return <article className="commons-card is-upcoming">
    <div className="commons-card-copy"><p className="commons-card-age">Ages {game.minAge}–{game.maxAge}</p><h3>{game.name}</h3><p>{game.description}</p></div>
    <div className="commons-thumbnail"><img src={game.thumbnailUrl} alt="" loading="lazy" decoding="async" draggable={false} /></div>
    {checking === "failed"
      ? <button type="button" className="commons-card-action soon" onClick={onPlay} aria-label={`Try again to check ${game.name}`}><RotateCcw aria-hidden="true" />Try again</button>
      : <button type="button" className="commons-card-action soon" disabled aria-label={`Checking ${game.name}`}><LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Checking…</button>}
  </article>;
  return <article className={`commons-card ${game.adapter ? "is-playable" : "is-upcoming"}`}>
    <div className="commons-card-copy"><p className="commons-card-age">Ages {game.minAge}–{game.maxAge}</p><h3>{game.name}</h3><p>{game.description}</p></div>
    {/* Real catalog thumbnail at its own ratio: no crop, no blurred fill. */}
    <div className="commons-thumbnail"><img src={game.thumbnailUrl} alt="" loading="lazy" decoding="async" draggable={false} /></div>
    {game.adapter ? <button type="button" className="commons-card-action play" onClick={onPlay} aria-label={`Play ${game.name}`}><Play aria-hidden="true" fill="currentColor" />Play</button> : <button type="button" className="commons-card-action soon" onClick={(event) => onPreview(game, event.currentTarget)} aria-label={`Preview ${game.name}, coming soon`}><Clock3 aria-hidden="true" />Coming soon</button>}
  </article>;
}
