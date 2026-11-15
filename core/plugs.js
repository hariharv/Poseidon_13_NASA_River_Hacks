// The words for the power panel prompt, the same in every stage, so plugging and unplugging
// always reads the same way: ON uses a plug, OFF frees one.
export function plugPrompt({ label, plugged, free, overloaded }) {
  const name = String(label).toLowerCase();
  if (plugged) return `Press [E] to turn OFF the ${name} (frees a plug)`;
  if (free > 0 && !overloaded) return `Press [E] to turn ON the ${name} (uses a plug)`;
  return `No free plug for the ${name}: turn another machine OFF first`;
}
