import type { Point } from "./adventure";

export type WorldTarget = Point & { type: string; value: unknown; label: string; hold?: boolean };
export const targetKey = (target: WorldTarget) => `${target.type}:${target.x}:${target.y}:${JSON.stringify(target.value)}`;
export const canReach = (player: Point, target: WorldTarget) => Math.hypot(player.x-target.x, player.y-target.y) < (target.hold ? 130 : 112);

// Props are drawn above their anchor. Pointer selection must follow the artwork,
// while server interaction distance continues to use the original world anchor.
export function targetAt(targets: WorldTarget[], pointer: Point): WorldTarget | undefined {
  return targets.map(target => ({target, distance: Math.hypot(pointer.x-target.x, pointer.y-(target.y-42))}))
    .filter(hit => hit.distance < (hit.target.type === "advance" ? 105 : 65))
    .sort((a,b) => a.distance-b.distance)[0]?.target;
}
