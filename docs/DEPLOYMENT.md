# Deployment and search indexing

The public site uses **https://scandeck.luizbizzio.com/**. GitHub Pages is published by `.github/workflows/pages.yml` when `main` changes. Its static distribution is created by `npm run build:cloudflare`, which runs the code generators and `tools/build/prepare-cloudflare.mjs`. The same generated `dist/` is tested and deployed; the script name is retained for compatibility.

## Custom domain

- The custom domain `scandeck.luizbizzio.com` is configured in repository Pages settings and DNS; it is not currently a versioned `CNAME` file.
- Keep the custom domain set in the GitHub repository Pages settings.
- Make sure DNS points the subdomain to the correct GitHub Pages host. DNS, HTTPS activation and external redirects are configured outside this repository.

## SEO

- `index.html` has a descriptive title, meta description, canonical URL, Open Graph/Twitter metadata and WebApplication structured data.
- `robots.txt` allows crawling and points to `sitemap.xml`.
- `sitemap.xml` lists one canonical page. The Scan, Games, Create and About tabs use hash fragments and are not separate indexable pages.
- Navigation uses actual links, which are accessible without running a click handler.

For better search visibility after deployment, add and verify `scandeck.luizbizzio.com` in Google Search Console, submit `https://scandeck.luizbizzio.com/sitemap.xml`, and inspect the live URL. Search ranking and indexing are not guaranteed by meta tags.

To give Games and About their own search results in the future, create real URLs with distinct HTML titles and unique content; hash-only tabs are a limitation.
