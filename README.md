# 🔥 Social Profile Roaster (Linkedin & Github)

A brutally honest, dual-platform roasting tool. This app uses AI to generate witty, savage roasts based on your professional presence—whether you're a "Corporate LinkedIn Guru" or a "GitHub Green Square Addict"

## New Features

- **Dual-Mode UI** - Brand-matching themes for both LinkedIn (Corporate Blue) and GitHub (Dev Green) with a unified Design System
- **AI-Powered Roasting** - Uses Groq's LLaMA 3.3 model to generate brutal, witty roasts
- **LinkedIn Profile Scraping** - Automatically fetches and analyzes LinkedIn profiles
- **Dark Mode UI** - LinkedIn-inspired dark theme with smooth animations
- **Fast & Efficient** - Cached authentication for quick roast generation
- **Personal Roasts** - Each roast is tailored to specific profile details, not generic

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Animation**: Native CSS animations (keyframes)
- **Deployment**: Vercel (with GitHub integration)

## Navigation Structure
The app is now structured to support parallel platform experiences:

- **/linkedin** - The Corporate Grind Roast 
- **/github** - The Code Monkey Roast 

## Getting Started

### Prerequisites

- Node.js 18+
- Groq API key (get one at https://console.groq.com)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aiman-mumtaz/linkedin-roaster.git
cd linkedin-roaster
```

2. Install dependencies:
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env.local`:
```env
GROQ_API_KEY=your_groq_api_key_here
```
4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. User pastes a LinkedIn profile URL
2. App logs into LinkedIn and scrapes the profile data
3. Profile text is sent to Groq's API with a custom prompt
4. AI generates a brutal, personalized roast
5. Roast is displayed with smooth animations

## API Endpoints

### POST `/api/roast`
Generate a roast for a LinkedIn profile or custom text.

**Request:**
```json
{
  "profile": "https://www.linkedin.com/in/username"
}
```

**Response:**
```json
{
  "roast": "Your brutal roast here..."
}
```

## Configuration

- **Max tokens**: 200 (keeps roasts short and punchy)
- **Temperature**: 0.7 (balanced creativity vs. consistency)
- **Model**: llama-3.3-70b-versatile
- **Browser timeout**: 15 seconds for scraping

## Performance Notes

- API response time: ~3-5 seconds
- No authentication delays (no scraping required)
- Lightweight, privacy-respecting architecturefiles
- No hate speech, slurs, or protected class attacks

## Legal & Ethical

- Only scrape public LinkedIn profiles
- No hate speech, slurs, or protected class attacks
- Roasts are satirical and comedic in nature
- Use responsibly and for entertainment purposes only

## Future Improvements

- [x] Support for other social profiles (Github Added)
- [ ] Custom roast intensity levels
- [ ] Share roasts on social media
- [ ] Roast history/favorites
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Export roasts as high-quality PNGs for sharing

## License

MIT

## Support

For issues or questions, please open an issue on the repository.

---

Built with ❤️ and brutality 🔥
