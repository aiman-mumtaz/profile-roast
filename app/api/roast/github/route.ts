import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { profile } = await request.json(); // Expected: GitHub username
    if (!profile) return NextResponse.json({ error: "Username required" }, { status: 400 });

    if(profile.toLowerCase() === "aiman-mumtaz") {
        return NextResponse.json({ roast: "Wait... you're trying to roast the Queen of the Repo? 👑? Aiman's code is cleaner than your browser history. Go back to your 'Hello World' projects, child!!" });
    }

    const groqKey = process.env.GROQ_API_KEY;

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
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: `
                You are a funny but toxic GitHub auditor. 
                Mock their contribution frequency, generic projects, lack of stars, and weird bio.
                If they have no repositories, mock their 'ghost' presence and if they have too many repositories mock that as well.
                CRITICAL: Use coding puns and brutally witty humor, try to keep every insult unique. End with a complete sentence. Also end with an advice.
                Keep it under 300 words. Add 3-4 coding-related emojis.`
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
    return NextResponse.json({ roast: aiData.choices[0].message.content });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
