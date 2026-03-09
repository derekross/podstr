import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import Episodes from "./pages/Episodes";
import Community from "./pages/Community";
import SocialFeed from "./pages/SocialFeed";
import PublishEpisode from "./pages/PublishEpisode";
import Studio from "./pages/Studio";
import About from "./pages/About";
import DebugAudio from "./pages/DebugAudio";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";
import { PersistentAudioPlayer } from "./components/audio/PersistentAudioPlayer";

export function AppRouter() {
  return (
    <BrowserRouter basename="/podstr/">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/episodes" element={<Episodes />} />
        <Route path="/community" element={<Community />} />
        <Route path="/social" element={<SocialFeed />} />
        <Route path="/publish" element={<PublishEpisode />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/about" element={<About />} />
        <Route path="/debug-audio" element={<DebugAudio />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <PersistentAudioPlayer />
    </BrowserRouter>
  );
}
export default AppRouter;