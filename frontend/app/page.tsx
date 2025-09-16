// app/page.tsx

import RealTimeChart from './components/RealTimeChart';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <RealTimeChart />
    </main>
  );
}