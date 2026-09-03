"use client";
import { useState } from "react";
import Header from "../components/Header";

export default function GitHubRoaster() {
  const [username, setUsername] = useState("");
  const [intensity, setIntensity] = useState("savage");
  const [roast, setRoast] = useState("");
  const [loading, setLoading] = useState(false);

  const generateRoast = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setRoast("");

    const res = await fetch("/api/roast/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: username, intensity }),
    });

    const data = await res.json();
    setRoast(data.roast || data.error);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col p-4 font-mono">
      <Header platform="github"/>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-slate-900 border-t-4 border-emerald-500 rounded-lg p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Profile Roaster</h1>
          <p className="text-gray-400 mb-6">Let's audit those commits.</p>

          <input
            type="text"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded mb-4 text-emerald-400 focus:outline-none focus:border-emerald-500"
            placeholder="Enter GitHub Username (e.g. torvalds)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="block text-sm font-bold text-gray-300 mb-2" htmlFor="roast-intensity">
            Roast Intensity
          </label>
          <select
            id="roast-intensity"
            className="w-full px-4 py-3 mb-4 bg-slate-800 border border-slate-700 rounded text-gray-100 focus:outline-none focus:border-emerald-500"
            value={intensity}
            onChange={(e) => setIntensity(e.target.value)}
          >
            <option value="light">Light: playful teasing</option>
            <option value="balanced">Balanced: sharp and funny</option>
            <option value="savage">Savage: no mercy</option>
          </select>

          <button
            onClick={generateRoast}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded text-white font-bold transition-all disabled:opacity-50"
          >
            {loading ? "Analyzing Commit History..." : "Analyze & Roast"}
          </button>

          {roast && (
            <div className="mt-8 bg-slate-950 border border-emerald-900/50 p-6 rounded text-gray-200">
               <p className="text-emerald-500 mb-2 font-bold uppercase tracking-widest text-xs">Output Log:</p>
               <div className="space-y-4">
               {roast.split("\n").map((line, i) => <p key={i}>{line}</p>)}
               </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}