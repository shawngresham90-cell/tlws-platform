/** Small uppercase label above a heading. Encodes section identity, not decoration. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-3">{children}</p>;
}
