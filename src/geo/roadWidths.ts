export type WidthSource = 'width' | 'width:carriageway' | 'lanes' | 'estimated';

/** Parse complete positive measurements, never treating feet as metres. */
export function metres(value?: string): number | undefined {
  const match = value?.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(m|metres?|meters?|ft|feet|')?$/i);
  if (!match) return;
  const result = Number(match[1]) * (/^(ft|feet|')$/i.test(match[2] ?? '') ? 0.3048 : 1);
  return Number.isFinite(result) && result > 0 ? result : undefined;
}

/** Prototype carriageway estimates; explicit measurements always take precedence. */
export function roadWidth(tags: Record<string, string>): { width: number; widthSource: WidthSource } {
  for (const key of ['width:carriageway', 'width'] as const) {
    const width = metres(tags[key]);
    if (width !== undefined) return { width, widthSource: key };
  }
  const highway = tags.highway;
  const major = ['primary', 'secondary', 'trunk', 'primary_link', 'secondary_link', 'trunk_link'].includes(highway);
  const laneWidth = major ? 3.25 : 2.75;
  const lanes = /^\d+$/.test(tags.lanes ?? '') ? Number(tags.lanes) : 0;
  if (lanes > 0 && lanes <= 8) return { width: lanes * laneWidth + 0.5, widthSource: 'lanes' };
  const oneWay = ['yes', '1', '-1', 'true'].includes(tags.oneway) ||
    (tags.junction === 'roundabout' && tags.oneway !== 'no');
  let width: number;
  switch (highway) {
    case 'motorway': case 'trunk': case 'primary': case 'secondary': width = oneWay ? 4 : 7; break;
    case 'tertiary': case 'unclassified': width = oneWay ? 3.75 : 6; break;
    case 'residential': width = oneWay ? 3.5 : 5.5; break;
    case 'living_street': width = 4; break;
    case 'service': width = ['driveway', 'parking_aisle', 'alley'].includes(tags.service) ? 3 : 4; break;
    case 'pedestrian': width = 5; break;
    case 'cycleway': width = 2.5; break;
    case 'footway': case 'path': case 'steps': width = 1.8; break;
    default: width = highway?.endsWith('_link') ? 3.75 : 3;
  }
  return { width, widthSource: 'estimated' };
}
