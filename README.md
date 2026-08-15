# FoodRate AU 🌟

Australian FSANZ Health Star Rating food scanner. Point camera at any nutrition label → get instant star rating.

## Stack
- React PWA (installable on phone)
- Gemini 1.5 Flash vision API
- Vercel serverless function (hides API key)

## Deploy

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init: FoodRate AU"
git remote add origin https://github.com/ssaketh517-png/food-rater-au.git
git push -u origin main
```

### 2. Connect to Vercel
1. Go to vercel.com → New Project
2. Import `food-rater-au` repo
3. Framework: Create React App
4. Add environment variable:
   - Key: `GEMINI_API_KEY`
   - Value: your key from aistudio.google.com

### 3. Deploy → Install on phone
- Open site on phone
- Android: Chrome menu → "Add to Home Screen"
- iOS: Safari share button → "Add to Home Screen"

## Features
- 📸 Camera capture or photo upload
- ⭐ 0.5–5 star FSANZ Health Star Rating
- 📊 Full nutrient breakdown with point scoring
- 📜 Scan history (last 50 scans)
- ⇄ Side-by-side product comparison
- 📱 PWA — installable, works like native app
