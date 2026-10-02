export const ROUTES = [
  { centers:[720,1590,2460,3330], pattern:0, tip:'Learn the lanterns on sheltered terraces.', wind:0, traction:1 },
  { centers:[790,1470,2440,3350], pattern:1, tip:'Watch the ridge gusts before jumping between switchbacks.', wind:85, traction:1 },
  { centers:[660,1620,2390,3370], pattern:2, tip:'Climb the bamboo staircase. Keep the spirit traveler close to reveal bridges.', wind:0, traction:1 },
  { centers:[760,1720,2510,3390], pattern:3, tip:'Use the waterfall shelves to reach the upper rescue route.', wind:25, traction:1 },
  { centers:[640,1430,2530,3420], pattern:1, tip:'Brake early on wet paving and follow the rooftop crossings.', wind:0, traction:.75 },
  { centers:[820,1660,2370,3340], pattern:3, tip:'The canal route alternates wide landings with narrow upper balconies.', wind:0, traction:.85 },
  { centers:[690,1510,2580,3380], pattern:0, tip:'Read the tide, then jump with the coastal wind.', wind:65, traction:1 },
  { centers:[810,1730,2460,3410], pattern:2, tip:'Time your cliff ascent between strong gusts.', wind:105, traction:1 },
  { centers:[730,1460,2410,3360], pattern:3, tip:'Snow softens the path. Use broad landings before the raised shrines.', wind:35, traction:.8 },
  { centers:[650,1630,2520,3400], pattern:1, tip:'Ice carries your momentum. Release movement early to land precisely.', wind:0, traction:.3 },
  { centers:[800,1540,2470,3440], pattern:2, tip:'Cross the maple canopy on a rising ladder of branches.', wind:45, traction:1 },
  { centers:[680,1740,2540,3330], pattern:0, tip:'Garden terraces hide the stars above the koi pools.', wind:0, traction:1 },
  { centers:[780,1480,2600,3430], pattern:3, tip:'Follow the cavern’s staggered crystal shelves.', wind:0, traction:1 },
  { centers:[620,1580,2430,3380], pattern:2, tip:'Stay together through the river’s spirit bridges and tide puzzles.', wind:20, traction:1 },
  { centers:[840,1690,2490,3450], pattern:1, tip:'Village rooftops lead to the guardian. Save room to dodge its waves.', wind:0, traction:1 },
  { centers:[700,1490,2550,3420], pattern:3, tip:'Combine rescue, precision landings, melody, and the final guardian.', wind:30, traction:1 },
] as const;
export function routeFor(realm:number){const route=ROUTES[realm];if(!route)throw Error(`Unknown route ${realm}`);return route;}
