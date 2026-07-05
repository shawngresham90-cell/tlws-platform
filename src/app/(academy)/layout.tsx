import { AcademySubnav } from '@/components/academy';

/**
 * Layout for the Academy module (Milestone 7). Adds the shared secondary nav
 * under the global header so every Academy page carries the same wayfinding.
 */
export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AcademySubnav />
      {children}
    </>
  );
}
