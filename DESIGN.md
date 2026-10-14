# Design Spec — Gold Jewelry Storefront

This document describes the Gold Custom design system implemented on top of the Shopify Hydrogen skeleton in this repo.

## 1. Brand Mood

Luxury, minimal, aspirational. Lots of white/cream space, a single restrained gold accent, confident serif display type for big statements, clean sans-serif for everything functional (nav, prices, body copy). Nothing loud except the sale/promo callouts, which get a deliberate red so they don't get lost in the gold.

## 2. Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#FFFFFF` | Page background |
| `--color-bg-soft` | `#FAF7F2` | Section alternation, cards |
| `--color-ink` | `#1A1712` | Primary text |
| `--color-ink-soft` | `#6B6259` | Secondary text, captions |
| `--color-border` | `#E7E1D6` | Hairlines, dividers |
| `--color-gold` | `#B8935F` | Primary accent, links-on-dark, icons |
| `--color-gold-dark` | `#8C6D3F` | Hover states, buttons on light bg |
| `--color-gold-soft` | `#F1E7D6` | Tinted backgrounds (badges, tiles) |
| `--color-charcoal` | `#141210` | Dark sections (header utility bar, showroom, footer) |
| `--color-sale` | `#B23A48` | Sale badges, discount callouts |
| `--color-white` | `#FFFFFF` | Text on dark backgrounds |

Gold is used sparingly — as an underline, a border, a button, an icon — never as a large fill, to keep the "luxury minimal" feel rather than looking gaudy.

## 3. Typography

- **Display (headings, hero copy):** `"Playfair Display", Georgia, serif` — elegant high-contrast serif for h1/h2 and hero statements.
- **Body / UI (nav, buttons, prices, paragraphs):** `"Inter", system-ui, sans-serif` — clean and legible at small sizes.
- Section eyebrow labels (e.g. "SHOP BY CATEGORY") are set in the UI font, uppercase, letter-spacing `0.14em`, small size, gold color.
- Scale: hero h1 `clamp(2.25rem, 5vw, 3.75rem)`; section h2 `clamp(1.5rem, 3vw, 2.25rem)`; body `1rem`; small/price `0.875rem`.

## 4. Layout & Spacing

- Max content width: `1400px`, centered, `1.5rem`–`3rem` side padding depending on viewport.
- Section vertical rhythm: `4rem`–`6rem` padding top/bottom on desktop, `2.5rem` on mobile.
- Alternate section backgrounds between `--color-bg` and `--color-bg-soft` to separate content without hard rules.
- Grid gaps: `1.5rem`–`2rem`.

## 5. Header

Two-tier sticky header:

1. **Utility bar** (dark, `--color-charcoal`, small text): phone number (left), rotating promo message + code (center), financing / book-appointment link (right). Hidden on very small screens down to just the promo message.
2. **Main bar** (white, sticky): hamburger (mobile) — logo (left, serif wordmark) — primary nav (desktop only, centered/left-aligned): *Rings, Chains, Bracelets, Necklaces, Pendants, Earrings, Engagement Rings, Diamond* — icon cluster (right): search, account, cart with item-count badge.

## 6. Homepage Sections (top → bottom)

1. **Hero banner** — full-width, gold-tinted gradient background, serif headline + subcopy + two CTAs ("Shop Men's" / "Shop Women's").
2. **Feature strip** — 4 icon+label badges: Lifetime Warranty · Free Shipping & Returns · Lifetime Upgrade · Financing Available. Thin bordered strip, repeats lower on the page after products.
3. **Shop by Category** — eyebrow + heading, horizontal-scroll/grid of circular category tiles (Rings, Necklaces, Bracelets, Earrings, Pendants, Chains, Diamonds, Custom) in gold-soft circles with a label underneath.
4. **Featured Collection** — real Shopify collection data, large image + title banner linking to the collection.
5. **Best Sellers / New Arrivals** — real Shopify product data (`ProductItem` grid), 4-up on desktop, card style: image, name, price, subtle hover lift.
6. **Second feature strip** — repeat of section 2 for reinforcement (mirrors reference site's repeated trust badges).
7. **Showroom / Visit Us** — dark full-bleed section, serif heading "Where Luxury Comes to Life", descriptive copy, address + "Book an Appointment" CTA.
8. **Follow / Social** — centered strip, "Follow Us" heading + social icon row.

## 7. Footer

- **Newsletter bar** (gold-soft background): heading + email input + subscribe button, "Get 10% off your first order" style incentive.
- **Columns:**
  - *Shop* — store menu links (data-driven from Shopify menu).
  - *Customer Care* — policy links (Privacy, Terms, Shipping, Refunds — data-driven).
  - *Find Us* — showroom address, hours, phone, email, "Book an Appointment".
  - *Connect* — social icon row (Instagram, Facebook, YouTube, TikTok) + brand wordmark.
- **Bottom bar:** copyright, payment method icons, back-to-top link.

## 8. Components

- **Buttons:** primary = solid `--color-ink` bg / white text, uppercase, letter-spaced, sharp corners with `2px` radius; secondary = outline gold on transparent; both grow a subtle underline/opacity shift on hover, no bouncy animation (keeps it upscale).
- **Product cards:** image (1:1), name, price, all left-aligned, image scales slightly on hover (`transform: scale(1.03)`), no visible card border — separation via whitespace.
- **Category tiles:** circular, gold-soft fill, centered icon/initial, label below, whole tile is a link with an underline-on-hover for the label.
- **Badges:** sale badge = small solid `--color-sale` pill, uppercase, white text.

## 9. Implementation Notes

- Fonts loaded via Google Fonts `<link>` tags in `app/root.tsx`.
- Design tokens defined as CSS custom properties in `app/styles/app.css` (`:root`).
- No hot-linked imagery from the reference site is used; category tiles / hero / showroom use CSS gradients and typography instead of photography placeholders, so the storefront degrades gracefully before real product photography is uploaded to Shopify.
- Product and collection data (Featured Collection, Best Sellers) remain fully data-driven off the connected Shopify store via the existing GraphQL queries — only presentational/promotional sections are static.
