import { NextResponse } from "next/server";
import { chromium as playwrightChromium, Route } from "playwright-core";
import chromium_serverless from "@sparticuz/chromium";

// Shared context cache
let cachedContext: any = null;

async function getAuthenticatedContext() {
  // 1. Re-use cached browser context if valid
  if (cachedContext) {
    try {
      const page = await cachedContext.newPage();
      // Block images/styles to save bandwidth
      await page.route('**/*', (route: Route) => {
        const resource = route.request().resourceType();
        if (resource === 'image' || resource === 'stylesheet') {
          route.abort();
        } else {
          route.continue();
        }
      });
      // Simple connectivity test
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 5000 });
      await page.close();
      return cachedContext;
    } catch (e) {
      console.error("Cached context stale, clearing:", e);
      cachedContext = null;
    }
  }

  // 2. Setup Launch Logic (Local vs. Production)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';

  let launchOptions: any = {
    headless: true,
  };

  const contextOptions = {
    ignoreHTTPSErrors: true,
    slowMo: 0,
  };

  let browserExecutable = playwrightChromium;

  if (isProduction) {
    // --- Netlify Production Setup ---
    // Because of serverExternalPackages in next.config.ts, this now works standardly
    launchOptions = {
      ...launchOptions,
      args: chromium_serverless.args,
      executablePath: await chromium_serverless.executablePath(),
    };
  } else {
    // --- Local Development Setup ---
    try {
      const { chromium } = require('playwright');
      browserExecutable = chromium;
    } catch (e) {
      console.error("Local Playwright not found. Run 'npm install playwright' for local dev.", e);
      throw new Error("Local environment setup failed.");
    }
  }

  // 3. Launch Browser
  const browser = await browserExecutable.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Block resources again for the login page
  await page.route('**/*', (route: Route) => {
    const resource = route.request().resourceType();
    if (resource === 'image' || resource === 'stylesheet') {
      route.abort();
    } else {
      route.continue();
    }
  });

  // 4. LinkedIn Login
  console.log("Navigating to login...");
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 15000 });

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    await context.close();
    await browser.close();
    throw new Error("Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD env variables.");
  }

  await page.fill('input[name="session_key"]', email);
  await page.fill('input[name="session_password"]', password);
  await page.click('button[type="submit"]');

  // Wait for feed to confirm login
  try {
    await page.waitForURL("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 20000 });
  } catch (e) {
    console.error("Login timeout or failure:", e);
    const currentUrl = await page.url();
    if (!currentUrl.includes("feed")) {
      await context.close();
      await browser.close();
      throw new Error("Login failed. Possible 2FA or bad credentials.");
    }
  }

  await page.close();
  cachedContext = context;
  return context;
}

export async function POST(request: Request) {
  const { profile } = await request.json();
  let profileData = "";

  // 5. Scrape Logic
  if (profile.includes("linkedin.com")) {
    try {
      const context = await getAuthenticatedContext();
      const page = await context.newPage();

      // Block resources
      await page.route('**/*', (route: Route) => {
        const resource = route.request().resourceType();
        if (resource === 'image' || resource === 'stylesheet') {
          route.abort();
        } else {
          route.continue();
        }
      });

      let profileUrl = profile;
      if (!profileUrl.startsWith("http")) {
        profileUrl = "https://" + profileUrl;
      }
      
      console.log(`Scraping profile: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      
      // Small buffer for dynamic content
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
    } catch (error) {
      console.error("Scraping error:", error);
      // We don't clear cachedContext here immediately to allow retries, 
      // but you could set cachedContext = null if you suspect the session died.
      return NextResponse.json(
        { error: "Failed to scrape profile. Ensure URL is correct and profile is public-ish." },
        { status: 400 }
      );
    }
  } else {
    profileData = profile;
  }

  // 6. Groq / AI Logic
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
            content: `Roast this LinkedIn profile based on this data:\n\n${profileData.substring(0, 10000)}`, // Limit char count for API safety
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