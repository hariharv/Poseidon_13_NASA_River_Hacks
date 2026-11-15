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

// The level chooser's buttons. Before any stage is finished only Stage 1 is open
// (finishing one opens them all); `last` = the stage just finished, suggested next.
export function stageChoices(stages, { completed = [], stars = {} } = {}, last = null) {
  const built = stages.filter((s) => s.available !== false);
  const label = (s) => {
    const done = completed.includes(s.id) ? ` ✓ ${'★'.repeat(stars[s.id] ?? 0)}` : '';
    return `Stage ${stages.indexOf(s) + 1} · ${s.name} (${s.place})${done}`;
  };
  const afterLast = last ? built[built.findIndex((s) => s.id === last) + 1] : null;
  const suggested = afterLast ?? built[nextStageIndex(built, completed)] ?? built[0];
  const open = completed.length ? built : [suggested];
  return [
    { id: suggested.id, label: `${last ? 'Next' : completed.length ? 'Continue' : 'Start'}: ${label(suggested)}` },
    ...open.filter((s) => s !== suggested).map((s) => ({ id: s.id, label: label(s) })),
    { id: 'quit', label: 'Back to the title screen' },
  ];
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
