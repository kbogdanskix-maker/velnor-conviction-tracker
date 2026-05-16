# Vela Wealth Platform

## Frontend Design Guidelines

When building or redesigning frontend pages, follow these principles to avoid generic "AI slop" aesthetics:

### Typography
- Use distinctive, characterful fonts — avoid generic choices like Inter, Roboto, Arial
- Pair a display font with a refined body font
- Current stack uses Geist with tabular-nums for financial figures

### Color & Theme
- Commit to the cohesive Vela dark theme: zinc-950 bg, teal-500 accent, emerald-400 profit, rose-500 loss
- Use CSS variables for consistency
- Dominant colors with sharp accents — not timid, evenly-distributed palettes

### Motion & Interaction
- Add animations for micro-interactions and page transitions
- CSS-only where possible, Motion library for React when needed
- Staggered reveals on page load create more delight than scattered micro-interactions
- Hover states that surprise

### Spatial Composition
- Asymmetry, overlap, diagonal flow where appropriate
- Grid-breaking elements for visual interest
- Generous negative space OR controlled density — be intentional

### Visual Details
- Create atmosphere and depth, not just solid color cards
- Gradient meshes, noise textures, layered transparencies, dramatic shadows
- Every page should feel genuinely designed for its specific purpose

### Anti-patterns to Avoid
- Cookie-cutter card layouts with no visual hierarchy
- Predictable symmetric grids everywhere
- Generic component patterns that could be any app
- Forgetting that financial data needs clear visual hierarchy and scanability
