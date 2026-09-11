# SpaceDaze

## Build profiles

- `npm run build` creates the complete game in `dist/`.
- `npm run build:demo` creates the limited demo in `dist-demo/`.
- `npm run dev:demo` runs the demo profile locally.
- `npm run preview:demo` previews the compiled demo.

The demo profile is configured through `.env.demo` and centralized in
`src/config/buildProfile.ts`. It contains Floor 1's three sublevels and caps hub
progression at Level 3. Clearing the third sublevel ends the run with the demo
completion screen.
