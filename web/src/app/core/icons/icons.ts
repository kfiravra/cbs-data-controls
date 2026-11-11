import { inject, provideAppInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

import accountTree from '../../../assets/icons/account_tree.svg';
import add from '../../../assets/icons/add.svg';
import archive from '../../../assets/icons/archive.svg';
import arrowBack from '../../../assets/icons/arrow_back.svg';
import arrowDownward from '../../../assets/icons/arrow_downward.svg';
import arrowUpward from '../../../assets/icons/arrow_upward.svg';
import checkCircle from '../../../assets/icons/check_circle.svg';
import chevronLeft from '../../../assets/icons/chevron_left.svg';
import chevronRight from '../../../assets/icons/chevron_right.svg';
import close from '../../../assets/icons/close.svg';
import cloudOff from '../../../assets/icons/cloud_off.svg';
import contentCopy from '../../../assets/icons/content_copy.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import edit from '../../../assets/icons/edit.svg';
import error from '../../../assets/icons/error.svg';
import info from '../../../assets/icons/info.svg';
import lightbulb from '../../../assets/icons/lightbulb.svg';
import linkOff from '../../../assets/icons/link_off.svg';
import playArrow from '../../../assets/icons/play_arrow.svg';
import rule from '../../../assets/icons/rule.svg';
import search from '../../../assets/icons/search.svg';
import swapHoriz from '../../../assets/icons/swap_horiz.svg';
import syncProblem from '../../../assets/icons/sync_problem.svg';
import tune from '../../../assets/icons/tune.svg';
import unfoldMore from '../../../assets/icons/unfold_more.svg';
import warning from '../../../assets/icons/warning.svg';

/**
 * The Material Symbols (Sharp, weight 400) in use, bundled as text: no request per icon, so the product
 * runs with no network and a screenshot never misses one.
 */
const ICONS = {
  account_tree: accountTree,
  add,
  archive,
  arrow_back: arrowBack,
  arrow_downward: arrowDownward,
  arrow_upward: arrowUpward,
  check_circle: checkCircle,
  chevron_left: chevronLeft,
  chevron_right: chevronRight,
  close,
  cloud_off: cloudOff,
  content_copy: contentCopy,
  delete: deleteIcon,
  edit,
  error,
  info,
  lightbulb,
  link_off: linkOff,
  play_arrow: playArrow,
  rule,
  search,
  swap_horiz: swapHoriz,
  sync_problem: syncProblem,
  tune,
  unfold_more: unfoldMore,
  warning,
} as const;

export type IconName = keyof typeof ICONS;

export function registerIcons(registry: MatIconRegistry, sanitizer: DomSanitizer): void {
  for (const [name, svg] of Object.entries(ICONS)) {
    registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(svg));
  }
}

export function provideIcons() {
  return provideAppInitializer(() => registerIcons(inject(MatIconRegistry), inject(DomSanitizer)));
}
