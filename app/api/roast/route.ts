import { NextResponse } from "next/server";
import { chromium as playwrightChromium, Route } from "playwright-core";
import chromium_serverless from "@sparticuz/chromium";

// Shared context cache. Crucial for performance (cache hit saves ~25 seconds).
let cachedContext: any = null;

/**
 * Initializes or reuses an authenticated Playwright context.
 */
async function getAuthenticatedContext() {
  // 1. Re-use cached context
  if (cachedContext) {
    try {
      // QUICK TEST: Use a very fast page load to confirm the context is alive.
      const page = await cachedContext.newPage();
      await page.goto("about:blank", { timeout: 1000 });
      await page.close();
      console.log("Reusing cached context. Cache hit!");
      return cachedContext;
    } catch (e) {
      console.error("Cached context stale, failed test. Initiating new session.", e);
      cachedContext = null;
    }
  }

  // 2. Setup Launch Logic (Only runs on cold start or cache miss)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';

  let launchOptions: any = { headless: true, timeout: 25000 }; // 25s launch timeout

  const contextOptions = {
    ignoreHTTPSErrors: true,
    slowMo: 0,
  };

  let browserExecutable = playwrightChromium;

  if (isProduction) {
    // Netlify Production Setup
    launchOptions = {
      ...launchOptions,
      // Added --disable-setuid-sandbox for maximum stability on Linux serverless
      args: chromium_serverless.args.concat(['--disable-setuid-sandbox']), 
      executablePath: await chromium_serverless.executablePath(),
    };
  } else {
    // Local Development Setup
    try {
      const { chromium } = require('playwright');
      browserExecutable = chromium;
    } catch (e) {
      throw new Error("Local environment setup failed.");
    }
  }

  // 3. Launch Browser and Create Context
  const browser = await browserExecutable.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // HIGH PERFORMANCE: Block all non-essential resources immediately on the context level
  await context.route('**/*', (route: Route) => {
    const resource = route.request().resourceType();
    // Block images, styles, AND fonts to save every millisecond during navigation
    if (resource === 'image' || resource === 'stylesheet' || resource === 'font') {
      route.abort();
    } else {
      route.continue();
    }
  });

  // 4. LinkedIn Login
  console.log("Navigating to login... (Expect 20-30s on cold start)");
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 15000 });

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    await context.close();
    await browser.close();
    throw new Error("Missing LinkedIn credentials.");
  }

  // Type fills and click
  await page.fill('input[name="session_key"]', email);
  await page.fill('input[name="session_password"]', password);
  await page.click('button[type="submit"]');

  // Robust Login Check: Uses element check as a fallback to beat security redirects
  try {
    // Option 1: Wait for the standard feed URL (20s)
    await page.waitForURL("https://www.linkedin.com/feed/", { 
        waitUntil: "domcontentloaded", 
        timeout: 20000 
    });
    console.log("Login successful via URL check.");
    
  } catch (e) {
    // Option 2: Fallback check for a successful element (the Home link)
    try {
        await page.waitForSelector('nav[aria-label="Primary"] a[href="/feed/"]', { timeout: 10000 });
        console.log("Login successful via element check.");
        
    } catch(e2) {
        // Both checks failed - assume security challenge or bad credentials.
        const currentUrl = await page.url();
        console.error("Login failed: neither feed URL nor primary navigation element found. URL:", currentUrl);
        
        await context.close();
        await browser.close();
        
        throw new Error(`Login failed or hit security challenge. Check credentials and 2FA status.`);
    }
  }

  await page.close();
  // Cache the successfully logged-in context
  cachedContext = context;
  return context;
}

export async function POST(request: Request) {
  const { profile } = await request.json();
  let profileData = "";

  // 5. Scrape Logic
  if (profile.includes("linkedin.com")) {
    let context: any;
    let page: any;
    try {
      // Must be called inside the try/catch block to handle the browser launch failure
      context = await getAuthenticatedContext(); 
      page = await context.newPage();

      let profileUrl = profile;
      if (!profileUrl.startsWith("http")) {
        profileUrl = "https://" + profileUrl;
      }
      
      console.log(`Scraping profile: ${profileUrl}`);
      // Navigation should be fast on cache hit.
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      
      await page.waitForTimeout(1000); 

      const profileText = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return bodyText
          .replace(/Follow|Connect|Message|Premium|Promoted|Skip to main content/g, '')
          .replace(/\s\s+/g, ' ')
          .trim();
      });

      profileData = profileText;
      await page.close();

    } catch (error: any) {
      console.error("Scraping error:", error.message);
      // Clear the cache to force a fresh session next time
      cachedContext = null; 
      return NextResponse.json(
        { error: `Scraping failed: ${error.message}. Likely due to 30-second cold-start timeout or LinkedIn security.` },
        { status: 400 }
      );
    }
  } else {
    profileData = profile;
  }

  // 6. Groq / AI Logic (Remains unchanged)
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content: `
                You are a brutally honest roaster who exposes LinkedIn's delusional narratives with surgical precision.

                Rules:
                - Address the person DIRECTLY in second person (\"you\", \"your\", not \"they\")
                - Be VICIOUSLY savage and unforgiving about their shortcomings
                - Call out SPECIFIC gaps: same role/company for 2+ years (stagnation), underqualified, overskilled for the role, weak education, lack of real impact
                - Demolish humble-bragging and inflated accomplishments - expose the reality
                - Mock Tier 2/3 college graduates claiming to be \"ivy league material\"
                - Highlight skills inflation - listing 50 skills but none are proven or impactful
                - Roast people stuck in the same role/salary band for years as if they're climbing
                - Point out generic buzzwords (\"synergy\", \"innovative\", \"disruptive\") as cover for actual mediocrity
                - If they claim to be a \"leader\" but have never managed anyone, annihilate them
                - Be personal, specific to THEIR profile details - name their actual company, role, or claims
                - Keep it SHORT - 4 to 5 punchy sentences max
                - Sprinkle in emojis 😂🔥💀😭🚩🤡
                - Write as one flowing paragraph
                - No slurs, no hate, no protected classes
                - Make it so accurate it stings
              `,
          },
          {
            role: "user",
            content: `Roast this LinkedIn profile based on this data:\n\n${profileData.substring(0, 10000)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Groq API error");
    }
    return NextResponse.json({ roast: data.choices?.[0]?.message?.content });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate roast." },
      { status: 500 }
    );
  }
}