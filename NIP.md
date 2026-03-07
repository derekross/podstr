# NIP-XX: Podcast Episodes and Trailers

`draft` `optional`

This NIP defines event kinds for podcast episodes and trailers on Nostr, enabling decentralized podcast publishing and RSS feed generation.

## Summary

This specification introduces two new addressable event kinds for podcast publishing:
- `30054`: Podcast Episodes
- `30055`: Podcast Trailers

It also describes the use of existing `30078` events for podcast metadata configuration.

## Event Kinds

### Kind 30054: Podcast Episode

A `kind 30054` event represents a podcast episode. These are addressable events that can be edited and replaced.

#### Required Tags

- `d` - A unique identifier for this episode (addressable event identifier)
- `title` - The episode title
- `audio` - The audio URL, with optional media type as second parameter (e.g., `["audio", "https://example.com/episode.mp3", "audio/mpeg"]`)
- `pubdate` - Publication date in RFC2822 format (set once when first published, preserved during edits)
- `alt` - A human-readable description of the event per NIP-31

#### Optional Tags

- `description` - Episode description/summary
- `image` - Episode artwork URL
- `duration` - Episode duration in seconds (integer)
- `t` - Topic tags for categorization (multiple tags allowed)
- `transcript` - URL to a transcript file (Podcasting 2.0 `<podcast:transcript>`)
- `chapters` - URL to a JSON chapters file (Podcasting 2.0 `application/json+chapters`)
- `edit` - Reference to original event ID when updating an episode (for edit history)

#### Content Field

The content field MAY contain additional episode notes or description text.

#### Example

```json
{
  "kind": 30054,
  "content": "In this episode, we discuss the latest developments in decentralized social media protocols.",
  "tags": [
    ["d", "episode-1699123456-abc123def"],
    ["title", "The Future of Decentralized Social Media"],
    ["audio", "https://example.com/episodes/episode-001.mp3", "audio/mpeg"],
    ["pubdate", "Thu, 04 Nov 2023 12:00:00 GMT"],
    ["alt", "Podcast episode: The Future of Decentralized Social Media"],
    ["description", "A deep dive into how protocols like Nostr are changing social media"],
    ["image", "https://example.com/artwork/episode-001.jpg"],
    ["duration", "3600"],
    ["t", "technology"],
    ["t", "decentralization"],
    ["t", "social-media"]
  ],
  "created_at": 1699123456,
  "pubkey": "...",
  "id": "...",
  "sig": "..."
}
```

### Kind 30055: Podcast Trailer

A `kind 30055` event represents a podcast trailer. These are addressable events following the Podcast 2.0 trailer specification.

#### Required Tags

- `d` - A unique identifier for this trailer (addressable event identifier)
- `title` - The trailer title (maximum 128 characters recommended)
- `url` - The trailer media URL
- `pubdate` - Publication date in RFC2822 format
- `alt` - A human-readable description of the event per NIP-31

#### Optional Tags

- `length` - File size in bytes
- `type` - MIME type of the trailer media (audio/mpeg, video/mp4, etc.)
- `season` - Season number this trailer represents
- `edit` - Reference to original event ID when updating a trailer

#### Content Field

The content field SHOULD contain the trailer title.

#### Example

```json
{
  "kind": 30055,
  "content": "Season 2 Preview",
  "tags": [
    ["d", "trailer-1699123456-xyz789abc"],
    ["title", "Season 2 Preview"],
    ["url", "https://example.com/trailers/season-2-preview.mp3"],
    ["pubdate", "Thu, 04 Nov 2023 12:00:00 GMT"],
    ["alt", "Podcast trailer: Season 2 Preview"],
    ["length", "1024000"],
    ["type", "audio/mpeg"],
    ["season", "2"]
  ],
  "created_at": 1699123456,
  "pubkey": "...",
  "id": "...",
  "sig": "..."
}
```

## Podcast Metadata (Kind 30078)

Podcast publishers SHOULD use `kind 30078` addressable events to store podcast-level metadata and configuration. While this kind is defined in other NIPs, this specification describes its usage in the podcasting context.

#### Recommended Tags for Podcast Metadata

- `d` - Should be set to `"podcast-metadata"` for podcast configuration
- `title` - Podcast title
- `image` - Podcast artwork URL
- `description` - Podcast description

#### Content Field

The content field SHOULD contain a JSON object with podcast metadata including:

```json
{
  "title": "My Podcast",
  "description": "A podcast about interesting topics",
  "author": "John Doe",
  "email": "john@example.com",
  "image": "https://example.com/artwork.jpg",
  "language": "en",
  "categories": ["Technology", "Science"],
  "explicit": false,
  "website": "https://example.com",
  "copyright": "© 2023 John Doe",
  "funding": ["https://example.com/donate"],
  "locked": false,
  "value": {
    "amount": 100000,
    "currency": "sat",
    "recipients": [
      {
        "name": "Host",
        "type": "lnaddress",
        "address": "host@example.com",
        "split": 100
      }
    ]
  },
  "type": "episodic",
  "complete": false
}
```

## Implementation Notes

### Addressable Events

Both episode (`30054`) and trailer (`30055`) events are addressable events. This means:
- Only the latest event per `pubkey:kind:d-tag` combination is stored by relays
- Episodes and trailers can be edited by publishing a new event with the same `d` tag
- Comments and references should use `a` tags in the format `30054:pubkey:d-tag`

### RSS Feed Generation

These events can be used to generate RSS feeds compatible with podcast aggregators:
- Episodes (`30054`) become `<item>` elements in the RSS feed
- Trailers (`30055`) become `<podcast:trailer>` elements
- Metadata (`30078`) provides the channel-level RSS information

### Event Ordering

Episodes should be ordered by `created_at` timestamp for RSS feed generation, with most recent episodes first.

### File Storage

Audio files referenced in `audio`, `url`, and `image` tags SHOULD be stored on reliable hosting or decentralized storage systems. Publishers MAY use Blossom servers (NIP-96) or other file storage solutions.

## Security Considerations

- Publishers should verify they have rights to publish audio content
- File URLs should be served over HTTPS when possible
- Large audio files should be hosted on appropriate infrastructure to handle bandwidth requirements

## Rationale

The choice of kinds `30054` and `30055` places these events in the addressable range (30000-39999), allowing episodes and trailers to be edited after publication. This is important for podcast publishing where metadata corrections or content updates may be necessary.

The tag structure follows existing Nostr conventions while incorporating requirements from RSS/Podcast 2.0 specifications to ensure compatibility with existing podcast infrastructure.