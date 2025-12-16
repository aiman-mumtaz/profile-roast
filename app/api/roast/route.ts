import { NextResponse } from "next/server";
// Import playwright-core for types and the chromium executable reference
import { chromium as playwrightChromium, Route } from "playwright-core";
// Import the serverless optimized chromium package
import chromium_serverless from "@sparticuz/chromium"; 

// --- Conditional Imports for Local Development ---
// We use 'require' here inside the function to avoid errors when bundling for Netlify.
// We only import the full 'playwright' package if NOT in production.

// Shared context cache
let cachedContext: any = null;

async function getAuthenticatedContext() {
    // If context already exists and is valid, reuse it
    if (cachedContext) {
        try {
            // Test if context is still valid by checking a page
            const page = await cachedContext.newPage();
            
            // TypeScript Fix: Explicitly type 'route' as Route
            await page.route('**/*', (route: Route) => {
                if (route.request().resourceType() === 'image' || route.request().resourceType() === 'stylesheet') {
                    route.abort();
                } else {
                    route.continue();
                }
            });
            await page.goto("https://www.linkedin.com/feed/", { waitUntil: "load", timeout: 5000 });
            await page.close();
            return cachedContext;
        } catch (e) {
            console.error("Cached context stale or failed test, clearing cache:", e);
            cachedContext = null;
        }
    }

    // --- Conditional Launch Logic ---
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';

    // 1. Launch Options (related to the executable itself)
    let launchOptions: any = {
        headless: true,
    };
    
    // 2. Context Options (related to the browser session/page)
    const contextOptions = {
        // Properties moved here (TypeScript Fix):
        ignoreHTTPSErrors: true,
        slowMo: 0, 
    };

    let browserExecutable = playwrightChromium;

    if (isProduction) {
        // Netlify/Lambda Production Configuration
        launchOptions = {
            ...launchOptions,
            args: chromium_serverless.args,
            executablePath: await chromium_serverless.executablePath(),
        };
    } else {
        // Local/Development Configuration (uses locally installed Playwright package)
        try {
            // We use require to load the full 'playwright' package only when needed locally
            const { chromium } = require('playwright');
            browserExecutable = chromium;
        } catch (e) {
            console.error("Local Playwright dependency failed to load. Did you run 'npm install playwright' and 'npx playwright install'?", e);
            throw new Error("Local environment setup failed.");
        }
    }
    // --- End Conditional Logic ---


    // Launch the browser
    const browser = await browserExecutable.launch(launchOptions);
    
    // Create new context with ContextOptions
    const context = await browser.newContext(contextOptions); 
    const page = await context.newPage();

    // TypeScript Fix: Explicitly type 'route' as Route
    await page.route('**/*', (route: Route) => {
        if (route.request().resourceType() === 'image' || route.request().resourceType() === 'stylesheet') {
            route.abort();
        } else {
            route.continue();
        }
    });

    // Login to LinkedIn
    await page.goto("https://www.linkedin.com/login", { waitUntil: "load", timeout: 15000 });

    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!email || !password) {
        await context.close();
        await browser.close();
        throw new Error("LinkedIn credentials not configured. Please set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in Netlify environment settings.");
    }

    // Enter credentials
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    await page.click('button[type="submit"]');

    // Wait for login to complete
    try {
        await page.waitForURL("https://www.linkedin.com/feed/", { waitUntil: "load", timeout: 20000 });
    } catch (e) {
        console.error("Login failed or timed out. Check for two-factor auth or error messages:", e);
        
        if (await page.url() !== "https://www.linkedin.com/feed/") {
             await context.close();
             await browser.close();
             throw new Error("Login failed. Check credentials, 2FA status, or LinkedIn security.");
        }
    }

    await page.close();
    cachedContext = context;
    return context;
}

export async function POST(request: Request) {
    const { profile } = await request.json();

    let profileData = "";

    if (profile.includes("linkedin.com")) {
        try {
            // This function call is now safe for both local and Netlify environments
            const context = await getAuthenticatedContext();
            const page = await context.newPage();
            
            // TypeScript Fix: Explicitly type 'route' as Route
            await page.route('**/*', (route: Route) => {
                if (route.request().resourceType() === 'image' || route.request().resourceType() === 'stylesheet') {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            // Navigate to the profile URL
            let profileUrl = profile;
            if (!profileUrl.startsWith("http")) {
                profileUrl = "https://" + profileUrl;
            }
            await page.goto(profileUrl, { waitUntil: "load", timeout: 15000 });

            // Wait a bit for profile to fully load
            await page.waitForTimeout(800);

            // Extract profile information
            const profileText = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                const cleanedText = bodyText
                    .replace(/Follow|Connect|Message|Premium|Promoted|Skip to main content/g, '')
                    .replace(/\s\s+/g, ' ') 
                    .trim();
                return cleanedText;
            });

            profileData = profileText;
            await page.close();
        } catch (error) {
            // This catches the timeout and the environment errors
            console.error("Error scraping LinkedIn:", error);
            cachedContext = null; 
            return NextResponse.json(
                { error: "Failed to fetch LinkedIn profile. Please ensure Netlify environment variables are set and the function is not timing out." },
                { status: 400 }
            );
        }
    } else {
        profileData = profile;
    }

    // --- Groq API Call ---

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions",
        {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 200,
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
                content: `Roast this LinkedIn profile with brutal wit and sarcasm. Write it as a flowing paragraph that reads like a comedic essay. Make it withering and memorable:\n\n${profileData}`,
            },
            ],
        }),
        }
    );
    const data = await response.json();

    if (!response.ok) {
        console.error("API Error:", data);
        return NextResponse.json(
            { error: data.error?.message || "Failed to generate roast" },
            { status: response.status }
        );
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
        console.error("Unexpected response structure:", data);
        return NextResponse.json(
            { error: "Unexpected response format from API" },
            { status: 500 }
        );
    }

    return NextResponse.json({ roast: data.choices[0].message.content });
}