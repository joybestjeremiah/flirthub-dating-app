# FlirtHub Dating App

A modern dating application built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

## Features

- **Discover** — Swipe through profiles, like or pass on potential matches
- **Matches** — View your matches and chat with them in real time
- **Rooms** — Create and join group chat rooms to meet new people
- **Profiles** — Set up your profile with photo, bio, age, location, and preferences
- **Premium Subscriptions** — Weekly and monthly plans with premium features
- **Admin Panel** — Admin users can manage the platform from a dedicated dashboard
- **Authentication** — Email and password sign-up/sign-in via Supabase Auth

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Backend:** Supabase (PostgreSQL database, Authentication, Row Level Security)
- **Real-time:** Supabase Realtime for messaging

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Installation

1. Clone the repository:

```bash
git clone https://github.com/joybestjeremiah/flirthub-dating-app.git
cd flirthub-dating-app
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the database migrations in your Supabase project (found in `supabase/migrations/`).

5. Start the development server:

```bash
npm run dev
```

6. Build for production:

```bash
npm run build
```

## Project Structure

```
src/
├── App.tsx                  # Main app component with routing
├── main.tsx                 # Entry point
├── index.css                # Global styles
├── components/
│   ├── CallModal.tsx        # Voice/video call modal
│   └── SubscriptionModal.tsx # Premium subscription modal
├── context/
│   └── AuthContext.tsx      # Authentication context provider
├── lib/
│   ├── supabase.ts          # Supabase client setup
│   └── types.ts             # TypeScript type definitions
└── pages/
    ├── AuthPage.tsx         # Sign in / Sign up
    ├── ProfileSetup.tsx     # Profile creation and editing
    ├── DiscoverPage.tsx     # Swipe through profiles
    ├── MatchesPage.tsx      # Matches list and chat
    ├── RoomsPage.tsx        # Group chat rooms
    └── AdminPanel.tsx       # Admin dashboard
supabase/
└── migrations/              # Database schema and RLS policies
```

## License

This project is proprietary. All rights reserved.
