# STEMuiz

A real-time quiz application for STEM High Schools, built with Next.js, Socket.io, and MongoDB.

![STEMuiz Screenshot](screenshot.png)

## Features

- ✅ Real-time multiplayer quiz experience
- ✅ Mobile-friendly responsive design
- ✅ Host and player interfaces
- ✅ Custom quiz creation for STEM subjects
- ✅ Multiple choice and true/false questions
- ✅ Random question ordering
- ✅ Leaderboards with real-time updates
- ✅ Achievements and badges system
- ✅ Time-based scoring
- ✅ Answer streaks for bonus motivation

## Tech Stack

- **Frontend**: Next.js, React, SCSS (BEM methodology)
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (frontend), Railway/Heroku/Render (backend)

## Prerequisites

- Node.js 16+
- MongoDB
- Supabase account

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/stemuiz.git
cd stemuiz
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Socket.IO Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 4. Set up the database

Run the SQL migrations to set up your database schema:

```bash
# Run the latest schema migration
cat migration.sql | psql your_database_connection_string
```

### 5. Start the development servers

Start the Next.js frontend server:

```bash
npm run dev
```

In a separate terminal, start the Socket.io server:

```bash
node server/index.js
```

## Project Structure

```
kahoot-clone/
├── components/             # Reusable UI components
├── contexts/               # React contexts
├── lib/                    # Utilities and services
├── pages/                  # Next.js pages
│   ├── api/                # API routes
│   ├── auth/               # Authentication pages
│   ├── dashboard/          # User dashboard
│   ├── host/               # Game host interface
│   ├── play/               # Game player interface
│   └── quiz/               # Quiz management
├── public/                 # Static assets
├── server/                 # Socket.io server
├── styles/                 # Global SCSS styles
└── migration.sql           # Database schema
```

## Game Flow

1. **Host creates a quiz**: Customizable questions, options, and settings
2. **Host starts a game session**: Generates a unique game PIN
3. **Players join using the PIN**: Enter nickname to join
4. **Host starts the game**: All players see the same questions in real-time
5. **Players answer questions**: Points awarded based on correctness and speed
6. **Leaderboard updates**: After each question
7. **Game ends**: Final results displayed to all participants

## Deployment

### Frontend (Next.js)

Deploy to Vercel:
1. Connect your GitHub repository
2. Configure environment variables
3. Deploy

### Backend (Socket.io Server)

Deploy to Railway, Heroku, or Render:
1. Set up a new web service
2. Configure environment variables
3. Set up the deployment pipeline

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Socket.io](https://socket.io/) for real-time communication
- [Next.js](https://nextjs.org/) for the React framework
- [Supabase](https://supabase.io/) for authentication
- [MongoDB](https://www.mongodb.com/) for database services