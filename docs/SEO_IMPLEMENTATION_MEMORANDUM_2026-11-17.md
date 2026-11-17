# Three-Site SEO & Image Optimisation Memorandum
Updated: 2026-11-17
Status: IMPLEMENTATION IN PROGRESS — INDEXING HOLD

## Network structure
1. Artist Frequency — https://global-music-submission-portal.pages.dev/ (Cloudflare Pages hostname; selected canonical host). The former `.org` hostname is retired and must not be used.
2. DiggerMan Official — https://kingpinpkaytee-dot.github.io/diggerman-site/
3. The Kingpin Entertainment — https://kingpinpkaytee-dot.github.io/thekingpin-entertainment-site/

Cross-site authority flow: Artist Frequency → DiggerMan Official → The Kingpin Entertainment. Each site keeps its own purpose, canonical URL, visual identity and structured data.

Cross-site hostname consistency: DiggerMan Official and The Kingpin Entertainment SEO branches now link back to Artist Frequency using the selected `pages.dev` hostname. The retired `.org` hostname was checked and is absent from the homepage, robots and sitemap files on all three SEO branches. The DiggerMan and Kingpin changes remain staged in their own open draft pull requests and are not live until separately approved and released.

## Work completed in this implementation branch
- DiggerMan homepage: improved Open Graph site identity, descriptive social-image ALT text, Twitter image ALT text and MusicGroup topical knowledge.
- The Kingpin Entertainment homepage: expanded South African company description, company service/topic knowledge, Gauteng/Johannesburg/Riverlea service-area and locality metadata, improved Open Graph site identity and social-image ALT text.
- Artist Frequency homepage: refined platform description, improved social-card type to summary_large_image, added site identity and a planned social preview asset reference.
- Brand-specific canonical URLs and robots directives retained; Artist Frequency canonical, Open Graph URL, `robots.txt` sitemap target and sitemap homepage URL are corrected to the selected Cloudflare Pages hostname.
- Existing DiggerMan MusicGroup and The Kingpin Organization JSON-LD retained and enriched rather than replaced.
- Cloudinary asset-library verification confirms the six referenced SEO image assets exist as public image uploads; stored source dimensions are 1200×630 for Artist Frequency, 3000×3000 for the three DiggerMan release artworks, 1254×1254 for the selected Kingpin logo and 1376×1824 for the Riverlea archive image. This confirms asset records and dimensions, not deployed HTTP delivery status.
- DiggerMan sitemap XML image namespace defect identified during review and corrected on its SEO branch; `image:image` and `image:loc` elements now have the required `xmlns:image` declaration.
- No search-engine indexing request has been made.

## Exclusive promotional imagery source
Authorised source folder on the user's Windows device:
C:\Users\USER\Downloads

Approved company logo selection:
- Use the original file `The Kingpin Entertainment_Logo.png` from the Downloads folder for The Kingpin Entertainment brand logo, navigation identity and social preview.
- Do not substitute `kingpin_brand.png` unless the owner explicitly changes the selection.
- Preserve the original artwork; do not redraw, recolour, crop or add text. Generate a resized/optimised derivative only when visual fidelity and transparency are preserved.

Candidate assets identified by filename:
- DiggerMan artist/release promotion: DiggerMan_SEGA_3000x3000.jpg; DiggerMan_Immortal_3000x3000.jpg; Digger-Man_One_Man_Show_3000x3000.jpg; CELESTIAL_FREQUENCY_2_3000x3000.jpg; celestial_frequency_3000x3000.jpg; celestial_signal_ep_cover_3000.jpg; No_Looking_Back_3000x3000.jpg; No_Looking_Back_2_3000x3000.jpg; Advertisement DiggerMan On Spotify.png; Spotify Promo Card.jpeg.
- Company identity: The Kingpin Entertainment_Logo.png (approved); kingpin_brand.png (alternate, not selected).
- Riverlea visual archive: riverlea_night_rap_scene.webp; riverlea_street_crowd.webp; balcony_overlook_crowd.webp.
- Additional release art should be selected from the Downloads folder only after visual review and relevance checks.

