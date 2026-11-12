# The Flash Electric

Redesigned homepage for theflashelectric.com: a wet-glass storm theme with fluid glass buttons and a spinning 3D lightning bolt (WebGL, reads `assets/3d/scene.bin`).

Static site, no build step. Serve the folder with any static host (for example `python3 -m http.server`) and open `index.html`.

- `index.html`: page, SEO metadata and JSON-LD
- `css/`: tokens, base and page styles
- `js/bolt.js`: 3D bolt renderer; `js/main.js`: forms, reviews, offer dialog
- `assets/`: logo, bolt model (glTF and bin) and poster fallback
- `SEO-AUDIT.md`: audit notes and follow-ups

The contact form has no endpoint yet (`data-endpoint` on `#estimate`); until one is set it opens the visitor's email app.

3D model: "Thunderstorm, Lightning Bolt -Thunder Strike" by maherqassem87 (https://sketchfab.com/maherqassem87), licensed CC-BY-4.0.
