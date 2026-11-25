import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlucoseDataProvider } from '@/components/GlucoseDataProvider';
import { GlucoseDashboard } from '@/components/GlucoseDashboard';

export default function HomePage() {
  return (
    <ErrorBoundary>
      <GlucoseDataProvider>
        <GlucoseDashboard />
      </GlucoseDataProvider>
    </ErrorBoundary>
  );
}