## Required image implementation
- Copy approved original assets into each site's own /assets/seo/ directory using descriptive, lowercase, hyphenated filenames.
- Preserve original artwork; do not crop, repaint or invent text on release covers.
- Generate responsive WebP/AVIF derivatives only when quality and dimensions can be preserved; keep original artwork as canonical fallback.
- Add accurate, non-keyword-stuffed ALT text to every meaningful image.
- Add width/height, loading=lazy for below-the-fold images, fetchpriority=high for the lead image, and explicit object-fit rules where needed.
- Use an image-specific social preview for each brand/site, with OG/Twitter image ALT text, dimensions and type where verified.
- Add image sitemap entries only for crawlable public image URLs.
- Do not expose personal documents, account screenshots, certificates, credentials, or unrelated Downloads assets.

## Business and entity SEO
- The Kingpin Entertainment: retain legal name and slogan; use Organization JSON-LD; include accurate South African locality and service area; only add telephone, street address, opening hours or registration number if the owner supplies verified public details.
- DiggerMan: MusicGroup entity with artist identity, genres, Spotify/MusicBrainz and official social links; retain release and catalogue references.
- Artist Frequency: Organization + WebSite entities; accurately describe free independent-artist submissions, playlist and radio discovery; no unsupported placement or reach claims.

## Verification progress — 2026-11-17
- DiggerMan repository tree confirms 68 individual track-page HTML files; all 68 were fetched and checked for a page title, meta description, canonical link, Open Graph title/description/image, Twitter card metadata and syntactically valid JSON-LD. All 68 passed this presence/syntax check.
- DiggerMan sitemap contains 71 URL entries (homepage, music index, smartlinks page and 68 track pages) plus three image entries. The required image namespace is now declared and all image tags are balanced.
- Cloudinary asset-library records confirm six referenced SEO images exist as public image uploads with stored source dimensions. The six selected promotional/logo/archive image URLs were subsequently checked for successful HTTP image delivery.
- Artist Frequency Organization JSON-LD was refined so the platform does not incorrectly identify the separate DiggerMan and Kingpin websites as `sameAs` profiles; platform-specific `knowsAbout` topics now describe its actual service focus.
- DiggerMan homepage code confirms all three newly uploaded release artworks are visibly presented as featured release cards with descriptive ALT text, dimensions and lazy loading.
- The Kingpin homepage code references the owner-selected logo in navigation, Organization JSON-LD, Open Graph/Twitter preview and its image sitemap; Riverlea archive imagery is also presented in the gallery.
- Artist Frequency hosting decision: the owner selected `https://global-music-submission-portal.pages.dev/` as the canonical production hostname and explicitly rejected the former `.org` hostname. The `.org` hostname is retired and must not appear in canonical, Open Graph, sitemap or robots metadata. Wrangler 4.164.0 is authenticated on the connected Acer; Cloudflare Pages confirms project `global-music-submission-portal`, the expected `pages.dev` domain and no Git provider (Direct Upload). Deployment history confirms `main` is the production branch. The latest production deployment at verification time was `cd48f6f0-447c-407b-bf2b-05bb92c6ba21`, source `7bb9de4`.
- DiggerMan and The Kingpin GitHub Pages sites both returned HTTP 200. All six selected Cloudinary promotional/logo/archive image URLs returned HTTP 200 with image content types. Artist Frequency production HTML/robots/sitemap still require promotion of the verified SEO branch; the branch preview now passes its HTTP smoke checks.
- Initial direct production checks showed HTTP 200 for the homepage but legacy `.org` references in the production `robots.txt`, sitemap and HTML. This confirms production has not received the corrected SEO-branch content. The separate branch preview now serves the corrected `pages.dev` canonical/OG URL and preserved Google verification meta tag. Production remains unchanged pending the complete three-site audit and explicit production-release authorisation.

