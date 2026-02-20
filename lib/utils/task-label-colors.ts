/**
 * Colors for Mine vs Group task labels (toggle filter chips).
 * Toggled = this filter is active. Different colors for toggled vs not toggled.
 */

export type LabelStyle = { bg: string; text: string; borderWidth?: number; borderColor?: string };

/** Mine: inactive (not toggled) - lighter slate */
const MINE_INACTIVE: LabelStyle = { bg: '#64748b', text: '#f8fafc' }; // slate-500 / slate-50
/** Mine: toggled (filter active) */
const MINE_ACTIVE: LabelStyle = { bg: '#475569', text: '#fff', borderWidth: 2, borderColor: '#94a3b8' }; // slate-600 + ring

/** Palette for group labels: inactive (bg, text) and active/toggled (solid accent) */
const GROUP_LABEL_PALETTE: Array<{ bg: string; text: string; activeBg: string; activeText: string }> = [
  { bg: '#dbeafe', text: '#1e40af', activeBg: '#1e40af', activeText: '#fff' },
  { bg: '#d1fae5', text: '#047857', activeBg: '#047857', activeText: '#fff' },
  { bg: '#ede9fe', text: '#5b21b6', activeBg: '#5b21b6', activeText: '#fff' },
  { bg: '#ffedd5', text: '#c2410c', activeBg: '#c2410c', activeText: '#fff' },
  { bg: '#fce7f3', text: '#be185d', activeBg: '#be185d', activeText: '#fff' },
  { bg: '#cffafe', text: '#0e7490', activeBg: '#0e7490', activeText: '#fff' },
  { bg: '#fef3c7', text: '#b45309', activeBg: '#b45309', activeText: '#fff' },
  { bg: '#e0e7ff', text: '#3730a3', activeBg: '#3730a3', activeText: '#fff' },
];

export function getMineLabelStyle(isToggled: boolean): LabelStyle {
  return isToggled ? MINE_ACTIVE : MINE_INACTIVE;
}

export function getGroupLabelStyle(
  groupId: string,
  groupOrder: Array<{ id: string }>,
  isToggled: boolean
): LabelStyle {
  const index = groupOrder.findIndex((g) => g.id === groupId);
  const i = index >= 0 ? index % GROUP_LABEL_PALETTE.length : 0;
  const p = GROUP_LABEL_PALETTE[i];
  return isToggled ? { bg: p.activeBg, text: p.activeText } : { bg: p.bg, text: p.text };
}

/** @deprecated Use getMineLabelStyle / getGroupLabelStyle with isToggled */
export const MINE_LABEL_BG = MINE_INACTIVE.bg;
export const MINE_LABEL_TEXT = MINE_INACTIVE.text;
