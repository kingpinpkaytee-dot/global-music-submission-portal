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

## Cloudflare Pages preview deployment validation — 2026-11-17

- A sanitized static publish directory was built from the SEO branch. It contains only the public site entry point, robots/sitemap, Google verification file, public Supabase browser configuration, the three application modules and the public SEO asset. Repository documentation, workflow files, scripts, SQL migrations and sample environment files were excluded from the upload.
- Preview deployment succeeded with Wrangler 4.164.0: deployment ID `09281162-0c92-47bb-ab7d-bfdf671825a2`, branch `seo/artist-frequency-visual-and-entity-seo-2026-11`, source commit `e7f519e`. Preview alias: https://seo-artist-frequency-visual.global-music-submission-portal.pages.dev/
- Preview HTTP checks passed (200) for the homepage, `robots.txt`, `sitemap.xml`, `src/app.js`, `src/auth.js`, `src/supabase-client.js`, `supabase-config.js`, the public SEO SVG, Dashboard and Submissions query routes, and the Cloudinary Open Graph image.
- The deployed preview homepage returns the intended `pages.dev` canonical and Open Graph URL and retains the existing Google verification meta tag. The retired `.org` hostname was not found in the deployed homepage, robots file or sitemap.
- The Google HTML verification file path currently responds with HTTP 308 and redirects to its extensionless URL due to Pages URL handling. The homepage meta-tag verification method remains available; do not claim Search Console ownership is verified until the user confirms the Search Console result.
- The preview is a branch deployment only. The production deployment remains on `main` and was not changed. No sitemap or indexing request was submitted.

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
