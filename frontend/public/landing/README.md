# Landing scenery

The user's follow-up requests visual fidelity to the supplied light/dark reference images, superseding the initial preference for an exclusively vector hero. The backgrounds contain scenery only; typography, brand, navigation, controls and calls to action are live accessible HTML.

Generated with the built-in imagegen tool, then encoded with the existing Next.js Sharp dependency. No runtime dependency was added. Desktop WebP assets are 118 KB / 137 KB; portrait mobile variants are 38 KB / 39 KB. CSS selects only the active theme and viewport asset. The remaining sections retain lightweight SVG artwork.

Final prompt set:

- Dark: Edit the user's original dark cinematic landscape reference. Remove all text, logos, navigation, buttons, side labels and scroll indicator. Preserve the detailed mountainous river valley, tiny city clusters, illuminated network arcs, topographic contours, polygonal peaks, cloudy graphite sky and defocused foreground. Do not simplify into a vector illustration. Output a 16:9 background without UI.
- Light: Edit the selected dark background into its daylight counterpart. Keep camera, mountains, cities, river bends, network arcs and foreground positions. Use warm off-white misty sky, lush green terrain, pale mint/white/teal/lime facets, aqua river and soft morning light. No text, logos or UI.

The institutional logo is not part of these generated assets; it remains the separately sourced original in `../brand/`.
