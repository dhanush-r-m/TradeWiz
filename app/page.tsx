import dynamic from 'next/dynamic'

const TradeWiz = dynamic(() => import('./components/TradeWiz'), {
  ssr: false,
})

export default function Home() {
  return (
    <main className="min-h-screen">
      <TradeWiz />
    </main>
  );
} 