// The five stages, in order. A stage becomes playable the moment its folder has
// an index.js, so stage builders never need to edit /core to register it.

const modules = import.meta.glob('../stages/*/index.js');

const PLAN = [
  { id: 'hermes', name: 'Hermes', rank: 'Astronaut Trainee', place: 'Training pool' },
  { id: 'odysseus', name: 'Odysseus', rank: 'Astronaut', place: 'Zero-G plane' },
  { id: 'dioscuri', name: 'Dioscuri', rank: 'Science Expert', place: 'Space lab' },
  { id: 'hera', name: 'Hera', rank: 'Pilot', place: 'Ship simulator' },
  { id: 'apollo', name: 'Apollo', rank: 'Commander on the Moon', place: 'Moon base' },
];

export const STAGES = PLAN.map((s) => ({ ...s, available: Boolean(modules[`../stages/${s.id}/index.js`]) }));

// The stage to play next: the first built stage not finished yet (Stage 1 again once all are done).
export function nextStageIndex(stages, completed) {
  const i = stages.findIndex((s) => s.available !== false && !completed.includes(s.id));
  return i === -1 ? 0 : i;
}

export async function loadStage(id) {
  const load = modules[`../stages/${id}/index.js`];
  if (!load) throw new Error(`No stage called "${id}" (expected stages/${id}/index.js)`);
  const stage = (await load()).default;
  for (const key of ['id', 'name', 'rank', 'start', 'demo']) {
    if (!stage?.[key]) throw new Error(`stages/${id}/index.js is missing "${key}" (see CONTRACTS.md)`);
  }
  return stage;
}