## Cross-site image and entity refinements — 2026-11-17

### DiggerMan Official
- The homepage social preview now uses the high-resolution preferred artist portrait through a non-cropping Cloudinary 1200×630 JPEG derivative. The image was verified at HTTP 200 and its actual output dimensions were measured as 1200×630.
- The homepage's seven displayed images now include explicit width/height, descriptive ALT text and asynchronous decoding. The primary hero portrait has high fetch priority; secondary images are lazy-loaded.
- The 25 cover images on the music catalogue page and the SmartLinks hero image now declare verified square dimensions (640×640 for Spotify artwork and 1000×1000 for the Apple Music artwork), with ALT text and asynchronous decoding. Catalogue images remain lazy-loaded; the SmartLinks hero receives high priority.
- All 68 individual track pages were updated: their Spotify artwork (640×640) or Apple Music artwork (1000×1000) now has explicit width/height, high fetch priority and asynchronous decoding. Open Graph image type/dimensions and Twitter image ALT/title/description metadata are included. MusicRecording `sameAs` lists were cleaned so artist and album URLs are not incorrectly asserted as equivalent to an individual recording.
- Repository-level spot checks confirmed JSON-LD remains valid on the homepage, catalogue, SmartLinks page and sampled track pages. The existing track-page metadata audit had already found unique titles/canonicals, descriptions, OG metadata and valid MusicRecording JSON-LD across all 68 pages.

### The Kingpin Entertainment
- The homepage's six displayed images now have explicit width/height and descriptive ALT text; asynchronous decoding was added to the updated images. The hero portrait receives high fetch priority, and the social preview is explicitly described as a 1200×630 JPEG.
- Company Organization JSON-LD no longer labels DiggerMan artist profiles as equivalent profiles of the company and no longer asserts an unverified postal address. The verified company identity, contact email, service area and the separate DiggerMan MusicGroup entity are retained.
- JSON-LD parses successfully after the entity refinement; the homepage sitemap still contains one canonical page and four image entries.

### Network-wide consistency
- The retired `.org` hostname has zero occurrences in the homepage, robots file and sitemap of all three SEO branches. The Artist Frequency `.pages.dev` hostname is used for the two cross-site links from DiggerMan and Kingpin.
- All three sites remain separate properties with distinct canonical URLs and entity identities. Changes in the DiggerMan and Kingpin branches are still preview-only GitHub PR changes and are not live.

## Cloudflare Pages preview deployment validation — 2026-11-17

- A sanitized static publish directory was built from the SEO branch. It contains only the public site entry point, robots/sitemap, Google verification file, public Supabase browser configuration, the three application modules and the public SEO asset. Repository documentation, workflow files, scripts, SQL migrations and sample environment files were excluded from the upload.
- Preview deployment succeeded with Wrangler 4.164.0: deployment ID `09281162-0c92-47bb-ab7d-bfdf671825a2`, branch `seo/artist-frequency-visual-and-entity-seo-2026-11`, source commit `e7f519e`. Preview alias: https://seo-artist-frequency-visual.global-music-submission-portal.pages.dev/
- Preview HTTP checks passed (200) for the homepage, `robots.txt`, `sitemap.xml`, `src/app.js`, `src/auth.js`, `src/supabase-client.js`, `supabase-config.js`, the public SEO SVG, Dashboard and Submissions query routes, and the Cloudinary Open Graph image.
- The deployed preview homepage returns the intended `pages.dev` canonical and Open Graph URL and retains the existing Google verification meta tag. The retired `.org` hostname was not found in the deployed homepage, robots file or sitemap.
- The Google HTML verification file path currently responds with HTTP 308 and redirects to its extensionless URL due to Pages URL handling. The homepage meta-tag verification method remains available; do not claim Search Console ownership is verified until the user confirms the Search Console result.
- The preview is a branch deployment only. The production deployment remains on `main` and was not changed. No sitemap or indexing request was submitted.

