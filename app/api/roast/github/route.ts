import { NextResponse } from "next/server";

function limitToCompleteRoast(text: string): string {
  const words = text.trim().split(/\s+/);
  const limitedText = words.slice(0, 300).join(" ");

  if (words.length <= 300 && /[.!?]$/.test(limitedText)) {
    return limitedText;
  }

  const lastSentenceEnd = Math.max(
    limitedText.lastIndexOf("."),
    limitedText.lastIndexOf("!"),
    limitedText.lastIndexOf("?")
  );

  return lastSentenceEnd >= 0
    ? limitedText.slice(0, lastSentenceEnd + 1)
    : `${limitedText}.`;
}

export async function POST(request: Request) {
  try {
    const { profile, intensity } = await request.json(); // Expected: GitHub username
    if (!profile) return NextResponse.json({ error: "Username required" }, { status: 400 });

    if(profile.toLowerCase() === "aiman-mumtaz") {
        return NextResponse.json({ roast: "Wait... you're trying to roast the Queen of the Repo? 👑? Aiman's code is cleaner than your browser history. Go back to your 'Hello World' projects, child!!" });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
    const intensityKey = typeof intensity === "string" ? intensity : "savage";
    const roastIntensity = ({
      light: "Keep the humor playful and gentle; avoid harsh insults.",
      balanced: "Use sharp, sarcastic humor while keeping the insults moderate.",
      savage: "Use ruthless, brutally sarcastic humor with no mercy.",
    } as Record<string, string>)[intensityKey] ?? "Use ruthless, brutally sarcastic humor with no mercy.";

    // Fetch GitHub Data
    const userRes = await fetch(`https://api.github.com/users/${profile}`);
    if (!userRes.ok) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userData = await userRes.json();

    const repoRes = await fetch(`https://api.github.com/users/${profile}/repos?sort=updated&per_page=5`);
    const repoData = await repoRes.json();

    const repos = repoData.map((r: any) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count
    }));

    const completion = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        max_tokens: 450,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: `
                You are a funny but toxic GitHub auditor. 
                Mock their contribution frequency, generic projects, lack of stars, and weird bio. Address in First Person directly.
                If they have no repositories, mock their 'ghost' presence and if they have too many repositories mock that as well.
                CRITICAL: Use coding puns and brutally witty humor, try to keep every insult unique. End with a complete sentence and advice.
                Keep the roast between 150 and 280 words, and never stop mid-sentence. Add 3-4 coding-related emojis.
                Intensity: ${roastIntensity}`
          },
          {
            role: "user",
            content: `Roast this GitHub user: ${JSON.stringify({
                username: userData.login,
                bio: userData.bio,
                public_repos: userData.public_repos,
                followers: userData.followers,
                following: userData.following,
                top_repos: repos
            })}`
          }
        ],
        stream: false
      })
    });

    const aiData = await completion.json();
    
    if (!completion.ok) {
      console.error("Groq API error:", aiData);
      return NextResponse.json({ error: "AI service error. Try again." }, { status: 500 });
    }

    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
      console.error("Invalid Groq response structure:", aiData);
      return NextResponse.json({ error: "Failed to generate roast. Try again." }, { status: 500 });
    }

    const roast = limitToCompleteRoast(aiData.choices[0].message.content);

    return NextResponse.json({ roast });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
