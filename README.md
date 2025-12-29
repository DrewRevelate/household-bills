# Household Bills Tracker

A simple, real-time expense tracking app for splitting household bills among family members. Built with React, Firebase, and Tailwind CSS.

## Features

- **Bill Management**: Full CRUD operations for all household bills
- **Flexible Splitting**: Support for even splits, fixed mortgage shares, or custom amounts
- **Real-time Sync**: Changes sync instantly across all devices via Firebase
- **Balance Tracking**: Automatically calculates who owes whom
- **Settlement Recommendations**: Shows optimal payments to settle all debts

## Household Members (Pre-configured)

| Person | Mortgage Share |
|--------|---------------|
| Drew   | $1,300        |
| Steve  | $700          |
| Mom    | $500          |
| Dad    | $500          |
| Rose   | $500          |

**Note**: Total assigned is $3,500. The mortgage is $3,564, leaving a $64/month gap. Adjust shares in `src/lib/types.ts` if needed.

## Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or select existing)
3. Enable Google Analytics (optional)

### 2. Create a Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click "Create database"
3. Choose production or test mode:
   - **Test mode**: Open access for 30 days (fine for family use on private network)
   - **Production mode**: Requires authentication setup
4. Select a region close to you

### 3. Register a Web App

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" and click the web icon (`</>`)
3. Register app with a nickname (e.g., "Household Bills")
4. Copy the configuration values

### 4. Configure the App

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then fill in your Firebase values:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 5. Install and Run

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Deployment

### Option A: Vercel (Recommended)

1. Push code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Option B: Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase init hosting

# Deploy
firebase deploy --only hosting
```

### Option C: Netlify

1. Push code to GitHub
2. Import at [netlify.com](https://netlify.com)
3. Add environment variables
4. Deploy

## Firestore Security Rules

For family-only access without authentication, you can use time-limited rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bills/{billId} {
      allow read, write: if true; // Open access - use for trusted family only
    }
  }
}
```

For better security, set up Firebase Authentication and restrict access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bills/{billId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Customization

### Change Household Members

Edit `src/lib/types.ts`:

```typescript
export const HOUSEHOLD_MEMBERS: Person[] = [
  { id: 'drew', name: 'Drew', mortgageShare: 1300 },
  // Add or modify members here
];
```

### Change Bill Categories

Edit `src/lib/types.ts`:

```typescript
export const BILL_CATEGORIES = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'utility', label: 'Utility' },
  // Add more categories
] as const;
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Firebase/Firestore** - Real-time database
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Vite** - Build tool

## License

MIT
