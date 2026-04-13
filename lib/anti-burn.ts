/**
 * 全屏防烧屏配置与工具
 *
 * 采用低频、微幅、空闲期触发策略，降低 OLED 烧屏风险。
 */

/** 空闲检测时长（毫秒），达到后启用防烧屏 */
export const ANTI_BURN_IDLE_MS = 60_000;

/** 漂移切换间隔（毫秒） */
export const ANTI_BURN_SHIFT_INTERVAL_MS = 90_000;

/** 最大偏移像素 */
export const ANTI_BURN_MAX_OFFSET_PX = 2;

/** 遮罩透明度变化幅度 */
export const ANTI_BURN_DIM_OPACITY = 0.015;

/** 预设漂移坐标序列 */
export const ANTI_BURN_POSITIONS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
] as const;

/** 防烧屏模式 */
export type AntiBurnMode = 'shift-only' | 'shift-plus-dim';

/** 默认模式 */
export const DEFAULT_ANTI_BURN_MODE: AntiBurnMode = 'shift-only';

/**
 * 获取下一个漂移位置索引
 */
export function getNextPositionIndex(currentIndex: number): number {
  return (currentIndex + 1) % ANTI_BURN_POSITIONS.length;
}
