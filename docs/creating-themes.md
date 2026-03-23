# Contribution Lands Sprite Generation Guide

> Complete prompt guide for generating all isometric sprites using Gemini (Nano Banana) or Midjourney.

---

## Critical Rules Before You Start

### 1. Transparency Workaround (IMPORTANT)
Nano Banana / Gemini **cannot generate true transparent PNGs**. You must use the **green chroma key method**:

- Request `#00FF00` (pure green) background in every prompt
- Request a **2-3px white outline** around the sprite
- After generation, remove the green background using:
  - Photoshop: Select > Color Range > green > delete
  - Free tool: [remove.bg](https://remove.bg) or GIMP (Select by Color)
  - Script: HSV-based detection (hue ±22°, saturation ≥0.3, value ≥0.3)

### 2. Consistency Across Generations
- **Always include the same style anchor** in every prompt (e.g., "SimCity 2000 aesthetic, low-poly 3D render")
- Generate all sprites for ONE theme in the same session/conversation
- Generate **3-5 variations** per level, pick the most consistent ones
- Keep the same lighting direction: **top-left light source**

### 3. Perspective Lock
- True isometric = **30° from horizontal** (not 45°)
- Always specify: `"strict isometric projection, 2:1 pixel ratio"` or `"dimetric 30-degree angle"`
- The phrase "45-degree top-down" actually produces a steeper bird's-eye view — avoid it

### 4. Size & Format
- Request: `"single isolated object, centered, 256x256 pixels"` (you'll downscale later)
- Generate large, scale down — preserves detail better than generating small

---

## Prompt Template Structure

```
[PERSPECTIVE] + [SUBJECT] + [SIZE/LEVEL DESCRIPTOR] + [STYLE] + [BACKGROUND] + [CONSTRAINTS]
```

Every prompt should follow this pattern:

```
"Strict isometric projection, 2:1 ratio. [SUBJECT DESCRIPTION].
Low-poly 3D render, clean colors, warm lighting from top-left,
SimCity 2000 / RollerCoaster Tycoon game asset style.
Single isolated object centered on solid #00FF00 chroma green background.
White 2px outline around the object. No ground shadow. No text. No labels."
```

---

## THEME 1: Summer Forest

### Level 0 — Empty Ground
```
Strict isometric projection, 2:1 ratio. A small square patch of lush green
grass with a few tiny wildflowers and small stones. Flat ground tile, no trees,
no tall objects. Low-poly 3D render, clean colors, warm summer lighting from
top-left, SimCity 2000 game asset style. Single isolated tile centered on solid
#00FF00 chroma green background. White 2px outline around the object.
No ground shadow. No text.
```

### Level 1 — Small Sapling (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A tiny young sapling tree, very small,
only about 1 foot tall, thin stem with a few small green leaves. Planted in a
small patch of grass. Low-poly 3D render, clean colors, warm summer lighting
from top-left, SimCity 2000 game asset style. Single isolated object centered
on solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A small green bush, round and compact,
about 2 feet tall, sitting on a tiny grass patch. Low-poly 3D render, clean
colors, warm summer lighting from top-left, SimCity 2000 game asset style.
Single isolated object centered on solid #00FF00 chroma green background.
White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A very young small pine seedling,
about 1.5 feet tall, thin trunk with sparse tiny branches. On a small grass
patch. Low-poly 3D render, clean colors, warm summer lighting from top-left,
SimCity 2000 game asset style. Single isolated object centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

### Level 2 — Young Tree (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A young birch tree, about 8 feet tall,
slender white trunk with light green leafy canopy. On a small grass patch.
Low-poly 3D render, clean colors, warm summer lighting from top-left, SimCity
2000 game asset style. Single isolated object centered on solid #00FF00 chroma
green background. White 2px outline. No ground shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A young pine tree, about 8 feet tall,
classic conical Christmas tree shape, dark green needles. On a small grass
patch. Low-poly 3D render, clean colors, warm summer lighting from top-left,
SimCity 2000 game asset style. Single isolated object centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A young maple tree, about 10 feet
tall, medium-sized green canopy, visible brown trunk. On a small grass patch.
Low-poly 3D render, clean colors, warm summer lighting from top-left, SimCity
2000 game asset style. Single isolated object centered on solid #00FF00 chroma
green background. White 2px outline. No ground shadow. No text.
```

### Level 3 — Mature Tree (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A mature oak tree, about 25 feet tall,
thick brown trunk, wide spreading green canopy with dense foliage. On a small
grass patch. Low-poly 3D render, clean colors, warm summer lighting from
top-left, SimCity 2000 game asset style. Single isolated object centered on
solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A tall mature pine tree, about 30 feet
tall, straight trunk, layered green needle branches. On a small grass patch.
Low-poly 3D render, clean colors, warm summer lighting from top-left, SimCity
2000 game asset style. Single isolated object centered on solid #00FF00 chroma
green background. White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A mature elm tree, about 25 feet tall,
elegant vase-shaped canopy, rich green leaves, thick trunk. On a small grass
patch. Low-poly 3D render, clean colors, warm summer lighting from top-left,
SimCity 2000 game asset style. Single isolated object centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

### Level 4 — Ancient/Giant Tree (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A giant ancient redwood tree, towering
about 50 feet tall, massive thick trunk with visible bark texture, enormous
dense dark green canopy. On a small grass patch with exposed roots. Low-poly
3D render, clean colors, warm summer lighting from top-left, SimCity 2000 game
asset style. Single isolated object centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A colossal ancient oak tree, about 45
feet tall, gnarled thick trunk, massive sprawling dark green canopy that
dominates the scene. On a small grass patch. Low-poly 3D render, clean colors,
warm summer lighting from top-left, SimCity 2000 game asset style. Single
isolated object centered on solid #00FF00 chroma green background. White 2px
outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A towering ancient sequoia tree, about
55 feet tall, enormously wide trunk, dense evergreen canopy reaching high. On
a small grass patch with mossy rocks. Low-poly 3D render, clean colors, warm
summer lighting from top-left, SimCity 2000 game asset style. Single isolated
object centered on solid #00FF00 chroma green background. White 2px outline.
No ground shadow. No text.
```

---

## THEME 2: Autumn Forest

Use the **exact same prompts as Summer Forest** but replace:
- `"warm summer lighting"` → `"warm golden autumn lighting"`
- `"green leaves"` / `"green canopy"` → `"autumn colored leaves in orange, red, gold, and brown"`
- `"lush green grass"` → `"grass with fallen autumn leaves in orange and brown"`
- `"dark green"` → `"deep red and burnt orange"`
- Add to each prompt: `"Autumn fall season atmosphere"`

### Example — Level 3 Autumn Oak:
```
Strict isometric projection, 2:1 ratio. A mature oak tree, about 25 feet tall,
thick brown trunk, wide spreading canopy with dense autumn foliage in orange,
red, gold, and brown colors. Fallen leaves on grass patch below. Low-poly 3D
render, clean colors, warm golden autumn lighting from top-left, SimCity 2000
game asset style. Autumn fall season atmosphere. Single isolated object centered
on solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

---

## THEME 3: Winter Forest

Replace:
- `"warm summer lighting"` → `"cool blue-white winter lighting"`
- `"green leaves"` / `"green canopy"` → `"snow-covered branches"` or `"bare branches with snow"`
- `"lush green grass"` → `"snow-covered ground, white snow"`
- Add: `"Winter season, frost, snow accumulation on branches"`

### Example — Level 3 Winter Pine:
```
Strict isometric projection, 2:1 ratio. A tall mature pine tree, about 30 feet
tall, straight trunk, branches heavily laden with white snow. Snow-covered
ground below. Low-poly 3D render, clean colors, cool blue-white winter
lighting from top-left, SimCity 2000 game asset style. Winter season, frost
atmosphere. Single isolated object centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

### Example — Level 2 Winter Bare Tree:
```
Strict isometric projection, 2:1 ratio. A young deciduous tree, about 8 feet
tall, completely bare branches with no leaves, light dusting of snow on
branches. Snow-covered ground below. Low-poly 3D render, clean colors, cool
blue-white winter lighting from top-left, SimCity 2000 game asset style.
Winter season. Single isolated object centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

---

## THEME 4: Spring Forest

Replace:
- `"warm summer lighting"` → `"bright soft spring lighting"`
- Add cherry blossoms for levels 3-4: `"pink cherry blossom petals"` or `"light green new spring leaves"`
- `"lush green grass"` → `"fresh spring grass with small wildflowers, daisies, and dandelions"`
- Add: `"Spring season, fresh new growth, blooming"`

### Example — Level 4 Spring Cherry Blossom:
```
Strict isometric projection, 2:1 ratio. A magnificent large cherry blossom
tree, about 40 feet tall, thick trunk, enormous canopy completely covered in
beautiful pink and white cherry blossom flowers. A few petals falling. Fresh
spring grass with small flowers below. Low-poly 3D render, clean colors,
bright soft spring lighting from top-left, SimCity 2000 game asset style.
Spring season, blooming atmosphere. Single isolated object centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

---

## THEME 5: NYC Skyline

### Level 0 — Empty Lot
```
Strict isometric projection, 2:1 ratio. A small empty city lot with cracked
concrete sidewalk, a fire hydrant, and a thin city tree grate. Urban New York
City style. Low-poly 3D render, clean colors, warm lighting from top-left,
SimCity 2000 game asset style. Single isolated tile centered on solid #00FF00
chroma green background. White 2px outline. No ground shadow. No text.
```

### Level 1 — Small Structure (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A small New York City brownstone
building, 3 stories tall, classic brown brick facade with window details and
front stoop stairs. Low-poly 3D render, clean colors, warm lighting from
top-left, SimCity 2000 game asset style. Single isolated building centered on
solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A small NYC corner bodega/deli shop,
2 stories, ground floor storefront with awning, apartment above. Low-poly 3D
render, clean colors, warm lighting from top-left, SimCity 2000 game asset
style. Single isolated building centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A NYC hot dog cart with a small
umbrella and a park bench next to it. Small urban scene element. Low-poly 3D
render, clean colors, warm lighting from top-left, SimCity 2000 game asset
style. Single isolated object centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

### Level 2 — Medium Building (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A medium NYC apartment building, 6
stories tall, red brick facade, fire escapes on the front, rows of windows
with air conditioning units. Low-poly 3D render, clean colors, warm lighting
from top-left, SimCity 2000 game asset style. Single isolated building
centered on solid #00FF00 chroma green background. White 2px outline. No
ground shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A medium NYC office building, 8
stories, art deco style facade with ornamental details, regular window grid.
Low-poly 3D render, clean colors, warm lighting from top-left, SimCity 2000
game asset style. Single isolated building centered on solid #00FF00 chroma
green background. White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A medium NYC pre-war apartment
building, 7 stories, limestone facade, water tower on roof, classic New York
architecture. Low-poly 3D render, clean colors, warm lighting from top-left,
SimCity 2000 game asset style. Single isolated building centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

### Level 3 — Tall Building (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A tall NYC skyscraper, about 20
stories, modern glass and steel facade, setback architecture typical of
midtown Manhattan. Lit windows at night. Low-poly 3D render, clean colors,
warm lighting from top-left, SimCity 2000 game asset style. Single isolated
building centered on solid #00FF00 chroma green background. White 2px outline.
No ground shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A tall NYC art deco tower, about 25
stories, ornate crown and setbacks, similar to Chrysler Building style but
generic. Warm lit windows. Low-poly 3D render, clean colors, warm lighting
from top-left, SimCity 2000 game asset style. Single isolated building
centered on solid #00FF00 chroma green background. White 2px outline. No
ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A tall NYC residential tower, about
22 stories, modern luxury condo building, balconies on some floors, rooftop
amenities. Low-poly 3D render, clean colors, warm lighting from top-left,
SimCity 2000 game asset style. Single isolated building centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

### Level 4 — Iconic Skyscraper (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A massive NYC supertall skyscraper,
about 50 stories, sleek modern glass tower inspired by One World Trade Center
style, tapering top with antenna spire. Low-poly 3D render, clean colors, warm
lighting from top-left, SimCity 2000 game asset style. Single isolated building
centered on solid #00FF00 chroma green background. White 2px outline. No ground
shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A massive NYC art deco skyscraper,
about 45 stories, inspired by Empire State Building style, ornate stepped
crown with antenna, limestone and steel facade. Low-poly 3D render, clean
colors, warm lighting from top-left, SimCity 2000 game asset style. Single
isolated building centered on solid #00FF00 chroma green background. White
2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A massive slim NYC supertall
skyscraper, about 55 stories, ultra-modern pencil tower style inspired by
432 Park Avenue, grid facade pattern. Low-poly 3D render, clean colors, warm
lighting from top-left, SimCity 2000 game asset style. Single isolated building
centered on solid #00FF00 chroma green background. White 2px outline. No ground
shadow. No text.
```

---

## THEME 6: Paris

### Level 0 — Empty Lot
```
Strict isometric projection, 2:1 ratio. A small Parisian cobblestone ground
tile with a classic green Parisian street lamp and a small flower pot. Low-poly
3D render, clean colors, warm golden lighting from top-left, SimCity 2000 game
asset style. Single isolated tile centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

### Level 1 — Small Parisian Structure (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A small Parisian cafe with outdoor
seating, striped awning, bistro chairs and small round tables. 2 stories.
Low-poly 3D render, clean colors, warm golden Parisian lighting from top-left,
SimCity 2000 game asset style. Single isolated building centered on solid
#00FF00 chroma green background. White 2px outline. No ground shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A small Parisian patisserie shop, 2
stories, cream-colored facade with green shopfront, classic French signage
area. Low-poly 3D render, clean colors, warm golden Parisian lighting from
top-left, SimCity 2000 game asset style. Single isolated building centered on
solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A Parisian newspaper kiosk, small
green metal structure, classic Morris column style. Low-poly 3D render, clean
colors, warm golden Parisian lighting from top-left, SimCity 2000 game asset
style. Single isolated object centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

### Level 2 — Medium Parisian Building (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A medium Parisian Haussmann-style
apartment building, 5 stories, cream limestone facade, wrought iron juliet
balconies on 2nd and 5th floors, mansard roof with zinc grey color and dormer
windows. Low-poly 3D render, clean colors, warm golden Parisian lighting from
top-left, SimCity 2000 game asset style. Single isolated building centered on
solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A medium Parisian corner building, 5
stories, curved corner facade, ground floor boulangerie with awning, classic
French windows with shutters, grey mansard roof. Low-poly 3D render, clean
colors, warm golden Parisian lighting from top-left, SimCity 2000 game asset
style. Single isolated building centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A medium Parisian residential building,
6 stories, light sandstone facade, ornate wrought iron balcony railings, tall
French windows, classic zinc mansard roof with chimneys. Low-poly 3D render,
clean colors, warm golden Parisian lighting from top-left, SimCity 2000 game
asset style. Single isolated building centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

### Level 3 — Tall Parisian Building (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A tall elegant Parisian Haussmann
building, 8 stories, ornate cream facade with detailed stone carvings,
continuous wrought iron balconies, tall arched windows, elaborate mansard roof
with decorative dormers and chimneys. Low-poly 3D render, clean colors, warm
golden Parisian lighting from top-left, SimCity 2000 game asset style. Single
isolated building centered on solid #00FF00 chroma green background. White 2px
outline. No ground shadow. No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A tall Parisian art nouveau building,
8 stories, flowing organic facade details, curved iron balconies, decorative
floral elements, classic French mansard roof. Low-poly 3D render, clean colors,
warm golden Parisian lighting from top-left, SimCity 2000 game asset style.
Single isolated building centered on solid #00FF00 chroma green background.
White 2px outline. No ground shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A tall Parisian grand boulevard
building, 9 stories, wide impressive facade, multiple balcony levels, ornate
cornices, large mansard roof with multiple chimneys. Ground floor luxury
boutique with awning. Low-poly 3D render, clean colors, warm golden Parisian
lighting from top-left, SimCity 2000 game asset style. Single isolated building
centered on solid #00FF00 chroma green background. White 2px outline. No ground
shadow. No text.
```

### Level 4 — Iconic Parisian Structure (generate 3 variants)
**Variant A:**
```
Strict isometric projection, 2:1 ratio. A miniature Eiffel Tower, detailed
iron lattice structure, all four legs visible from isometric angle, warm golden
color. Low-poly 3D render, clean colors, warm golden Parisian lighting from
top-left, SimCity 2000 game asset style. Single isolated structure centered on
solid #00FF00 chroma green background. White 2px outline. No ground shadow.
No text.
```

**Variant B:**
```
Strict isometric projection, 2:1 ratio. A grand Parisian cathedral inspired by
Notre-Dame, gothic architecture, flying buttresses, rose window, twin towers,
detailed stone facade. Low-poly 3D render, clean colors, warm golden Parisian
lighting from top-left, SimCity 2000 game asset style. Single isolated building
centered on solid #00FF00 chroma green background. White 2px outline. No ground
shadow. No text.
```

**Variant C:**
```
Strict isometric projection, 2:1 ratio. A magnificent Parisian opera house
inspired by Palais Garnier, ornate Beaux-Arts architecture, grand facade with
columns, green copper dome roof, golden statues on top. Low-poly 3D render,
clean colors, warm golden Parisian lighting from top-left, SimCity 2000 game
asset style. Single isolated building centered on solid #00FF00 chroma green
background. White 2px outline. No ground shadow. No text.
```

---

## THEME 7: Cape Town (Future)

### Level 0 — Ground
```
Strict isometric projection, 2:1 ratio. A small patch of sandy African earth
with fynbos scrubland, small protea flowers, and a weathered stone. Low-poly
3D render, clean colors, warm bright South African sunlight from top-left,
SimCity 2000 game asset style. Single isolated tile centered on solid #00FF00
chroma green background. White 2px outline. No ground shadow. No text.
```

### Level 4 — Iconic (Table Mountain hint)
```
Strict isometric projection, 2:1 ratio. A miniature Table Mountain with its
iconic flat top and dramatic cliff faces, green vegetation on slopes, small
cable car visible. Low-poly 3D render, clean colors, warm bright South African
sunlight from top-left, SimCity 2000 game asset style. Single isolated object
centered on solid #00FF00 chroma green background. White 2px outline. No ground
shadow. No text.
```

---

## Post-Processing Pipeline

After generating all sprites:

### Step 1: Remove Green Background
```bash
# Using ImageMagick (free, command line)
magick input.png -fuzz 20% -transparent "#00FF00" output.png

# Batch process all sprites in a folder
for f in raw/*.png; do
  magick "$f" -fuzz 20% -transparent "#00FF00" "clean/$(basename $f)"
done
```

### Step 2: Trim & Normalize Size
```bash
# Trim whitespace and resize to consistent base width
# Trees: 64px wide base, variable height
# Buildings: 64px wide base, variable height
magick input.png -trim -resize 64x +repage output.png
```

### Step 3: Organize into Theme Folders
```
sprites/
├── forest-summer/
│   ├── ground-1.png
│   ├── level-1-a.png
│   ├── level-1-b.png
│   ├── level-1-c.png
│   ├── level-2-a.png
│   ├── level-2-b.png
│   ├── level-2-c.png
│   ├── level-3-a.png
│   ├── level-3-b.png
│   ├── level-3-c.png
│   ├── level-4-a.png
│   ├── level-4-b.png
│   └── level-4-c.png
├── forest-autumn/
│   └── ... (same structure)
├── forest-winter/
│   └── ...
├── forest-spring/
│   └── ...
├── city-nyc/
│   └── ...
├── city-paris/
│   └── ...
└── city-capetown/
    └── ...
```

---

## Sprite Count Summary

| Theme | Ground | L1 | L2 | L3 | L4 | Total |
|-------|--------|----|----|----|----|-------|
| Summer Forest | 1 | 3 | 3 | 3 | 3 | **13** |
| Autumn Forest | 1 | 3 | 3 | 3 | 3 | **13** |
| Winter Forest | 1 | 3 | 3 | 3 | 3 | **13** |
| Spring Forest | 1 | 3 | 3 | 3 | 3 | **13** |
| NYC | 1 | 3 | 3 | 3 | 3 | **13** |
| Paris | 1 | 3 | 3 | 3 | 3 | **13** |
| Cape Town | 1 | 3 | 3 | 3 | 3 | **13** |
| **TOTAL** | | | | | | **91** |

Generate 3-5 variations per prompt, pick best 3 = ~150-250 total generations needed.

---

## Tips for Best Results

1. **Same session**: Generate all sprites for one theme in a single Gemini/Nano Banana conversation to maintain style consistency
2. **Reference the previous output**: After generating the first sprite, say "Now generate another one in the exact same style but..." for the next level
3. **Iterate the prompt**: If the first output isn't right, tell the model what to fix: "Same thing but make the tree shorter" or "Less realistic, more game-like"
4. **Batch by level**: Generate all Level 1 sprites across tree types first, then all Level 2, etc. — this keeps the scale consistent
5. **Check the angle**: Every sprite should look like it's viewed from the same camera angle. Reject any that look front-on or too top-down
6. **Scale reference**: Mentally, Level 1 should be ~20% the height of Level 4. If they're too similar in size, regenerate
