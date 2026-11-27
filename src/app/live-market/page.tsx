import { redirect } from 'next/navigation';

/** The live IPO market lives on the home page radar tab. */
export default function LiveMarketPage() {
  redirect('/?tab=radar');
}
