# ScrollKurai

Digital wellness gamification app to reduce screen time and build better habits.

## Project info

**URL**: https://lovable.dev/projects/83c4d2fb-4608-48c1-a5d5-216e5b0ac4e3

## Features

- ✅ Onboarding flow for new users
- ✅ Daily quests & reflection system  
- ✅ Weekly competitive leagues (Bronze → Diamond)
- ✅ Team challenges (3-5 friends)
- ✅ Premium tier (Pro subscription)
- ✅ Power-ups store (Streak Shield, XP Booster)
- ✅ Analytics dashboard ("/insights")
- ✅ Referral system with QR codes
- ✅ Emotional notifications
- ✅ Surprise rewards & mystery badges

## Feature Flags

Configure features in `src/lib/featureFlags.ts`:
```typescript
enable_team_challenges: true
enable_premium_tier: true
enable_power_ups: true
enable_premium_expansion: true
enable_analytics_dashboard: true
enable_onboarding_flow: true
```

## Recent Audit (2025-01-22)

✅ All features smoke-tested and verified functional  
✅ Navigation fixed (Teams, Premium, Power-ups accessible)  
✅ Feature flag system implemented  
✅ Database schema verified  
✅ Edge functions operational

See `AUDIT_REPORT.md` for full details.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/83c4d2fb-4608-48c1-a5d5-216e5b0ac4e3) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/83c4d2fb-4608-48c1-a5d5-216e5b0ac4e3) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
