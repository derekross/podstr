# PODSTR

A Nostr-powered podcast platform for single creator accounts that combines decentralized publishing with Podcasting 2.0 standards.

[![Edit with Shakespeare](https://img.shields.io/badge/Edit%20with-Shakespeare.diy-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTEyIDMtMS45MTIgNS44MTNhMiAyIDAgMCAxLTEuMjc1IDEuMjc1TDMgMTJsNS44MTMgMS45MTJhMiAyIDAgMCAxIDEuMjc1IDEuMjc1TDEyIDIxbDEuOTEyLTUuODEzYTIgMiAwIDAgMSAxLjI3NS0xLjI3NUwyMSAxMmwtNS44MTMtMS45MTJhMiAyIDAgMCAxLTEuMjc1LTEuMjc1TDEyIDN6Ii8+PC9zdmc+)](https://shakespeare.diy)
[![Build Your Prompt](https://img.shields.io/badge/Build%20Your-Prompt-3B82F6?style=for-the-badge)](https://podstr.org/prompt-builder)

## Features

### Podcast Publishing
- **Creator-only publishing** with hardcoded npub authentication
- Upload audio files to Blossom servers or reference external URLs
- Rich episode metadata: title, description, cover art, transcripts, chapters
- Podcasting 2.0 value tags for Lightning payments and funding
- Episode editing and management through intuitive Studio interface

### RSS Feed Generation
- Automatic Podcasting 2.0-compliant RSS feed at `/rss.xml`
- Build-time RSS generation using `scripts/build-rss.ts`
- Lightning value splits with modern `lnaddress` method (no keysend fallback)
- iTunes and standard RSS 2.0 support with health monitoring
- RSS feed pulls episodes from Nostr relays at build time

### Listening Experience
- Clean, responsive audio player with progress tracking
- Chronological episode listing with rich metadata
- Episode search by title, description, and tags
- Mobile-optimized interface

### Community Interaction
- Creator social feed for updates and announcements  
- Episode comments system with full threading (NIP-22)
- Fan engagement through Nostr protocol:
  - Threaded comments and replies on episodes
  - Lightning zaps (NIP-57) with WebLN and NWC support
  - Social reactions and reposts
- Zap leaderboards and episode popularity metrics
- Real-time comment updates and notifications

### Nostr Integration
- Standard Nostr authentication (NIP-07, NIP-46)
- Addressable podcast episodes (kind 30054)
- Comments system using NIP-22
- Value-for-value Lightning integration

## Getting Started

### Prerequisites
- Node.js 18+ 
- NPM or compatible package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/podstr.git
cd podstr

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Generate RSS feed
npx tsx scripts/build-rss.ts
```

## Configuration

Podstr 2.0 uses direct configuration in `src/lib/podcastConfig.ts` - no environment variables needed!

### Quick Start with Shakespeare.diy (Recommended)

The easiest way to configure your podcast is using AI-assisted setup:

1. **Fork this repository** on GitHub
2. **Build your prompt** using our [Prompt Builder](https://podstr.org/prompt-builder)
3. **Open your fork** in [Shakespeare.diy](https://shakespeare.diy)
4. **Paste your prompt** - Shakespeare will configure everything automatically!

[![Edit with Shakespeare](https://img.shields.io/badge/Edit%20with-Shakespeare.diy-8B5CF6?style=flat-square)](https://shakespeare.diy)
[![Build Your Prompt](https://img.shields.io/badge/Build%20Your-Prompt-3B82F6?style=flat-square)](https://podstr.org/prompt-builder)

### Manual Configuration

Alternatively, you can edit `src/lib/podcastConfig.ts` directly. The file is well-commented with all available options.

### Configuration Prompt for Shakespeare.diy

If you prefer to write your own prompt, copy this into Shakespeare.diy and replace the placeholder values:

### Configuration Prompt for Shakespeare.diy

Copy this prompt into Shakespeare.diy and replace the placeholder values with your information:

---

**Configure my Podstr podcast with these settings. Edit the file `src/lib/podcastConfig.ts` with these values:**

**CREATOR IDENTITY**
- My Nostr npub: `npub1yourpubkeyhere...`

**BASIC PODCAST INFO**
- Podcast title: `Your Podcast Name`
- Description: `A description of your podcast content`
- Author name: `Your Name`
- Contact email: `your@email.com`
- Cover art URL: `https://your-image-url.jpg` (minimum 1400x1400px recommended)
- Language: `en-us` (or es-es, fr-fr, de-de, etc.)
- Categories: `Technology, Society & Culture` (comma-separated list)
- Contains explicit content: `no` (yes or no)
- Website URL: `https://your-podcast-website.com`
- Copyright notice: `© 2025 Your Name`

**PODCASTING 2.0 SETTINGS**
- Podcast GUID: `npub1yourpubkeyhere...` (typically same as your npub)
- Medium type: `podcast` (or: music, video, film, audiobook, newsletter, blog)
- Publisher name: `Your Name or Company` (can be same as author)
- Podcast type: `episodic` (or: serial for sequential shows)
- Is the podcast complete/finished: `no` (yes or no)
- Is the podcast locked/premium: `no` (yes or no)

**LOCATION (Optional - leave blank if not needed)**
- Recording location name: `` (e.g., "Austin, Texas" or leave blank)
- GPS coordinates: `` (e.g., "30.2672,-97.7431" or leave blank)
- OpenStreetMap ID: `` (or leave blank)

**LICENSE**
- License type: `CC BY 4.0` (or: All Rights Reserved, CC BY-SA 4.0, etc.)
- License URL: `https://creativecommons.org/licenses/by/4.0/`

**LIGHTNING VALUE-FOR-VALUE**
- Suggested sats per minute: `1000`
- Currency: `sats` (or: USD, EUR, BTC)
- Value recipients (JSON array - splits must add up to 100):
```json
[
  {
    "name": "Host Name",
    "type": "lnaddress",
    "address": "you@getalby.com",
    "split": 100,
    "fee": false
  }
]
```

For multiple recipients:
```json
[
  {
    "name": "Host",
    "type": "lnaddress",
    "address": "host@getalby.com",
    "split": 80,
    "fee": false
  },
  {
    "name": "Producer",
    "type": "lnaddress",
    "address": "producer@getalby.com",
    "split": 15
  },
  {
    "name": "Platform",
    "type": "node",
    "address": "03abc123...",
    "split": 5,
    "fee": true
  }
]
```

**FUNDING LINKS (Optional)**
- Funding URLs: `/about` (comma-separated list of donation/funding links, or leave as /about)

**PODCAST PEOPLE**
- People involved (JSON array):
```json
[
  {
    "name": "Your Name",
    "role": "host",
    "group": "cast"
  }
]
```

With optional fields:
```json
[
  {
    "name": "Your Name",
    "role": "host",
    "group": "cast",
    "img": "https://your-photo-url.jpg",
    "href": "https://your-website.com"
  },
  {
    "name": "Co-Host Name",
    "role": "co-host",
    "group": "cast"
  },
  {
    "name": "Producer Name",
    "role": "producer",
    "group": "crew"
  }
]
```

**RSS SETTINGS**
- RSS cache time (minutes): `60`
- Enable OP3 analytics: `no` (yes or no - if yes, you'll need to set VITE_OP3_API_TOKEN env var)

**ADVANCED SETTINGS (Optional - leave blank/commented if not needed)**
- New feed URL (for migration): `` (leave blank unless migrating from another host)
- Content blocking: `` (leave blank)
- Text metadata: `` (leave blank)
- Remote item references: `` (leave blank)

---

### Manual Configuration

You can also edit `src/lib/podcastConfig.ts` directly. The file is well-commented with all available options organized into clear sections:

- **Creator Identity** - Your Nostr npub
- **Basic Podcast Info** - Title, description, author, image, etc.
- **Podcasting 2.0 Settings** - GUID, medium, type, etc.
- **Location** - Optional recording location
- **License** - Content licensing
- **Lightning Value-for-Value** - Payment splits
- **Funding Links** - Donation URLs
- **Podcast People** - Host, co-hosts, crew
- **Analytics** - OP3 integration
- **RSS Settings** - Cache configuration

### OP3 Analytics (Optional)

If you enable OP3 analytics for download tracking, you'll need to set the API token as an environment variable (this is the only env var needed):

1. Get your token from [op3.dev](https://op3.dev)
2. Set `VITE_OP3_API_TOKEN` in your deployment platform (Vercel, Netlify, etc.)
3. Or create a local `.env` file:
   ```env
   VITE_OP3_API_TOKEN=your_token_here
   ```

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS 3.x
- **UI Components**: shadcn/ui (48+ components) with Radix primitives  
- **Build Tool**: Vite with hot module replacement
- **Nostr**: Nostrify framework for Deno and web
- **State Management**: TanStack Query for data fetching and caching
- **Routing**: React Router with BrowserRouter
- **Audio**: HTML5 audio with persistent playback state
- **Lightning**: WebLN and Nostr Wallet Connect (NWC) integration
- **File Upload**: Blossom server integration for media storage

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components (48+ available)
│   ├── auth/           # Authentication components (LoginArea, AccountSwitcher)
│   ├── audio/          # Audio player components (PersistentAudioPlayer)
│   ├── podcast/        # Podcast-specific components (EpisodeCard, etc.)
│   ├── social/         # Social interaction components (PostActions, NoteComposer)
│   ├── comments/       # Threading comment system (CommentsSection)
│   └── studio/         # Creator studio components (EpisodeManagement, etc.)
├── hooks/              # Custom React hooks (useNostr, useZaps, etc.)
├── lib/                # Utility functions and configurations
│   └── podcastConfig.ts # <-- MAIN CONFIG FILE - Edit this!
├── pages/              # Route components (Index, Episodes, Studio, etc.)
├── contexts/           # React context providers (AppContext, NWCContext)
└── types/              # TypeScript type definitions

scripts/
├── build-rss.ts        # Build-time RSS feed generation
├── validate-rss.ts     # RSS feed validation
└── test-rss-endpoint.ts # RSS endpoint testing

dist/
├── rss.xml             # Generated Podcasting 2.0 RSS feed
├── rss-health.json     # RSS health and status monitoring
└── 404.html            # GitHub Pages compatibility
```

## Core Event Types

- **Episodes**: `kind 30054` (Addressable/editable podcast episodes)
- **Metadata**: `kind 30078` (Podcast configuration)
- **Comments**: `kind 1111` (NIP-22 episode comments) 
- **Social**: `kind 1` (Creator updates and announcements)

## Deployment

### Static Hosting (Recommended)
Deploy to Vercel, Netlify, or GitHub Pages:

```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

### RSS Feed Updates
- **Build-time**: RSS generated automatically during `npm run build`
- **Manual**: Run `npx tsx scripts/build-rss.ts` to regenerate
- **Periodic**: Set up cron jobs using updated `RSS_CRON_SETUP.md` guide  
- **Webhooks**: Trigger builds when new episodes are published
- **Health monitoring**: Check `/rss-health.json` for feed status

### Environment Variables

The only environment variable needed is for OP3 analytics (optional):

```env
VITE_OP3_API_TOKEN=your_op3_token_here
```

All other configuration is done directly in `src/lib/podcastConfig.ts`.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Nostr Protocol** - Decentralized social networking foundation
- **Podcasting 2.0** - Modern podcast standards and value integration
- **shadcn/ui** - Beautiful, accessible UI components
- **Nostrify** - Nostr development framework

---

**Vibed with [MKStack](https://soapbox.pub/mkstack)**

Built for creators who want to own their content, engage directly with their audience, and participate in the value-for-value economy through Bitcoin Lightning payments.