## Repository-wide static audit results — 2026-11-17

### DiggerMan Official — complete static HTML pass
- The current SEO branch was cloned to the connected Acer and all 71 HTML pages were audited from the actual checked-out branch contents.
- Across 101 image elements, zero are missing explicit width/height, descriptive ALT text, or a loading/fetch-priority instruction. The hero images receive high priority; secondary and catalogue artwork is lazy-loaded.
- All 71 pages have a title, unique canonical URL, meta description, Open Graph image metadata, Twitter card/title/description/image ALT metadata and valid JSON-LD. Each page has exactly one H1. No duplicate titles or canonicals were detected.
- Meta description lengths now range from 96 to 160 characters; zero pages exceed 160 characters.
- The DiggerMan sitemap contains 71 unique canonical URLs and three image entries, with the required image namespace. Its robots file points to that sitemap. The retired `.org` hostname is absent from the 71 HTML pages, robots file and sitemap.
- The three primary DiggerMan social-preview and release-cover assets were checked for live image delivery; the preferred-portrait social card derivative returns HTTP 200 at 1200×630.

### Static accessibility checks (DiggerMan and Kingpin)
- A static HTML accessibility pass across all 71 DiggerMan pages and the Kingpin homepage found no missing document language, viewport declaration, page-level H1, duplicate IDs, unnamed buttons, unnamed links or iframes without titles.
- This is a source-code/static accessibility check only. It does not replace keyboard, screen-reader, contrast, zoom or real-browser interaction testing.

### The Kingpin Entertainment — homepage static pass
- All six homepage images have explicit dimensions and ALT text, plus either lazy loading or high fetch priority. The selected company-logo image and Riverlea archive image retain their correct artwork.
- Homepage title, 133-character meta description, canonical, Open Graph and Twitter image metadata pass the static checks. JSON-LD parses successfully and contains one H1.
- The Organization entity retains verified South African/Gauteng/Johannesburg service-area details and the public contact channel, but no unverified postal address or misleading DiggerMan social-profile `sameAs` links.
- The sitemap contains one canonical URL and four image entries; the image namespace and robots sitemap reference are present. The retired `.org` hostname is absent from the homepage, robots file and sitemap.

### Pull-request and workflow state
- Artist Frequency PR #6, DiggerMan PR #7 and The Kingpin Entertainment PR #3 remain open, draft and unmerged.
- No GitHub Actions workflow runs were returned for the three current branch-head commits. The static audits above were executed directly against the checked-out branch files; they are not a substitute for browser-based mobile/performance testing.
- The DiggerMan and Kingpin SEO changes remain in their PR branches and are not live. Artist Frequency's previously validated Cloudflare preview is separate from the unchanged `main` production deployment.

## Latest DiggerMan and Kingpin verification — 2026-11-17

- After the final metadata refinements, the complete DiggerMan local branch audit confirms 71 HTML pages, 101 image elements, 75 unique internal links tested with zero broken links, no missing image dimensions/ALT/loading attributes, no duplicate titles or canonicals, and valid metadata/JSON-LD across all pages. The final title-tag range is 32–61 characters; meta descriptions range from 96–160 characters.
- DiggerMan image URL HEAD checks found no failed image requests or redirects across the 44 unique `src`/Open Graph URLs found during the crawl. The 13 Feature.fm iframe widget URLs returned HTTP 200 with HTML content types, as expected for embedded player documents.
- The Kingpin local branch audit confirms one HTML page, six image elements, five unique internal links tested with zero broken links, a 133-character description, valid JSON-LD, and no missing image dimensions/ALT/loading attributes. All six unique image sources/Open Graph images returned HTTP 200 with image content types.
- DiggerMan PR #7 now contains the full 71-page audit fixes and title/description refinements. The Kingpin PR #3 includes the final 133-character description and image priority correction. These changes remain on review branches.
- Browser-rendered mobile layout, visual regression, Core Web Vitals and Lighthouse performance testing are still outstanding. The repository static checks and HTTP/link checks do not certify those browser-based measurements.

