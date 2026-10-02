# Grounded 3D release review — 2.1.0

The flat gameplay map has been replaced by an interactive 3D terrain mesh. Avatar scale is measured after updating the skin binding and the idle pose. A regression test loads the shipped skeleton and animation clips, checks human scale and boot contact, then exercises idle, walk, run and stopping. Another test raycasts the actual terrain geometry along routes in all 16 regions and compares it with the foot-placement sampler.

- Physical materials use existing licensed terrain and bark textures, scanned rocks, grass, ferns and flowers, and an HDR sky.
- Humanoid characters use a fully clothed Mixamo locomotion asset with separate tints, proportions and lanterns. This is an adapted asset, not an original sculpt.
- Idle, walk and run blend with measured movement speed. Planted feet receive slope correction; camera tracking and depth testing keep avatars in the scene.
- Shrine, bell, chest and resident positions use the same world coordinates as gameplay. Solid interactive props prevent travelers walking through their centers.
- Water normals, foliage, snow/rain and the fox move. Terrain-aligned guardian rings and tide/wind clues preserve gameplay feedback.
- Multiplayer tokens, campaign state, room links, archived regional progress, difficulty levels and open exploration are preserved.

## Practical limits

This remains a small connected regional browser game. Buildings are modular geometry, cedar foliage uses intersecting photographic cutout planes, and the two travelers share a licensed base model. It is not photorealistic AAA production, a seamless large world, or a verified 56-hour campaign. Scenery paintings are still used for storytelling and the atlas. Only named gameplay objects are interactive. The guardian ring and collectibles deliberately use fantasy effects.

## Verification

Run `npm test`, `npm run typecheck` and `npm run build`. Tests cover campaign actions, multiplayer persistence, region travel, route connectivity, contact geometry and humanoid locomotion. Browser checks must additionally verify loading, visible feet, walking, click routing and two-player play on the production build. Automated progression does not establish human playtime or enjoyment.
