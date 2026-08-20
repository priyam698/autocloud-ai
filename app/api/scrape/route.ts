import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Helper: Strip HTML tags, scripts, styles, SVGs, and extract clean text
function extractCleanText(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Convert key tags to markdown layout
  text = text
    .replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '\n\n### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // Clean decoded entities & excessive whitespace
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// Helper: Discover relevant internal links from the homepage
function findInternalLinks(html: string, baseUrl: string, maxLinks = 6): string[] {
  try {
    const parsedBase = new URL(baseUrl);
    const linkRegex = /href=["']([^"']+)["']/gi;
    const discovered = new Set<string>();
    let match;

    const highPriorityPaths = ['pricing', 'about', 'faq', 'features', 'services', 'docs', 'help', 'contact', 'product', 'terms'];

    while ((match = linkRegex.exec(html)) !== null) {
      let rawLink = match[1].trim();
      if (!rawLink || rawLink.startsWith('#') || rawLink.startsWith('mailto:') || rawLink.startsWith('tel:')) continue;

      try {
        const absoluteUrl = new URL(rawLink, baseUrl);
        if (absoluteUrl.hostname === parsedBase.hostname && absoluteUrl.pathname !== parsedBase.pathname) {
          const pathLower = absoluteUrl.pathname.toLowerCase();
          // Prioritize high-value informational pages
          if (highPriorityPaths.some(p => pathLower.includes(p))) {
            discovered.add(absoluteUrl.href);
          } else if (discovered.size < maxLinks && !pathLower.match(/\.(png|jpg|jpeg|gif|css|js|pdf|svg)$/)) {
            discovered.add(absoluteUrl.href);
          }
        }
      } catch (_) {}

      if (discovered.size >= maxLinks) break;
    }

    return Array.from(discovered);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = (body.url || body.websiteUrl || body.website_url || '').trim();
    const deepCrawl = body.deepCrawl !== false;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    let targetUrl = rawUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // 1. Fetch Main Landing Page
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const mainRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AutoCloudScraper/2.0; +https://autocloud-ai.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!mainRes.ok) {
      return NextResponse.json({ error: `Failed to load website (HTTP ${mainRes.status})` }, { status: 400 });
    }

    const mainHtml = await mainRes.text();
    const mainTitle = mainHtml.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || targetUrl;
    const mainText = extractCleanText(mainHtml);

    let combinedMarkdown = `# ${mainTitle}\nSource: ${targetUrl}\n\n${mainText.slice(0, 3500)}`;
    const crawledUrls = [targetUrl];

    // 2. Recursive Deep Crawl (Subpages: Pricing, About, FAQ, Features)
    if (deepCrawl) {
      const subpageUrls = findInternalLinks(mainHtml, targetUrl, 5);

      const subpagePromises = subpageUrls.map(async (subUrl) => {
        try {
          const subController = new AbortController();
          const subTimer = setTimeout(() => subController.abort(), 5000);
          const subRes = await fetch(subUrl, {
            signal: subController.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AutoCloudScraper/2.0)' },
          });
          clearTimeout(subTimer);

          if (subRes.ok) {
            const subHtml = await subRes.text();
            const subText = extractCleanText(subHtml);
            if (subText.length > 100) {
              return { url: subUrl, text: subText.slice(0, 2500) };
            }
          }
        } catch (_) {}
        return null;
      });

      const subpageResults = await Promise.all(subpagePromises);

      for (const res of subpageResults) {
        if (res) {
          crawledUrls.push(res.url);
          const pathName = new URL(res.url).pathname;
          combinedMarkdown += `\n\n---\n## Page: ${pathName}\nSource: ${res.url}\n\n${res.text}`;
        }
      }
    }

    // Calculate word count
    const wordCount = combinedMarkdown.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      knowledge: combinedMarkdown,
      wordCount,
      pagesScraped: crawledUrls.length,
      urls: crawledUrls,
      message: `Successfully extracted ${wordCount.toLocaleString()} words across ${crawledUrls.length} pages.`,
    });
  } catch (err: any) {
    console.error('[Scraper Error]:', err);
    return NextResponse.json({ error: err.message || 'Scraping failed' }, { status: 500 });
  }
}