## Payment-origin consistency check — 2026-11-17

- The full Artist Frequency SEO branch scan found four Supabase browser-facing Edge Functions whose CORS code still explicitly allowed the retired `.org` hostname and did not include the selected Cloudflare Pages production origin.
- Corrected `create-paystack-checkout`, `payment-admin-status`, `create-premium-subscription` and `cancel-premium-subscription` on the review branch. They now allow the exact production origin `https://global-music-submission-portal.pages.dev` and the explicitly recognized protected Vercel preview pattern; environment-configured origins are restricted to those active hosts, so a stale `.org` or arbitrary external origin is ignored.
- The Paystack invoice checkout function now also rejects a configured callback URL unless its origin is HTTPS and passes the active-origin allowlist. Premium subscription checkout builds its return URL from the already-validated request origin.
- Local logic tests passed for: allow production Pages origin; allow the explicitly recognized preview origin; reject the retired `.org` origin even when it appears in stale environment configuration; reject an arbitrary external origin.
- Read-only OPTIONS probes against the currently deployed Supabase functions confirmed HTTP 200 for the selected Pages origin on all four functions, HTTP 403 for an unrelated origin, but also HTTP 200 for the retired `.org` origin on all four functions. This verifies that the legacy origin is still accepted by production today; the review-branch changes have not been deployed. After the approved Edge Function release, repeat the probes and require Pages origin HTTP 200 plus retired `.org` HTTP 403.
- Payment deployment secrets still need to be confirmed/set to the Pages origin (`APP_ORIGIN`, `CORS_ALLOWED_ORIGINS`, and `PAYMENT_RETURN_URL`) during the approved production release. Supabase secrets were not read or changed, and no Edge Function was deployed from this review branch.
- The authenticated Supabase CLI migration comparison from the current Artist Frequency branch shows identical local and remote migration IDs `0001` through `0031` (no missing or pending migration IDs). The production Functions list shows all five payment functions ACTIVE: invoice checkout v10, payment status v10, Paystack webhook v10, Premium creation v8 and Premium cancellation v8. Those deployed versions predate the new review-branch CORS/callback hardening.

## Final Artist Frequency and payment-origin checks — 2026-11-17

- The latest Artist Frequency Cloudflare preview smoke test returned HTTP 200 for all 19 checked endpoints: homepage, robots, sitemap, application/auth/Supabase modules, public config, SEO SVG and all dashboard, submissions, discover, marketplace, campaigns, profile, account, stats, premium, billing and admin query routes. No failed endpoint was found.
- Static accessibility checks on Artist Frequency found one H1, document language, viewport declaration, no duplicate IDs, no unnamed links/buttons, and all 53 visible form controls associated with labels (explicit or wrapping). The page contains seven forms, 23 buttons and 41 links. CSS includes responsive breakpoints at 850px and 560px.
- A repository-wide text/source scan after the origin corrections found zero occurrences of the retired `.org` hostname in 29 scanned Artist Frequency text/source files, 83 DiggerMan files or 12 Kingpin files.
- All four updated browser-facing Supabase TypeScript functions successfully transpiled with esbuild 0.28.2. CORS/callback logic tests passed: production Pages origin accepted; the protected preview origin accepted; retired `.org`, HTTP and arbitrary external origins rejected. The branch filter ignores stale environment entries that do not match the active production/preview origins.
- Google PageSpeed Insights returned HTTP 429 quota-exceeded responses for all three site requests.
- Static responsive-CSS inspection found mobile breakpoints at 850px and 560px on Artist Frequency; DiggerMan and Kingpin contain responsive breakpoints covering widths from 900px down to 600px (and DiggerMan also at 720px), plus `prefers-reduced-motion` and forced-colors handling. This is stylesheet/source evidence, not a rendered device preview. No Lighthouse or Core Web Vitals scores are available from this run; browser-rendered mobile layout and performance testing remain open audit gates.
- Payment-origin source corrections and documentation are on the Artist Frequency review branch only. Supabase secret values were not read or changed, and none of the Edge Functions was deployed. At the eventual approved release, set `APP_ORIGIN`, `CORS_ALLOWED_ORIGINS` and `PAYMENT_RETURN_URL` to the selected `pages.dev` production origin and run full Paystack sandbox acceptance tests.

