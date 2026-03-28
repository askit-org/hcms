import AppShell from '@/components/AppShell';
import ToastContainer from '@/components/Toast';
import AppProvider from '@/components/AppProvider';

export default function OpdLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
      <ToastContainer />
    </AppProvider>
  );
}
