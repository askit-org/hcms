import AppShell from '@/components/AppShell';

export default function OpdLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>{children}</AppShell>
  );
}