## Latest Artist Frequency preview redeployment — 2026-11-17

- After the W3C accessibility/markup corrections, the sanitized public publish directory was redeployed from the updated branch head `ebd997aa4d51009b7c017a13602fe170ca85435f`.
- Latest Cloudflare Pages preview deployment: `a0354f8a-cff2-42d4-ad84-3d00b16a5604`, source `ebd997a`, branch `seo/artist-frequency-visual-and-entity-seo-2026-11`.
- Preview alias: https://seo-artist-frequency-visual.global-music-submission-portal.pages.dev/ . Immutable deployment URL: https://a0354f8a.global-music-submission-portal.pages.dev/ .
- Direct Acer HTTP checks returned 200 for the homepage, `robots.txt`, `sitemap.xml`, all three JavaScript application modules, `supabase-config.js` and the SEO SVG.
- The latest served HTML confirms the Pages canonical/OG URLs, the original Google verification meta tag and both required-select placeholder options. The retired `.org` hostname is absent from the live preview homepage, robots file and sitemap.
- This is still a Preview deployment on the SEO branch. Cloudflare Production remains unchanged on `main` (`cd48f6f0-447c-407b-bf2b-05bb92c6ba21`).

## W3C Nu HTML validation — 2026-11-17

- W3C Nu validator returned zero errors and zero warnings on the final Artist Frequency homepage, DiggerMan homepage, DiggerMan catalogue page and The Kingpin Entertainment homepage.
- The first validation pass exposed two required-select placeholder errors on Artist Frequency, one invalid generic `aria-label` on the DiggerMan featured-release group and four gallery-article-without-heading warnings each on DiggerMan and Kingpin.
- Corrected the Artist Frequency required selects with empty-value prompt options; changed the DiggerMan labelled release container to `role="group"`; and added visually hidden, descriptive H3 headings to the gallery-card articles on DiggerMan and Kingpin. All four main-page/catalogue validations then returned clean results.
- A further W3C pass was attempted across all 68 DiggerMan track pages. Fifty-two returned clean validator results with no errors or warnings. Sixteen requests were intercepted by the validator's Cloudflare protection with HTTP 429 HTML challenge pages; those 16 pages were not certified by W3C in this run and are not counted as HTML failures.

## Final audit gates — all required before indexing
1. Verify every canonical URL and one preferred host/protocol.
2. Verify unique titles and meta descriptions on homepage, catalogue, release and important landing pages.
3. Validate JSON-LD syntax and entity consistency.
4. Verify every OG/Twitter image URL returns HTTP 200, is crawlable and has the correct brand artwork.
5. Verify every image path exists, image dimensions are declared, ALT coverage is complete and file sizes are reasonable.
6. Verify sitemap URLs are canonical, live and not blocked by robots.txt.
7. Verify internal cross-links follow the three-site network without circular or misleading identity claims.
8. Check mobile rendering, page performance and broken links.
9. Run final repository and deployed-site integrity checks.
10. Only after owner approval, submit sitemaps and request indexing.

## Indexing status
HOLD. Do not submit URLs or sitemaps to Google/Bing until all three sites pass every final audit gate and the owner explicitly authorises indexing.
