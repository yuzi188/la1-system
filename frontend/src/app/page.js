import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import GamesSection from "../components/GamesSection";
import LiveSection from "../components/LiveSection";
import MemberSection from "../components/MemberSection";
import FooterCta from "../components/FooterCta";

export default function HomePage() {
  return (
    <main className="page">
      <Navbar />
      <Hero />
      <GamesSection />
      <LiveSection />
      <MemberSection />
      <FooterCta />
    </main>
  );
}
